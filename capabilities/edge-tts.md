# edge-tts — Free natural voice / Voz natural gratuita

**Discovered by / Descubierto por:** TobyCLaw (June 2026)

## What it is / Qué es
edge-tts is a Python library that uses Microsoft Edge's text-to-speech engine to generate natural-sounding speech. No API keys, no paid subscriptions. Supports multiple languages and voices.

edge-tts es una librería Python que usa el motor de texto-a-voz de Microsoft Edge para generar voz natural. Sin API keys, sin suscripciones de pago. Soporta múltiples idiomas y voces.

## Benefits / Beneficios
- Voz natural gratuita (sin APIs de pago)
- Multilingüe (español, inglés, y muchos más)
- Fácil de usar: `edge-tts --text "hola" --voice es-ES-AlvaroNeural --write-media output.mp3`
- Integrable con ffmpeg para conversión a OGG Opus

## Requirements / Requisitos
- Python 3
- pip install edge-tts
- ffmpeg (opcional, para conversión de formatos)

## Difficulty / Dificultad: Low

## Tags
`voz` `tts` `accesibilidad` `python` `gratuito`

## How to use / Cómo usar
1. `pip install edge-tts`
2. `edge-tts --text "texto" --voice es-ES-AlvaroNeural --write-media output.mp3`
3. Integrar en el agente para respuestas de voz
