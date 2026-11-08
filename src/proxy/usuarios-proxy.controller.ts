import { Controller, Get, Req } from "@nestjs/common";
import { Request } from "express";
import { ProxyService } from "./proxy.service";
import { UsuarioActual } from "../auth/usuario-actual.decorator";
import type { UsuarioAutenticado } from "../common/interfaces/usuario-autenticado";

// Solo se expone el perfil propio: los cambios de rol por condominio no están
// definidos todavía (docs/pendiente.md), así que no se abre un proxy genérico.
@Controller(["usuarios", "v1/usuarios"])
export class UsuariosProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get("me")
  async me(@Req() req: Request, @UsuarioActual() user?: UsuarioAutenticado) {
    return this.proxy.forwardUsuarios(
      "GET",
      "/me",
      req.originalUrl.split("?")[1] ?? "",
      undefined,
      req.headers,
      user,
    );
  }
}
