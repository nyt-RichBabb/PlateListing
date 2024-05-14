:: Start BenderWatch
@echo off

:: SET PM2 Home Directory
set PM2_HOME=C:\plate-listing\ENV
set PATH=C:\plate-listing\ENV\npm;%PATH%

setlocal enabledelayedexpansion

cd /d "c:\plate-listing"

set Bend="UNC2BenderWatch.log"
set logdir=logs
set Bendlog=%logdir%/%Bend%

:: get the current timestamp
for /f "tokens=1-4 delims= " %%a in ('echo %date% %time%') do (
  set "dow=%%a"
  set "bdate=%%b"
  set "btime=%%c"
)
:: Set the timestamp variable
set "timestamp=!bdate! - !dow! - !btime!

net use \\nwx.nyt.net\NelaInput /User:ent\nycp-svc-nwx "Pl@tero0m123"


:: UNC2BenderWatch
echo %timestamp% Starting Bender Watch... >> %Bendlog% 2>&1
start /B pm2 start UNC2BenderWatch.js --log %Bendlog% --error %Bendlog%