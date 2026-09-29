# Registro de Cambios

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [0.4.2] - 2026-09-29

### Corregido

- `SECURITY.md` enlaza el formulario de reporte privado de vulnerabilidades, que además quedó habilitado en el repositorio (en 0.4.1 el documento remitía a un canal desactivado).

## [0.4.1] - 2026-09-29

### Seguridad

- Imagen Docker sin npm, npx, corepack ni yarn: el contenedor solo ejecuta `node` y esas herramientas de la imagen base traían 8 CVEs (7 HIGH, 1 MEDIUM). Escaneo Trivy de la imagen: 0 vulnerabilidades.
- Imagen base `node:22-alpine` fijada por digest en las tres etapas del build; Dependabot mantiene el digest actualizado.
- actionlint en CI se ejecuta desde la imagen oficial fijada por digest, en vez de descargar y ejecutar un script remoto.
- Nueva política de seguridad (`SECURITY.md`) con canal privado de reporte.

## [0.4.0] - 2026-09-29

Incluye el contenido previsto para 0.3.3, que nunca llegó a `main` (su tag quedó apuntando a un merge local y se eliminó).

### Agregado

- Servicio de mensajería con RabbitMQ (Queue-based Load Leveling): arranque tolerante a fallos si el broker no está disponible y reconexión automática en segundo plano.
- Descubrimiento de microservicios vía Eureka (`EurekaDiscoveryService`).
- `docker-compose.yml` para levantar el BFF localmente.
- CI con señales en cada PR: CodeQL, dependency review, escaneo Trivy de la imagen antes de publicarla, hadolint, lint de workflows (actionlint, zizmor), validación del título del PR y OpenSSF Scorecard. Dependabot para npm, Docker y GitHub Actions con cooldown de 7 días.

### Cambiado

- **Despliegue:** con `NODE_ENV=production` el BFF no arranca si falta `EUREKA_PASSWORD` (fail-closed). Configurar la variable antes de desplegar.
- Las rutas `GET` bajo `/api/v1/espacios-comunes/` son públicas, salvo las de `/reservas`, que siguen exigiendo token.
- Imagen Docker sin dependencias de desarrollo.
- NestJS 12.0.1 → 12.1.0 (grupo `@nestjs/*`), `multer` 2.4.0 vía `@nestjs/platform-express`.
- Dependencias de desarrollo: eslint 10.11.0, prettier 3.9.9, typescript-eslint 8.70.1, webpack 5.111.1, `@types/node` 26.6.3.

### Seguridad

- Credenciales de Eureka obligatorias en producción; se elimina el uso silencioso de la contraseña por defecto.
- `multer` 2.4.0 cierra CVE-2026-77078, CVE-2026-77037, CVE-2026-82333 y CVE-2026-77063.

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

[0.4.2]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.4.2
[0.4.1]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.4.1
[0.4.0]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.4.0
[0.3.2]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.3.2
[0.3.1]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.3.1
[0.3.0]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.3.0
[0.2.0]: https://github.com/Cloud-Native-Convivo/bff/releases/tag/v0.2.0
