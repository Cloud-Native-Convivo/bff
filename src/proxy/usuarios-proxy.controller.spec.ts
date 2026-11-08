import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { UsuariosProxyController } from "./usuarios-proxy.controller";

describe("UsuariosProxyController", () => {
  it("expone /api/v1/usuarios que usa el portal", () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, UsuariosProxyController),
    ).toContain("v1/usuarios");
  });

  it("solo expone GET me, sin proxy genérico", () => {
    const me = Reflect.get(UsuariosProxyController.prototype, "me");
    expect(Reflect.getMetadata(METHOD_METADATA, me)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, me)).toBe("me");
    expect(Object.getOwnPropertyNames(UsuariosProxyController.prototype)).toEqual(
      ["constructor", "me"],
    );
  });

  it("reenvía GET /me con la identidad del usuario", async () => {
    const forwardUsuarios = jest.fn().mockResolvedValue({ ok: true });
    const controller = new UsuariosProxyController({ forwardUsuarios } as never);
    const user = { sub: "abc", roles: ["residente"] } as never;

    const result = await controller.me(
      { originalUrl: "/api/v1/usuarios/me", headers: {} } as never,
      user,
    );

    expect(result).toEqual({ ok: true });
    expect(forwardUsuarios).toHaveBeenCalledWith("GET", "/me", "", undefined, {}, user);
  });
});
