#!/usr/bin/env bash
# Prueba automática: instala la app en un Android virtual, suelta a Mangobeja,
# le lanza el juguete y toma capturas de pantalla.
set -x
APK=mascota-perro/mascota-perro-beta.apk
OUT=capturas
mkdir -p $OUT
adb install -r $APK
adb shell appops set com.fcuxum.mascota SYSTEM_ALERT_WINDOW allow
adb shell pm grant com.fcuxum.mascota android.permission.POST_NOTIFICATIONS || true
adb logcat -c
adb shell am start -n com.fcuxum.mascota/.MainActivity
sleep 4
adb exec-out screencap -p > $OUT/00-ajustes.png
adb shell am start -n com.fcuxum.mascota/.MainActivity --ez autostart true --es demo fetch
sleep 2
adb shell input keyevent KEYCODE_HOME
for i in $(seq -w 1 16); do
  sleep 1.2
  adb exec-out screencap -p > $OUT/$i.png
done
adb logcat -d > $OUT/logcat.txt
grep -E "Mangobeja|AndroidRuntime|FATAL" $OUT/logcat.txt | tail -60 || true
exit 0
