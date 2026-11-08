# 🐝🐶 Mangobeja (beta)

Un perrito con disfraz de abeja, basado en un perro real, que vive **encima de tus apps** en Android:
pasea por la pantalla, se posa sobre los botones, juega con su juguete rojo y, con una clave de IA (Claude),
te ayuda con el teléfono.

## Instalar en el teléfono

1. En el teléfono, abre la última beta:
   https://github.com/fcuxum-code/Inventario-Auditoria-Interna/releases/tag/mascota-beta
2. Descarga `mascota-perro-beta.apk` y ábrelo. Android pedirá permitir instalar desde el navegador: acéptalo.
3. Abre la app **Mascota** y:
   - toca **1. Permitir que aparezca sobre otras apps**,
   - (opcional) toca **2. Activar ayuda en pantalla**. Busca «Mascota» en Accesibilidad. Si dice
     «Configuración restringida»: Ajustes › Apps › Mascota › menú ⋮ › «Permitir configuración restringida»,
   - (opcional) pega tu clave de la API de Claude (console.anthropic.com),
   - toca **¡Soltar a …!**

## Cómo se usa

| Gesto | Qué hace |
|---|---|
| Un toque | Abre la cajita para hablarle (texto o micrófono) |
| Doble toque | Saca su juguete (aro, pelota o hueso). Deslízalo hacia arriba para lanzarlo: se aleja, Mango corre por él y te lo trae |
| Arrastrar | Lo dejas donde quieras |
| Mantener presionado | Se duerme y deja de pasear (un toque lo despierta, también de noche) |
| Notificación › «Guardar mascota» | Lo quita de la pantalla |

Ladra de vez en cuando (de noche solo si juegas con él); en la app puedes **grabar el ladrido real** de tu perro.

Cerebro: **Gemini gratis** (clave en aistudio.google.com), **Claude** (de pago) o sin IA. Con IA puede: poner alarmas y temporizadores, abrir apps, encender la linterna, abrir ajustes,
buscar en internet, **leer lo que hay en pantalla** cuando se lo pides, y **volar hasta el botón que
tienes que tocar** para enseñarte cómo hacer algo.

Sin clave entiende frases simples: «enciende la linterna», «alarma 6:30», «temporizador 5 minutos», «abre WhatsApp».

Privacidad: solo lee la pantalla cuando se lo pides; si aparece un campo de contraseña se esconde y no lee nada.

## Para desarrolladores

App Android nativa en Kotlin, sin dependencias de AndroidX. El APK lo compila GitHub Actions
(`.github/workflows/mascota-apk.yml`) en cada push a la rama y lo publica en la beta `mascota-beta`.

- `PetView.kt`: dibujo y animaciones del perro (vectores en código).
- `PetService.kt`: ventana flotante sin marco, comportamiento, toques y globito de diálogo.
- `ScreenReaderService.kt`: accesibilidad opcional (botones en pantalla, leer y señalar).
- `Brain.kt`, `GeminiBrain.kt`, `ClaudeBrain.kt`, `ToolSpecs.kt`: cerebros con herramientas del teléfono y modo sin IA.
- `Toys.kt`, `Sounds.kt`: juguetes y ladridos (`tools/generar_sonidos.py` genera los WAV).
- `ci/prueba-emulador.sh`: prueba en Android virtual; capturas en la release `mascota-pruebas`.
- `PhoneActions.kt`: acciones del teléfono.
