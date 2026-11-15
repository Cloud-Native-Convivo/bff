import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { CondominiosProxyController } from "./condominios-proxy.controller";

describe("CondominiosProxyController", () => {
  it("expone la ruta /api/v1/condominios que usa el portal", () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, CondominiosProxyController),
    ).toContain("v1/condominios");
  });

  describe("solicitar", () => {
    const req = (authorization?: string) =>
      ({ originalUrl: "/api/v1/condominios/solicitudes", body: { numero: "24" }, headers: { authorization } }) as never;
    const usuario = { sub: "sub-1", roles: ["residente" as const], claims: {} };

    it("reenvía el correo resuelto por el bff en x-usuario-email", async () => {
      const proxy = { forwardCondominios: jest.fn().mockResolvedValue({ id: 1 }) };
      const cognito = { emailDelUsuario: jest.fn().mockResolvedValue("ana@convivo.cl") };
      const controller = new CondominiosProxyController(proxy as never, cognito as never);

      await controller.solicitar(req("Bearer tok"), usuario);

      expect(cognito.emailDelUsuario).toHaveBeenCalledWith("Bearer tok", usuario);
      expect(proxy.forwardCondominios).toHaveBeenCalledWith(
        "POST", "/solicitudes", "", { numero: "24" }, { authorization: "Bearer tok" }, usuario,
        { "x-usuario-email": "ana@convivo.cl" },
      );
    });

    it("sin correo no agrega el header", async () => {
      const proxy = { forwardCondominios: jest.fn().mockResolvedValue({ id: 1 }) };
      const cognito = { emailDelUsuario: jest.fn().mockResolvedValue(undefined) };
      const controller = new CondominiosProxyController(proxy as never, cognito as never);

      await controller.solicitar(req(), usuario);

      expect(proxy.forwardCondominios.mock.calls[0][6]).toBeUndefined();
    });
  });

  it("permite POST de solicitudes a un residente autenticado sin abrir el CRUD", () => {
    const solicitar = Reflect.get(
      CondominiosProxyController.prototype,
      "solicitar",
    );
    expect(solicitar).toBeDefined();
    expect(Reflect.getMetadata(METHOD_METADATA, solicitar)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, solicitar)).toContain(
      "solicitudes",
    );
  });
});
