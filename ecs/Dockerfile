# Use an official Python base image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt ./

# Install dependencies
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy the script
COPY create_routes.py .

# Default command to run the script
CMD ["python", "create_routes.py"]
