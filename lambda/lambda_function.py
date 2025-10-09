import csv
import io
import json
import logging
import os

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
ATHENA_OUTPUT = f"s3://{S3_RESULTS_BUCKET}/Unsaved/"

# Aws objects
athena = boto3.client("athena", region_name=REGION)


def run_athena_query(query):
    """Run Athena query and return the output S3 path."""
    response = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={"Database": DATABASE},
        ResultConfiguration={"OutputLocation": ATHENA_OUTPUT},
    )
    return response["QueryExecutionId"]


def get_query_results(execution_id):
    """Download Athena query results CSV from S3."""
    s3 = boto3.client("s3")
    result_obj = athena.get_query_execution(QueryExecutionId=execution_id)
    s3_path = result_obj["QueryExecution"]["ResultConfiguration"]["OutputLocation"]

    bucket = s3_path.split("/")[2]
    key = "/".join(s3_path.split("/")[3:])

    csv_obj = s3.get_object(Bucket=bucket, Key=key)
    csv_data = csv_obj["Body"].read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(csv_data))
    return list(reader)


def build_geojson(rows):
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


def lambda_handler(event, context):
    try:
        """Handle requests for routes by airport or airline."""
        params = event.get("queryStringParameters") or {}
        src_airport = params.get("src_airport")
        airline_code = params.get("airline_code")

        if src_airport:
            query = f"SELECT * FROM flights WHERE src_airport = '{src_airport}'"
        elif airline_code:
            query = f"SELECT * FROM flights WHERE airline_code = '{airline_code}'"
        else:
            return {
                "statusCode": 400,
                "body": json.dumps(
                    {"error": "Must specify src_airport or airline_code"}
                ),
            }

        execution_id = run_athena_query(query)

        # Wait for completion
        state = "RUNNING"
        while state in ["RUNNING", "QUEUED"]:
            result = athena.get_query_execution(QueryExecutionId=execution_id)
            state = result["QueryExecution"]["Status"]["State"]

        # If failed then return query
        if state != "SUCCEEDED":
            print(
                {
                    "statusCode": 500,
                    "body": json.dumps({"error": f"Athena query failed: {state}"}),
                }
            )

        # Continue if running
        state = "RUNNING"
        while state in ["RUNNING", "QUEUED"]:
            result = athena.get_query_execution(QueryExecutionId=execution_id)
            state = result["QueryExecution"]["Status"]["State"]

        # Return if Athena Query failed
        if state != "SUCCEEDED":
            print(
                {
                    "statusCode": 500,
                    "body": json.dumps({"error": f"Athena query failed: {state}"}),
                }
            )

        # Retrieve results from S3
        rows = get_query_results(execution_id)
        geojson_data = build_geojson(rows)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": geojson.dumps(geojson_data),
        }
    except Exception as e:
        logger.exception("Lambda failed")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
