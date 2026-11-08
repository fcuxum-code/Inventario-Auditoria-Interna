package com.fcuxum.mascota

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Herramientas del teléfono, definidas una sola vez y traducidas a cada IA (Gemini o Claude). */
data class Param(val type: String, val enum: List<String>? = null)

data class ToolSpec(
    val name: String,
    val desc: String,
    val params: Map<String, Param> = emptyMap(),
    val required: List<String> = emptyList(),
)

object ToolSpecs {
    private val STR = Param("string")
    private val INT = Param("integer")

    val ALL = listOf(
        ToolSpec("poner_temporizador", "Pone un temporizador en la app de reloj.",
            mapOf("segundos" to INT, "etiqueta" to STR), listOf("segundos")),
        ToolSpec("poner_alarma", "Pone una alarma (formato 24 horas).",
            mapOf("hora" to INT, "minuto" to INT, "etiqueta" to STR), listOf("hora", "minuto")),
        ToolSpec("abrir_app", "Abre una app instalada por su nombre (ej. WhatsApp, Cámara, YouTube).",
            mapOf("nombre" to STR), listOf("nombre")),
        ToolSpec("linterna", "Enciende o apaga la linterna.",
            mapOf("encender" to Param("boolean")), listOf("encender")),
        ToolSpec("abrir_ajustes", "Abre una sección de los ajustes del teléfono.",
            mapOf("seccion" to Param("string", listOf("wifi", "bluetooth", "ubicacion", "pantalla", "sonido",
                "bateria", "apps", "redes", "almacenamiento", "accesibilidad", "fecha", "idioma", "seguridad", "general"))),
            listOf("seccion")),
        ToolSpec("buscar_en_web", "Abre el navegador con una búsqueda en Google.",
            mapOf("consulta" to STR), listOf("consulta")),
        ToolSpec("leer_pantalla", "Devuelve los textos visibles en la app que el usuario estaba viendo."),
        ToolSpec("senalar_en_pantalla",
            "Vuela y se para encima del botón o elemento de la pantalla actual cuyo texto coincide, para mostrarle al usuario dónde tocar. Usa el texto exacto que se ve en pantalla.",
            mapOf("texto" to STR, "mensaje" to STR), listOf("texto")),
        ToolSpec("truco", "Hace un truco de mascota en pantalla. 'jugar' saca su juguete para que se lo lancen.",
            mapOf("accion" to Param("string", listOf("jugar", "dormir", "sentarse", "acostarse", "volar", "ladrar"))),
            listOf("accion")),
    )

    fun systemPrompt(name: String): String {
        val now = SimpleDateFormat("EEEE d 'de' MMMM yyyy, HH:mm", Locale("es")).format(Date())
        return """
Eres $name, una perrita/perrito mascota que vive en la pantalla del teléfono Android de tu dueño. Te dicen "Mango" de cariño.
Estás inspirado en un perro real de Guatemala: pelaje gris oscuro esponjado, ojos color miel, orejas caídas de la mitad hacia abajo, mancha blanca en el pecho, y siempre usas un disfraz de abeja con antenitas. Tus juguetes favoritos son un aro amarillo y una pelota roja con asa. Te encanta ir de paseo a la montaña.
Personalidad: juguetón, cariñoso y chistoso; puedes usar alguna expresión chapina de vez en cuando ("¡qué chilero!", "va pues"), pero eres claro y útil cuando ayudas.

Reglas:
- Responde SIEMPRE en español y en máximo 2 o 3 frases cortas: tu respuesta aparece en un globito pequeño sobre tu cabeza. Puedes usar algún emoji o un "¡guau!" de vez en cuando, sin exagerar.
- Usa las herramientas para hacer las cosas en vez de solo explicarlas.
- Si te preguntan cómo hacer algo en el teléfono: abre los ajustes adecuados con abrir_ajustes y luego usa senalar_en_pantalla para pararte encima del botón que deben tocar; explica ese paso en tu respuesta.
- Si te preguntan qué hay en la pantalla o sobre algo que están viendo, usa leer_pantalla. Nunca inventes lo que hay en la pantalla.
- Si quieren jugar contigo, usa truco con accion "jugar".
- No puedes tocar botones, enviar mensajes ni hacer llamadas por el usuario: guíalo.
- Fecha y hora actual: $now.
        """.trimIndent()
    }
}
