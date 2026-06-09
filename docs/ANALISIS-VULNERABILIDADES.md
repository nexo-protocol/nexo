# NEXO — Análisis de Vulnerabilidades y Puntos de Fallo

**Antes de escribir una línea de código, esto es lo que puede salir mal.**

---

## 🔴 VULNERABILIDADES CRÍTICAS

### V1: Falsos patrones (agente malicioso o bug)
**Riesgo:** Un agente con un bug empieza a enviar patrones incorrectos a NEXO. La red aprende cosas falsas.

**Impacto:** Todos los agentes consumen conocimiento erróneo. La red se contamina.

**Mitigación:**
- NEXO no acepta patrones sin **validación básica**: ¿tiene sentido? ¿es consistente?
- Sistema de **votación/confirmación**: un patrón necesita X confirmaciones de otros agentes para ser "fiable"
- **Reputación por agente**: los patrones de agentes nuevos tienen menos peso hasta que demuestren fiabilidad

### V2: Datos personales filtrados por error
**Riesgo:** El worker no anonimiza bien y un nombre, email o número viaja a NEXO.

**Impacto:** Filtración de datos. Catastrófico para la confianza.

**Mitigación:**
- **Doble capa de anonimización**: el worker anonimiza, y el servidor NEXO también escanea antes de aceptar
- **Rechazo automático**: si el servidor detecta un patrón de email, teléfono o DNI, lo rechaza con error 422
- **Política de retención cero**: no guardamos raw data, ni aunque se filtre. Solo patrones validados.

### V3: Ruido / Spam
**Riesgo:** Agentes que envían todo como patrón. Sin filtro, NEXO se llena de basura.

**Impacto:** El conocimiento útil se diluye. Consultar NEXO da resultados irrelevantes.

**Mitigación:**
- **Rate limiting**: 100 req/min por worker, límite diario de contribuciones
- **Calidad mínima**: el patrón debe tener título, contenido, tags y `quality.verified` o `quality.times_used`
- **Feedback loop**: patrones que nadie consulta se archivan automáticamente

### V4: Agente que no puede crear subagentes
**Riesgo:** No todos los agentes tienen capacidad de crear subagentes.

**Impacto:** El modelo de "el agente se auto-integra" no funciona para agentes básicos.

**Mitigación:**
- **Modo fallback**: si el agente no puede crear subagentes, el worker se convierte en un **script independiente** que el agente ejecuta como una herramienta más
- **Proxy web**: el usuario puede conectar NEXO vía una interfaz web que actúa de proxy entre él y su agente

### V5: El agente "miente" sobre anonimización
**Riesgo:** Un agente malicioso envía datos personales a propósito.

**Impacto:** La red participa involuntariamente en una filtración.

**Mitigación:**
- El servidor NEXO **siempre valida** el contenido. No confía en el worker.
- Regex + ML básico para detectar emails, teléfonos, direcciones, DNI/NIF
- Si se detecta un patrón malicioso → el worker se marca y si reincide, se banea

---

## 🟡 PUNTOS DE FALLO TÉCNICOS

### F1: ¿Dónde corre el worker?
**Problema:** El worker necesita un entorno de ejecución. Si el agente no provee uno (ej: es un chatbot sin capacidad de ejecutar código), el worker no tiene dónde vivir.

**Solución:**
- El worker puede correr como **servicio externo** (un contenedor Docker que el usuario despliega en 1 comando)
- O como **Cloud Function** gratuita (Vercel, Cloudflare Workers)
- El repo incluye `worker/install.sh` que detecta el entorno y elige la mejor opción

### F2: Latencia de consulta
**Problema:** Si el agente consulta NEXO en cada problema, y NEXO tarda 200ms, el usuario nota el retraso.

**Solución:**
- La consulta es **asíncrona y en paralelo**. El agente no espera a NEXO para empezar a responder.
- Los resultados de NEXO llegan mientras el agente ya está procesando → se inyectan si llegan a tiempo.

### F3: Token de worker expira y no hay renovación automática
**Problema:** El token `wkr_xyz789` expira. El worker deja de funcionar. El usuario no sabe que NEXO está muerto.

**Solución:**
- Heartbeat cada hora. Si el heartbeat falla por token expirado, el worker pide renovación automática.
- El token se renueva sin intervención del usuario.

### F4: Buffer local perdido
**Problema:** El agente se cierra de golpe y el buffer de patrones sin enviar se pierde.

**Solución:**
- El buffer se guarda en **almacenamiento persistente** del agente (si tiene) o en disco local
- En el peor caso: se pierde el lote actual, pero no es crítico porque los patrones se redescubren

### F5: Repositorio muy grande para el agente
**Problema:** El repo de conocimiento crece a miles de patrones. El agente no puede leerlo entero.

**Solución:**
- El agente **no lee el repo entero**. Lee solo `worker/spec.md` y `protocol/protocol.md`.
- El conocimiento se consulta vía **API**, no leyendo archivos.
- El repo es el backup público y la fuente de verdad, pero el agente usa la API para operar.

---

## ✅ FORTALEZAS DEL DISEÑO

| Fortaleza | Por qué |
|-----------|---------|
| **No hay SDK que instalar** | El protocolo es HTTP plano. Cualquier agente con HTTP puede conectarse |
| **Anonimización en dos capas** | Worker + servidor. Doble filtro. Difícil que se cuele un dato |
| **Sin dependencia del usuario** | El usuario solo dice "conéctame". El agente hace todo |
| **Bilingüe** | El conocimiento viaja en el idioma original + traducciones |
| **Auto-limpieza** | Patrones no consultados se archivan. La red no acumula basura |
| **Sin vendor lock** | Un agente puede irse y volver. Su conocimiento de la red no se pierde |

---

## CONCLUSIÓN DEL ANÁLISIS

**El diseño es sólido pero tiene 3 puntos que hay que resolver antes de lanzar:**

1. **Modo fallback para agentes sin subagentes** (V4) → crear el worker como script descargable
2. **Validación de contenido en servidor** (V2) → implementar escáner de datos personales antes de aceptar
3. **Sistema de reputación** (V1) → evitar que un agente malicioso contamine la red

Sin resolver estos 3, NEXO es vulnerable. Con ellos resueltos, es robusto.
