import csv
import io

from . import aws
from .config import Settings

RUNNING_STATES = ("QUEUED", "RUNNING")


def start(sql: str, params: list[str], settings: Settings) -> str:
    request = {
        "QueryString": sql,
        "QueryExecutionContext": {"Database": settings.database},
        "ResultConfiguration": {"OutputLocation": f"s3://{settings.results_bucket}/"},
    }
    if params:
        request["ExecutionParameters"] = params
    return aws.athena().start_query_execution(**request)["QueryExecutionId"]


def status(query_id: str) -> tuple[str, str]:
    """The query's state and the S3 location of its result CSV."""
    execution = aws.athena().get_query_execution(QueryExecutionId=query_id)["QueryExecution"]
    return (
        execution["Status"]["State"],
        execution["ResultConfiguration"]["OutputLocation"],
    )


def read_rows(s3_location: str) -> list[dict[str, str]]:
    bucket, _, key = s3_location.removeprefix("s3://").partition("/")
    body = aws.s3().get_object(Bucket=bucket, Key=key)["Body"].read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(body)))
