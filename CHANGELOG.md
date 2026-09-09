# Registro de Cambios

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [0.2.0] - 2026-09-09

### Agregado

- Endpoint `GET /api/v1/panel`: agrega reservas (espacios comunes) y gastos
  comunes del usuario autenticado en una sola respuesta (RF-T.7).
- Circuit breaker independiente por microservicio (`opossum`) envolviendo
  `forwardGastos`/`forwardEspacios`.

### Corregido

- TimeLimiter del circuit breaker bajado a 2s (antes 10s por defecto).
- Fallback 503 explícito (`ServiceUnavailableException`) cuando el circuit
  breaker está abierto, en vez de dejar la promesa rechazada sin manejar.

[0.2.0]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.2.0
