import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { CondominiosProxyController } from "./condominios-proxy.controller";

describe("CondominiosProxyController", () => {
  it("expone la ruta /api/v1/condominios que usa el portal", () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, CondominiosProxyController),
    ).toContain("v1/condominios");
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
