FROM public.ecr.aws/lambda/python:3.14

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY flight_atlas_api/ ${LAMBDA_TASK_ROOT}/flight_atlas_api/

CMD ["flight_atlas_api.handler.lambda_handler"]
