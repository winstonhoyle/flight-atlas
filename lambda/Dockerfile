FROM public.ecr.aws/lambda/python:3.14

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY lambda_function.py ${LAMBDA_TASK_ROOT}

CMD ["lambda_function.lambda_handler"]
