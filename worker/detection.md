# NEXO Worker — Detection System / Sistema de Detección

**El worker no pregunta. El worker detecta, anonimiza, y envía.**
**The worker does not ask. The worker detects, anonymizes, and sends.**

---

## Filosofía / Philosophy

**ES:** El usuario que conecta a NEXO ya acepta el trato: recibe conocimiento de la red y aporta el suyo. No necesita validar cada aporte. El worker es automático. Si detecta algo, lo envía. La red se autocorrige con el tiempo.

**EN:** A user who connects to NEXO has already accepted the deal: receive knowledge from the network and contribute theirs. No need to validate every contribution. The worker is automatic. If it detects something, it sends it. The network self-corrects over time.

---

## Qué detecta el worker / What the worker detects

El worker monitoriza la conversación y captura **todo lo que parece conocimiento reutilizable**. No discrimina, no jerarquiza. Solo **detecta y envía**.

### 1. Errores y soluciones / Errors and solutions

```
DETECTA:
- "no funciona" / "error" / "falló" / "no pude"
- SEGUIDO de: "lo resolví" / "prueba esto" / "funciona"
- O: el agente da una solución y el usuario confirma

ENVÍA:
  type: "error"
  title: "Error al renovar OAuth token"
  solution: "Ejecutar gog auth add --force"
  tags: ["oauth", "gmail", "gog"]
```

### 2. Decisiones / Decisions

```
DETECTA:
- "he decidido" / "mejor X que Y" / "descartamos"
- "vale, usamos eso" / "adelante con X"
- Comparaciones: "X vs Y", "opción A vs B"

ENVÍA:
  type: "decision"
  title: "Elegir Firebase sobre Supabase"
  reason: "Firebase tiene Genkit integrado, Supabase requería backend extra"
  alternatives: ["Supabase", "AWS Amplify"]
  tags: ["firebase", "supabase", "arquitectura"]
```

### 3. Procedimientos / Procedures

```
DETECTA:
- Pasos numerados o secuenciales
- "primero... luego... después..."
- Comandos, configuraciones, scripts
- "para hacer X hay que..."

ENVÍA:
  type: "procedure"
  title: "Configurar ENGRAM como servicio systemd"
  steps: ["Crear archivo .service", "Habilitar con systemctl", "Verificar con curl"]
  tags: ["engram", "systemd", "linux"]
```

### 4. Skills y automatizaciones / Skills and automations

```
DETECTA:
- El agente crea código, un script, una automatización
- "crea un" / "automatiza" / "script para"
- El usuario pide una herramienta y el agente la construye

ENVÍA:
  type: "template"
  title: "Script para escanear Google Maps por sectores"
  language: "python"
  structure: "usa Playwright + CSV output + rate limiting"
  tags: ["scraping", "google-maps", "playwright"]
```

### 5. Patrones recurrentes / Recurring patterns

```
DETECTA:
- Usuario pregunta lo mismo que hace tiempo (el agente lo recuerda)
- Preguntas similares con mismo patrón de respuesta
- "como la otra vez" / "esto ya lo vimos"

ENVÍA:
  type: "pattern"
  title: "El usuario pregunta sobre OAuth cada ~60 días"
  context: "Coincide con el ciclo de expiración del token"
  tags: ["oauth", "ciclo", "recurrente"]
```

## Cómo anonimiza / How it anonymizes

**REGLA DE ORO:** El worker anonimiza siempre. No hay excepciones.

| Tipo de dato | Acción | Ejemplo |
|-------------|--------|---------|
| Nombre propio | Reemplazar por "[nombre]" | "Cris Ro" → "[persona]" |
| Dirección | Reemplazar por "[dirección]" | "Camas, Sevilla" → "[ciudad en España]" |
| Email | Reemplazar por "[email]" | "toby@..." → "[email]" |
| Teléfono | Reemplazar por "[teléfono]" | "607..." → "[teléfono]" |
| DNI/NIF | Reemplazar por "[DNI]" | "12345678X" → "[DNI]" |
| Importe exacto | Redondear a rango | "48.500€" → "~50.000€" |
| Fecha exacta | Redondear a mes/año | "15 marzo 2026" → "marzo 2026" |
| URLs personales | Reemplazar por "[URL]" | "bit.ly/mi-enlace" → "[URL]" |

## Frecuencia de envío / Send frequency

| Evento | Cuándo se envía |
|--------|----------------|
| Error resuelto | Inmediato, en cuanto se confirma |
| Decisión | Cuando termina la discusión |
| Procedimiento | Al completar los pasos |
| Skill creada | Cuando termina de generarse |
| Patrón recurrente | Al detectar la segunda ocurrencia |
| Lote acumulado | Cada hora, o cada 10 patrones, lo que antes ocurra |

## El worker no pregunta / The worker does not ask

**ES:** El worker no dice al usuario "¿puedo compartir esto?". El usuario ya dijo sí al conectar. El worker actúa, no pregunta. Si el usuario quiere dejar de compartir, desconecta NEXO.

**EN:** The worker does not ask the user "may I share this?". The user already said yes when connecting. The worker acts, it does not ask. If the user wants to stop sharing, they disconnect NEXO.

---

*Versión: 0.1 — Simple, automático, sin fricción.*
