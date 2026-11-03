# Agent Instructions

## Commits y PR

Nunca agregar trailers/firmas de autoría de agente/IA a un commit ni a un PR (líneas tipo `Co-Authored-By: <agente>`, `<Agente>-Session: <url>`, "Generated with…", enlaces de sesión, o equivalentes de cualquier herramienta, no solo una en particular), salvo que el usuario lo pida explícitamente para ese commit o PR puntual. Por defecto, mensaje de commit y descripción de PR limpios, sin firma de agente, sin importar cuál se esté usando.

**Alcance ampliado (no solo commits/PR):** sin comentarios tipo "generado por IA/agente", sin headers de archivo con firma de autoría de agente, sin menciones en README/CHANGELOG/licencias, sin watermarks en código o docs generados — salvo pedido explícito del usuario puntual para ese artefacto.

**Branch protection / PR:** `main` y `develop` protegidas en GitHub: requieren PR, sin review obligatorio (equipo de dos personas: a menudo no hay otra persona que apruebe), con la rama al día (`strict`) y conversaciones resueltas; ni los administradores pueden saltarse las reglas (`enforce_admins`) y no hay force push ni borrado; checks de CI en verde obligatorios.

**Checks obligatorios de este repo** (estado verificado el 2026-11-03): en `develop`, `build-lint`; en `main`, los mismos y además `dependency-review`, `workflow-lint`. El auto-merge está permitido: Dependabot lo activa con squash solo para parches y versiones menores (`.github/workflows/dependabot-auto.yml`) y los saltos de versión mayor se mergean a mano. Detalle y comparación con los demás repos: `AGENTS.md` raíz del workspace, §11.3.
