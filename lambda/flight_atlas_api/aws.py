from functools import cache

import boto3


@cache
def s3():
    return boto3.client("s3")
