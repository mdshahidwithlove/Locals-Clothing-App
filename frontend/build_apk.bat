@echo off
set "ANDROID_HOME=C:\Users\lenovo\AppData\Local\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%

echo === Stopping all Gradle daemons ===
cd /d "%~dp0android"
call gradlew.bat --stop 2>nul
echo === Daemons stopped ===

echo === Building APK ===
call gradlew.bat assembleRelease --no-daemon
echo.
echo === BUILD COMPLETE ===
if exist app\build\outputs\apk\release\app-release.apk (
    echo SUCCESS! APK Location: %cd%\app\build\outputs\apk\release\app-release.apk
    copy /y "app\build\outputs\apk\release\app-release.apk" "%~dp0..\Locals-App-2026.apk"
    echo Copied APK to root: %~dp0..\Locals-App-2026.apk
) else (
    echo Checking for any APK...
    dir /s /b app\build\outputs\apk\*.apk 2>nul
)
