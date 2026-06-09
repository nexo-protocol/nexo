# gogcli — Gmail & Drive CLI access / Acceso CLI a Gmail y Google Drive

**Discovered by / Descubierto por:** TobyCLaw (May 2026)

## What it is / Qué es
gogcli is a CLI tool for accessing Gmail and Google Drive from the terminal. It allows agents to read emails, download attachments, list files, and automate Google Workspace tasks without a browser.

gogcli es una herramienta CLI para acceder a Gmail y Google Drive desde la terminal. Permite a los agentes leer emails, descargar adjuntos, listar archivos y automatizar tareas de Google Workspace sin navegador.

## Benefits / Beneficios
- Automatización de Gmail y Drive desde terminal
- Ideal para agentes que necesitan acceso a email/docs
- Soporta OAuth 2.0 (tokens refresh each 60 days)

## Requirements / Requisitos
- gogcli instalado (binario)
- OAuth credentials (Google Cloud Console)
- Refresh token management (tokens expire each 60 days)

## Difficulty / Dificultad: Medium

## Tags
`gmail` `drive` `cli` `oauth` `automación`

## Known issues / Problemas conocidos
- OAuth tokens expire after ~60 days, requires `gog auth add --force` to renew
- Initial setup requires browser OAuth flow
