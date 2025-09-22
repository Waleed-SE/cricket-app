@echo off
echo Starting Cricket Scoring Application...
echo.

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting the application...
echo.
echo Control Panel: http://localhost:5000/control
echo Live Display:  http://localhost:5000/display
echo.

python app.py