import csv
import hashlib
import io
import json
import logging
import os
import re
import time
from typing import Literal, Tuple

import boto3
import geojson

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Env vars
DATABASE = os.environ.get("ATHENA_DB", "flights_db")
S3_RESULTS_BUCKET = os.environ.get(
    "S3_RESULTS_BUCKET", "bucket-flight-atlas-query-results"
)
FLIGHTS_TABLE = os.environ.get("FLIGHTS_TABLE", "flights")
REGION = os.environ.get("REGION", "us-west-1")

# regex vars
VALID_AIRPORT = re.compile(r"^[A-Z]{3}$")
VALID_AIRLINE = re.compile(r"^[A-Z0-9]{2,3}$")

# Aws objects
athena = boto3.client("athena", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)
dynamo = boto3.resource("dynamodb", region_name=REGION)
dynamo_table = dynamo.Table("flights-query-cache")


def run_athena_query(query):
    """Run Athena query and return the output S3 path."""
    response = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={"Database": DATABASE},
        ResultConfiguration={"OutputLocation": f"s3://{S3_RESULTS_BUCKET}/"},
    )

    return response["QueryExecutionId"]


def clean_param(value: str | None, pattern: re.Pattern) -> str | None:
    if not value:
        return None
    value = value.strip().split("?")[0]
    if not pattern.match(value):
        raise ValueError(f"Invalid parameter: {value}")
    return value


def get_query_result_path(execution_id: str) -> Tuple[str, str]:
    """Get path of Athena result"""
    result_obj = athena.get_query_execution(QueryExecutionId=execution_id)
    s3_path = result_obj["QueryExecution"]["ResultConfiguration"]["OutputLocation"]
    bucket = s3_path.split("/")[2]
    key = "/".join(s3_path.split("/")[3:])
    return bucket, key


def get_query_results(bucket: str, key: str) -> list:
    """Download Athena query results CSV from S3."""
    csv_obj = s3.get_object(Bucket=bucket, Key=key)
    csv_data = csv_obj["Body"].read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(csv_data))
    return list(reader)


def build_point_geojson(rows: list):
    """Convert rows to GeoJSON FeatureCollection of Points"""
    features = []
    for row in rows:
        try:
            geom = row["geometry"].replace("POINT (", "").replace(")", "")
            lon, lat = map(float, geom.split())
            point = geojson.Point((lon, lat))
            feature = geojson.Feature(
                geometry=point,
                properties={
                    "FAA": row.get("faa") if row.get("faa") != "0.0" else None,
                    "IATA": row["iata"],
                    "Name": row["title"],
                    "url": row["url"],
                    "destinations": int(row["destinations"]),
                },
            )
            features.append(feature)
        except Exception as e:
            logger.warning(f"Skipping invalid row: {e}")

    return geojson.FeatureCollection(features)


def build_line_geojson(
    rows: list, airline_code: str | None = None
) -> geojson.FeatureCollection:
    """Convert rows to GeoJSON FeatureCollection of LineStrings."""
    features = []
    for row in rows:
        try:
            if airline_code and row.get("airline_code") != airline_code:
                continue

            dst_geom = row["dst_geometry"].replace("POINT (", "").replace(")", "")
            src_geom = row["src_geometry"].replace("POINT (", "").replace(")", "")
            dst_lon, dst_lat = map(float, dst_geom.split())
            src_lon, src_lat = map(float, src_geom.split())

            line = geojson.LineString([[src_lon, src_lat], [dst_lon, dst_lat]])

            feature = geojson.Feature(
                geometry=line,
                properties={
                    "airline_code": row["airline_code"],
                    "src_airport": row["src_airport"],
                    "dst_airport": row["dst_airport"],
                },
            )
            features.append(feature)
        except Exception as e:
            logger.warning(f"Skipping invalid row: {e}")

    return geojson.FeatureCollection(features)


