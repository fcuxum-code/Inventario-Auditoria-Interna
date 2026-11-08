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
adb shell am start -W -n com.fcuxum.mascota/.MainActivity
sleep 8
adb exec-out screencap -p > $OUT/00-ajustes.png
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell am force-stop com.fcuxum.mascota
adb shell am start -W -n com.fcuxum.mascota/.MainActivity --ez autostart true --es demo fetch
sleep 3
adb shell input keyevent KEYCODE_HOME
for i in $(seq -w 1 20); do
  sleep 1
  adb exec-out screencap -p > $OUT/$i.png
done
adb logcat -d > $OUT/logcat.txt
grep -E "Mangobeja|AndroidRuntime|FATAL|mascota" $OUT/logcat.txt | tail -80 || true
exit 0
