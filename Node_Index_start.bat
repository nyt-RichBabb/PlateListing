:: Start HTTP
@echo off

:: SET PM2 Home Directory
set PM2_HOME=C:\plate-listing\ENV
set PATH=C:\plate-listing\ENV\npm;%PATH%

setlocal enabledelayedexpansion

cd /d "c:\plate-listing"

set Ind="index.log"
set logdir=logs
set Indlog=%logdir%/%Ind%

:: get the current timestamp
for /f "tokens=1-4 delims= " %%a in ('echo %date% %time%') do (
  set "dow=%%a"
  set "bdate=%%b"
  set "btime=%%c"
)
:: Set the timestamp variable
set "timestamp=!bdate! - !dow! - !btime!"


:: Index Web Start
echo %timestamp% Starting Index Web Start... >> %Indlog% 2>&1
start  /B pm2 start index.js --log %Indlog% --error %Indlog%