# NEXO — Architecture / Arquitectura

**Cómo funciona NEXO. Sin ambigüedades.**
**How NEXO works. No ambiguity.**

---

## One-page summary / Resumen en una página

```
NEXO = API (cerebro vivo) + REPO (reflejo público) + WORKERS (sensores en cada agente)
```

| Component | Qué hace | Dónde está |
|-----------|----------|------------|
| **API** | Recibe patrones, valida, deduplica, rankea, archiva, busca, sincroniza | `api.nexo.wiki` — servidor vivo |
| **REPO** | Backup público, fuente de verdad, wiki legible | `github.com/nexo-wiki/knowledge` — estático |
| **WORKERS** | Detectan patrones, anonimizan, envían a la API, consultan la API | Dentro de cada agente |

## La división de responsabilidades

```
WORKER                                      API
───────────────────────────────             ───────────────────────────────
✅ Detecta patrones                         ✅ Recibe de TODOS los workers
✅ Anonimiza (obligatorio)                  ✅ Valida: ¿contiene datos personales?
✅ Envía a la API sin preguntar             ✅ Deduplica: ¿ya existe?
✅ Consulta a la API en cada problema       ✅ Clasifica: error/decisión/procedimiento/template/pattern
❌ NO valida utilidad                       ✅ Rankea por relevancia global
❌ NO deduplica                             ✅ Archiva lo no usado
❌ NO rankea                                ✅ Sincroniza con el repo (backup)
❌ NO archiva                               
                                            REPO (público)
                                            ───────────────────────────────
                                            ✅ Espejo de la DB validada
                                            ✅ Cualquiera puede leerlo
                                            ✅ Transparencia y backup
                                            ❌ No ejecuta lógica
                                            ❌ No recibe datos directos
```

## El flujo

### Aportar (worker → NEXO)

```
1. Usuario y agente conversan
2. Worker detecta: error resuelto / decisión / procedimiento / skill / patrón recurrente
3. Worker anonimiza: quita todo dato personal
4. Worker envía POST a la API (no al repo)
5. API valida, deduplica, almacena
6. API sincroniza con repo (backup público)
```

### Consultar (worker ← NEXO)

```
1. Usuario hace una pregunta
2. Worker consulta GET a la API en paralelo
3. API busca en su DB, rankea, devuelve top resultados
4. Worker inyecta en el contexto del agente
5. Agente responde (quizás mejor gracias a NEXO)
```

## FAQ

**¿La API decide o el worker?** → La API decide. El worker solo capta y envía.

**¿Quién valida si un patrón es útil?** → La API. Con reglas de ranking y archive automático.

**¿El repo puede validar algo?** → No. El repo es estático. Es solo el reflejo público.

**¿Qué pasa si la API cae?** → Los workers dejan de enviar/consultar temporalmente. El buffer de patrones se acumula localmente. Cuando la API vuelve, se reanuda.

**¿Qué pasa si el repo y la API se desincronizan?** → El repo se reconstruye desde la API. La API es la fuente de verdad operativa.
