import { All, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { ProxyService } from "./proxy.service";
import { Roles } from "../authorization/roles.decorator";
import { UsuarioActual } from "../auth/usuario-actual.decorator";
import { CognitoEmailService } from "../auth/cognito-email.service";
import type { UsuarioAutenticado } from "../common/interfaces/usuario-autenticado";

const CONDOMINIOS_PREFIX = "/api/condominios";

@Controller(["condominios", "v1/condominios"])
export class CondominiosProxyController {
  constructor(
    private readonly proxy: ProxyService,
    private readonly cognitoEmail: CognitoEmailService,
  ) {}

  @Get(["/", "*path"])
  async listar(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    return this.forward(req, user);
  }

  @Post(["solicitudes", "solicitudes/"])
  async solicitar(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    const fullPath = req.originalUrl.split("?")[0];
    // El admin identifica al residente por su correo, no por el sub de Cognito.
    const email = await this.cognitoEmail.emailDelUsuario(req.headers.authorization, user);
    return this.proxy.forwardCondominios(
      "POST",
      fullPath.endsWith("/") ? "/solicitudes/" : "/solicitudes",
      "",
      req.body,
      req.headers,
      user,
      email ? { "x-usuario-email": email } : undefined,
    );
  }

  @Roles("admin", "administrador", "conserje", "comite")
  @All(["/", "*path"])
  async forward(
    @Req() req: Request,
    @UsuarioActual() user?: UsuarioAutenticado,
  ) {
    const fullPath = req.originalUrl.split("?")[0];
    const prefix = fullPath.startsWith("/api/v1/condominios")
      ? "/api/v1/condominios"
      : CONDOMINIOS_PREFIX;
    const path = fullPath.slice(prefix.length);
    const query = req.originalUrl.split("?")[1] ?? "";
    return this.proxy.forwardCondominios(
      req.method,
      path,
      query,
      req.body,
      req.headers,
      user,
    );
  }
}
