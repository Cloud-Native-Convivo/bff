import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { AsignacionGuard } from "./asignacion.guard";
import type { ProxyService } from "../proxy/proxy.service";

const contexto = (
  user: object,
  url: string,
  query: object = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        originalUrl: url,
        method: "GET",
        query,
        headers: {},
      }),
    }),
  }) as unknown as ExecutionContext;

describe("AsignacionGuard", () => {
  const proxy = { forwardCondominios: jest.fn() };
  const guard = new AsignacionGuard(proxy as unknown as ProxyService);
  const user = { sub: "residente-1", roles: ["residente"], claims: {} };

  beforeEach(() => proxy.forwardCondominios.mockReset());

  it("rechaza solicitudes pendientes aunque cliente mande condominioId", async () => {
    proxy.forwardCondominios.mockResolvedValue({
      estado: "pendiente",
      condominio_id: 1,
    });
    await expect(
      guard.canActivate(
        contexto(user, "/api/v1/panel?condominioId=1", { condominioId: "1" }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rechaza condominio ajeno aunque exista una asignación aprobada", async () => {
    proxy.forwardCondominios.mockResolvedValue({
      estado: "aprobada",
      condominio_id: 2,
    });
    await expect(
      guard.canActivate(
        contexto(user, "/api/v1/panel?condominioId=1", { condominioId: "1" }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("permite solo condominio aprobado y fija identidad para downstream", async () => {
    proxy.forwardCondominios.mockResolvedValue({
      estado: "aprobada",
      condominio_id: 2,
    });
    expect(
      await guard.canActivate(
        contexto(user, "/api/v1/panel?condominioId=2", { condominioId: "2" }),
      ),
    ).toBe(true);
    expect(user.claims).toEqual({ condominio_id: "2" });
  });
});
