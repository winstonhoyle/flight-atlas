rm -rf build
mkdir build
pip install --upgrade pip
pip install -r requirements.txt -t build/
cp lambda_function.py build/
cd build
zip -r9 ../lambda_package.zip .