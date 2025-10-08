#!/bin/bash
set -e

# 1. Clean old builds
rm -rf build lambda_package.zip
mkdir -p build

# 2. Install dependencies into build folder
pip install -r requirements.txt -t build/

# 3. Copy your Lambda function code into build folder
cp create_routes.py build/

# 4. Zip everything
cd build
zip -r ../../infra/lambda_package.zip .
cd ..

echo "Lambda package created: lambda_package.zip"
