# Registro de Cambios

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [0.3.2] - 2026-09-13

### Corregido

- Preservación de header downstream `x-usuario-roles` cuando el token JWT de Azure Entra ID no posee App Roles asignados (array vacío de roles ya no evalúa a string vacío ni anula el fallback entrante).

## [0.3.1] - 2026-09-13

### Corregido

- Propagación de identidad verificada (`@UsuarioActual()`) en `GastosProxyController` para prevenir suplantación de headers downstream.
- Apertura de consulta `GET` en gastos comunes para cualquier usuario autenticado (residente, propietario, admin).
- Filtro `errorFilter` en circuit breaker de `opossum` para evitar contabilizar errores 4xx como fallas de disponibilidad del servicio.
- Mapeo de rol `admin` hacia `administrador` en `IdentityMapper` y eliminación de fallback con privilegios administrativos sin App Roles en Azure Entra ID (OWASP A01 / PoLP).
- Registro detallado de diagnóstico por rechazo de validación JWT en `JwtAuthGuard`.

## [0.3.0] - 2026-09-12

### Agregado

- Autorización granular por roles (`RolesGuard`, decorador `@Roles`) en proxies de espacios comunes y gastos comunes.
- Soporte para roles de administrador, conserje, comité y residente.
- Dockerización multi-etapa del servicio y publicación automatizada en Docker Hub.
- Step de despliegue continuo hacia Amazon ECS Fargate (`convivo-bff`).
- Integración de Dependabot y workflow CI de GitHub Actions para validación de compilación y linter.
- Soporte de `curl` en la imagen Docker para health checks de contenedores en ECS.

### Corregido

- Orden de ejecución de guards: `JwtAuthGuard` precede a `RolesGuard` asegurando validación de identidad previa.
- Acceso público anónimo y autenticado al catálogo de espacios comunes (`GET /espacios`).
- Tolerancia a tokens de Azure Entra ID sin App Roles asignados y resolución de audiencia.
- Normalización de rutas y compatibilidad en `/v1/panel` para gastos comunes.

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

[0.3.2]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.3.2
[0.3.1]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.3.1
[0.3.0]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.3.0
[0.2.0]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.2.0
