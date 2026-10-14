from functools import cache

import boto3


@cache
def athena():
    return boto3.client("athena")


@cache
def s3():
    return boto3.client("s3")


@cache
def glue():
    return boto3.client("glue")


@cache
def table(name: str):
    return boto3.resource("dynamodb").Table(name)
