# CONVIVO BFF

Backend for Frontend de CONVIVO. Punto central entre AWS API Gateway y los
microservicios. Node.js + NestJS + TypeScript.

## Arquitectura

```
Administrador
    ↓
Microsoft Entra ID
    ↓
Angular Admin
    ↓
AWS API Gateway (HTTP API)
    ↓
Lambda Authorizer "jwt-basico"
    ↓
BFF NestJS  ← este repo
    ↓
Microservicio Gastos Comunes
```

El BFF valida de forma **completa e independiente** el Access Token JWT de
Microsoft Entra ID (firma, issuer, audience, expiración) — no confía solo en
API Gateway/Lambda Authorizer — y actúa como reverse proxy hacia los
microservicios.

## Módulos

| Módulo | Responsabilidad |
|--------|-----------------|
| `config` | Carga y expone configuración por variables de entorno. |
| `auth` | Validación completa del JWT de Entra (jwks-rsa + passport-jwt). Guard global `JwtAuthGuard`; rutas públicas con `@IsPublic()`. |
| `authorization` | RBAC: `@Roles(...)` + `RolesGuard`. Mapeo claim→rol configurable (todavía sin definir en Entra). |
| `proxy` | Reverse proxy hacia microservicios. Solo Gastos Comunes por ahora. |
| `health` | Endpoint `/api/health` (liveness). |
| `messaging` | Contrato base para RabbitMQ / Amazon MQ. **Sin conexión** en esta etapa. |
| `common` | Filtro global de excepciones e interfaces compartidas. |

## Requisitos

- Node.js >= 20
- npm

## Instalación

```bash
cd bff
npm install
```

## Configuración

Copia el ejemplo y completa los valores (nunca commitees valores reales):

```bash
cp .env.example .env
```

Variables clave:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (default 3000). |
| `NODE_ENV` | `development` / `production`. |
| `CORS_ORIGINS` | Orígenes permitidos separados por coma. |
| `ENTRA_TENANT_ID` | Tenant de Microsoft Entra ID. |
| `ENTRA_API_CLIENT_ID` | Client ID de la API de CONVIVO en Entra. |
| `GASTOS_COMUNES_URL` | URL base del microservicio Gastos Comunes. |
| `PROXY_TIMEOUT_MS` | Timeout de las llamadas del proxy. |
| `CLAIM_DE_ROL` / `CLAIM_MAPEO` | Claim y mapeo de roles (configurar cuando se definan los App Roles en Entra). |
| `RABBITMQ_ENABLED` | `false` hasta implementar la conexión a Amazon MQ. |

## Ejecutar

```bash
# desarrollo (watch)
npm run start:dev

# producción (build + run)
npm run build
npm run start:prod
```

## Probar health

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada (HTTP 200):

```json
{
  "status": "ok",
  "service": "convivo-bff",
  "uptime": 7,
  "timestamp": "2026-09-04T00:00:00.000Z"
}
```

## Probar el proxy de Gastos Comunes

Requiere un Access Token válido de Entra ID y un microservicio corriendo en
`GASTOS_COMUNES_URL`. Sin token devuelve `401`:

```bash
curl -X GET http://localhost:3000/api/gastos/<ruta> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Errores

Todos los errores se devuelven en formato uniforme vía el filtro global:

```json
{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Unauthorized",
  "requestId": "a07e1423-...-fe7c"
}
```

## Notas

- Los roles del BFF (`administrador`, `conserje`, `comite`) están preparados
  de forma modular; el claim/App Role definitivo de Entra se configura cuando
  se defina.
- RabbitMQ / Amazon MQ y Oracle se integrarán en etapas posteriores; no hay
  credenciales en el repositorio ni conexiones reales activas.
- El BFF propaga hacia Gastos Comunes los headers `Authorization`,
  `Content-Type` y `X-Correlation-Id` (generado si el cliente no lo envía).
