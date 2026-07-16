@echo off
set JAVA_HOME=C:\PROGRA~1\ECLIPS~1\jdk-17.0.19.10-hotspot
set ANDROID_HOME=C:\AndroidSDK
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%

:: Sequential compilation for CMake to prevent OOM
set CMAKE_BUILD_PARALLEL_LEVEL=1
set NODE_OPTIONS=--max-old-space-size=1024
set GRADLE_OPTS=-Xmx1024m -XX:MaxMetaspaceSize=256m -XX:+UseSerialGC -XX:TieredStopAtLevel=1

echo Deleting old APKs...
if exist "c:\X-DATA\Chirag Sekhar\zomato-clothing\app-release.apk" del /q "c:\X-DATA\Chirag Sekhar\zomato-clothing\app-release.apk"
if exist "c:\X-DATA\Chirag Sekhar\zomato-clothing\frontend\android\app\build\outputs\apk\release\app-release.apk" del /q "c:\X-DATA\Chirag Sekhar\zomato-clothing\frontend\android\app\build\outputs\apk\release\app-release.apk"

echo Building APK using optimized memory and parallelization settings...
cd /d "c:\X-DATA\CHIRAG~1\zomato-clothing\frontend\android"
call .\gradlew.bat assembleRelease

if exist "app\build\outputs\apk\release\app-release.apk" (
    echo Copying generated APK to workspace root...
    copy /y "app\build\outputs\apk\release\app-release.apk" "c:\X-DATA\Chirag Sekhar\zomato-clothing\app-release.apk"
    echo APK successfully built and placed at root!
) else (
    echo Build failed or APK not found!
)

echo Done!
