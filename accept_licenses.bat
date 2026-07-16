@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot
set ANDROID_HOME=C:\AndroidSDK
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%

echo Accepting Android SDK licenses...
(for /L %%i in (1,1,100) do @echo y) | sdkmanager --licenses

echo Installing required SDK packages...
sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools" "ndk;27.1.12297006"

echo Done!
