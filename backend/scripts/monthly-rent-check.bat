@echo off
REM Monthly Rent Payment Request Checker
REM Schedule this to run on the 1st of every month at 9:00 AM

cd /d "C:\Users\Andrews Razer Laptop\Desktop\onlyjobs-desktop\Landlord-Dashboard\backend"
node scripts\monthly-rent-check.js >> logs\rent-check.log 2>&1

echo Rent check completed at %date% %time% >> logs\rent-check.log