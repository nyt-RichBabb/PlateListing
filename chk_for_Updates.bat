:: check for new data
@echo off
setlocal enabledelayedexpansion
c:
cd \plate-listing


:: Get updated JPS file
call :timestamp
echo !timestamp! Get JPS.xml...
node fetchJPS.js >nul 2>&1
::
del tmp\before.txt
move tmp\now.txt tmp\before.txt >nul 2>&1

:: Parse JPS
call :timestamp
echo !timestamp! Parse JPS... 
node parseJPS.js > tmp\now.txt
call :timestamp
echo !timestamp! Compare...
node compareNowB4.js > tmp\chk_4_new.txt
node lookupNprocess.js
call :timestamp
Echo !timestamp! Done!
goto :end

:: get the current timestamp
:timestamp
for /f "tokens=1-4 delims= " %%a in ('echo %date% %time%') do (
  set "dow=%%a"
  set "bdate=%%b"
  set "btime=%%c"
)

:: Set the timestamp variable
set "timestamp=!bdate! - !dow! - !btime!"
:end