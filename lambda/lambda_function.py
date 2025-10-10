import csv
import hashlib
import io
import json
import logging
import os
import time
from typing import Tuple

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


def build_geojson(rows: list) -> geojson.FeatureCollection:
    """Convert rows to GeoJSON FeatureCollection."""
    features = []
    for row in rows:
        try:
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
            print(f"Skipping invalid row: {e}")

    return geojson.FeatureCollection(features)


def lambda_handler(event, context) -> dict:
    try:
        """Handle requests for routes by airport or airline."""

        # Lambda event vars
        params = event.get("queryStringParameters") or {}
        path = event.get("rawPath")
        src_airport = params.get("airport")
        airline_code = params.get("airline_code")

        # If no codes
        if not src_airport and not airline_code and path == "/routes":
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing parameter"}),
            }

        # Query params handling
        if path == "/routes":
            base_query = "SELECT * FROM flights"
            if src_airport:
                query = base_query + f" WHERE src_airport = '{src_airport}'"
            if airline_code:
                query = base_query + f" WHERE airline_code = '{airline_code}'"

        if path == "/airlines":
            if airline_code:
                query = f"SELECT * FROM airlines WHERE airline_code = '{airline_code}'"
            else:
                query = "SELECT * FROM airlines"

        # Create hash key for the query
        query_hash = hashlib.sha256(query.encode()).hexdigest()

        # Check cache
        cached = dynamo_table.get_item(Key={"query_hash": query_hash}).get("Item")
        if cached and "results" in cached:
            logger.info("Cache hit")
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": cached["results"],
            }

        # If not cached, see if there's an ongoing query
        if cached and "query_id" in cached:
            query_id = cached["query_id"]
            exec_info = athena.get_query_execution(QueryExecutionId=query_id)
            state = exec_info["QueryExecution"]["Status"]["State"]

            if state == "SUCCEEDED":

                # Get path and update dynamo db record
                bucket, s3_result_key = get_query_result_path(query_id)

                # Update dynamo record
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

                # Return geojson
                if path == "/routes":
                    geojson_data = build_geojson(rows)
                    result_json = geojson.dumps(geojson_data)

                # Return json
                if path == "/airlines":
                    result_json = json.dumps(
                        {rows["airline_code"]: row["name"] for row in rows}
                    )

                # Return data
                return {
                    "statusCode": 200,
                    "headers": {"Content-Type": "application/json"},
                    "body": result_json,
                }

            elif state in ["RUNNING", "QUEUED"]:
                return {
                    "statusCode": 202,
                    "body": json.dumps({"status": "processing", "query_id": query_id}),
                }

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
        return {
            "statusCode": 202,
            "body": json.dumps({"status": "started", "query_id": query_id}),
        }

    except Exception as e:
        logger.exception("Lambda failed")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
