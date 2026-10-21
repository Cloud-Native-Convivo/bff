import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import { ProxyService } from "../proxy/proxy.service";
import type { UsuarioAutenticado } from "../common/interfaces/usuario-autenticado";

@Injectable()
export class AsignacionGuard implements CanActivate {
  constructor(private readonly proxy: ProxyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: UsuarioAutenticado }>();
    const user = req.user;
    if (!user?.roles.includes("residente")) return true;

    const path = (req.originalUrl ?? req.url ?? "")
      .split("?")[0]
      .replace(/\/+$/, "");
    if (
      path.startsWith("/api/condominios") ||
      path.startsWith("/api/v1/condominios")
    )
      return true;
    if (
      req.method === "GET" &&
      (path === "/api/v1/espacios-comunes" ||
        (path.startsWith("/api/v1/espacios-comunes/") &&
          !path.includes("/reservas")))
    )
      return true;

    let asignacion: {
      estado: string;
      condominio_id: number;
      unidad: string;
    } | null;
    try {
      asignacion = (await this.proxy.forwardCondominios(
        "GET",
        "/solicitudes/me",
        "",
        undefined,
        req.headers,
        user,
      )) as typeof asignacion;
    } catch {
      throw new ServiceUnavailableException(
        "No se pudo verificar la asignación del condominio",
      );
    }
    if (asignacion?.estado !== "aprobada")
      throw new ForbiddenException("Asignación de condominio pendiente");

    const aprobado = String(asignacion.condominio_id);
    const body = req.body as Record<string, unknown> | undefined;
    for (const solicitado of [
      req.query?.condominioId,
      req.query?.condominio_id,
      body?.condominioId,
      body?.condominio_id,
      req.headers["x-condominio-id"],
    ]) {
      if (solicitado !== undefined && String(solicitado) !== aprobado) {
        throw new ForbiddenException(
          "El condominio solicitado no pertenece al residente",
        );
      }
    }
    user.claims.condominio_id = aprobado;
    user.claims.unidad_id = asignacion.unidad;
    return true;
  }
}
