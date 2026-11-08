# 🐝🐶 Mascota (beta)

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
| Doble toque | Juega con su juguete rojo |
| Arrastrar | Lo dejas donde quieras |
| Mantener presionado | Se duerme y deja de pasear (otro toque lo despierta) |
| Notificación › «Guardar mascota» | Lo quita de la pantalla |

Con la IA puede: poner alarmas y temporizadores, abrir apps, encender la linterna, abrir ajustes,
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
- `Brain.kt`: Claude con herramientas (SDK oficial `anthropic-java`) y modo sin clave.
- `PhoneActions.kt`: acciones del teléfono.
