# Notas de sesión — CONVIVO BFF

> Fecha: 2026-09-04

---

## 1. Fix: `ERESOLVE` — Conflicto de dependencias ESLint

**Problema:** `npm install` fallaba con el error `ERESOLVE could not resolve`.

```bash
npm error While resolving: @eslint/js@10.0.1
npm error Found: eslint@9.39.5
npm error peerOptional eslint@"^10.0.0" from @eslint/js@10.0.1
```

**Causa:** `@eslint/js@10.x` requiere `eslint@^10.0.0`, pero el proyecto tenía `eslint@^9.39.5`.

**Fix en `package.json`:**

```diff
- "eslint": "^9.39.5",
+ "eslint": "^10.0.0",
```

---

## 2. Actualización de Node.js

**Versión anterior:** `v24.11.0`
**Versión nueva:** `v24.19.0` (LTS instalado vía `winget install OpenJS.NodeJS.LTS`)

**Motivo:** Eliminar los warnings `EBADENGINE` de `@angular-devkit/*` que requerían `node >= 24.15.0`.

---

## 3. Fix: `ERR_MODULE_NOT_FOUND` tras actualizar Node

**Problema:** Al actualizar Node, `npm run start` fallaba:

```bash
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'...node_modules/@nestjs/cli/actions/abstract.action.js'
```

**Causa:** El `node_modules` fue compilado con la versión anterior de Node y quedó desincronizado.

**Fix:** Reinstall limpio:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

---

## 4. Fix: `WARN LegacyRouteConverter` — Ruta wildcard sin nombre

**Problema:** Al iniciar, NestJS mostraba:

```bash
WARN [LegacyRouteConverter] Unsupported route path: "/api/gastos/*"
```

**Causa:** La versión actualizada de `path-to-regexp` ya no acepta wildcards `*` sin nombre.

**Fix en `src/proxy/gastos-proxy.controller.ts`:**

```diff
- @All('*')
+ @All('*path')
```

**Resultado:** Ruta registrada limpiamente como `{/api/gastos/*path, ALL}` sin warnings.

---

## 5. Fix: `WARN LegacyRouteConverter` — Diferencias Node

Se actualizo la version de node del proyecto de **v24.11.0** a **v24.19.0** y el node_modules fue compilado con la versión anterior.

```bash
Hay un warning menor a tener en cuenta para después:
  │ WARN [LegacyRouteConverter] Unsup
  ported route path: "/api/gastos/*"
  Esto es porque NestJS/Express actualizó path-to-regexp y ya no acepta wildcards * sin nombre. Está siendo auto-
  convertido a {*path} por ahora, pero deberías corregirlo en el controlador:

    // ❌ Antes
    @All('/api/gastos/*')

    // ✅ Después
    @All('/api/gastos/*path')
```

## Estado final

| Check | Estado |
| --- | --- |
| `npm install` | ✅ Sin errores ni vulnerabilidades |
| `npm run start` | ✅ Servidor corriendo en `http://localhost:3000/api` |
| Warnings EBADENGINE | ✅ Eliminados (Node actualizado) |
| Warning LegacyRouteConverter | ✅ Eliminado (ruta corregida) |