def format_query(
    path: Literal["/routes", "/airlines", "/airports"],
    src_airport: str = None,
    airline_code: str = None,
) -> str:
    if path == "/routes":
        base_query = "SELECT * FROM flights"
        if src_airport:
            return f"{base_query} WHERE src_airport = '{src_airport}'"
        if airline_code:
            return f"{base_query} WHERE airline_code = '{airline_code}'"

    if path == "/airlines":
        base_query = "SELECT * FROM airlines"
        if airline_code:
            return base_query + f" WHERE airline_code = '{airline_code}'"
        else:
            return base_query

    if path == "/airports":
        return "SELECT * FROM airports"


def make_response(status_code: int, body_dict: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": json.dumps(body_dict),
    }


def lambda_handler(event, context) -> dict:
    try:
        """Handle requests for routes by airport or airline."""

        # If `OPTIONS`, else is `GET``
        if event.get("httpMethod") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "GET,OPTIONS",
                },
                "body": "",
            }

        # Lambda event vars
        params = event.get("queryStringParameters") or {}
        path = event.get("rawPath")
        src_airport = clean_param(params.get("airport"), VALID_AIRPORT)
        airline_code = clean_param(params.get("airline_code"), VALID_AIRLINE)

        # If no codes
        if not src_airport and not airline_code and path == "/routes":
            return make_response(
                status_code=400, body_dict={"error": "Missing parameter"}
            )

        if (src_airport or airline_code) and path == "/airports":
            return make_response(
                status_code=400, body_dict={"error": "No parameters for this endpoint"}
            )

        # Query params handling
        query = format_query(
            path=path, src_airport=src_airport, airline_code=airline_code
        )

        # Create hash key for the query
        query_hash = hashlib.sha256(query.encode()).hexdigest()

        # Check cache
        cached = dynamo_table.get_item(Key={"query_hash": query_hash}).get("Item")

        # If if cached
        if cached and "query_id" in cached:
            query_id = cached["query_id"]
            exec_info = athena.get_query_execution(QueryExecutionId=query_id)
            state = exec_info["QueryExecution"]["Status"]["State"]

            if state == "SUCCEEDED":
                # Get path and update dynamo db record
                bucket, s3_result_key = get_query_result_path(query_id)

                # First creation, update the s3_key for caching
                if "s3_key" not in cached:
                    dynamo_table.update_item(
                        Key={"query_hash": query_hash},
                        UpdateExpression="SET s3_key = :k, #s = :s, last_updated = :t",
                        ExpressionAttributeValues={
                            ":k": s3_result_key,
                            ":s": "SUCCEEDED",
                            ":t": int(time.time()),
                        },
                        ExpressionAttributeNames={"#s": "status"},
                    )

                # Get csv data
                rows = get_query_results(bucket=bucket, key=s3_result_key)

                # Return line geojson
                if path == "/routes":
                    result_dict = build_line_geojson(rows, airline_code=airline_code)

                # Return json
                if path == "/airlines":
                    result_dict = {
                        row["airline_code"]: "Delta Air Lines"
                        if row["name"] == "Delta Connection"
                        else row["name"]
                        for row in rows
                    }

                # Return points geojson
                if path == "/airports":
                    result_dict = build_point_geojson(rows)

                # Return data
                return make_response(status_code=200, body_dict=result_dict)

            elif state in ["RUNNING", "QUEUED"]:
                return make_response(
                    status_code=202,
                    body_dict={"status": "processing", "query_id": query_id},
                )

        # Run Athena query
        query_id = run_athena_query(query)
        current_time = int(time.time())
        ttl_seconds = current_time + 7 * 24 * 60 * 60
        dynamo_table.put_item(
            Item={
                "query_hash": query_hash,
                "query_id": query_id,
                "status": "RUNNING",
                "timestamp": current_time,
                "ttl": ttl_seconds,
            }
        )
        return make_response(
            status_code=202, body_dict={"status": "started", "query_id": query_id}
        )

    except Exception as e:
        logger.exception("Lambda failed")
        return make_response(status_code=500, body_dict={"error": str(e)})
