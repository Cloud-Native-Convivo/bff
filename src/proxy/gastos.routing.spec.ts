import { CanActivate, ExecutionContext, INestApplication, Injectable } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { RolesGuard } from '../authorization/roles.guard';
import { CognitoEmailService } from '../auth/cognito-email.service';
import { MessagingService } from '../messaging/messaging.service';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { AsyncMutationService } from './async-mutation.service';
import { GastosProxyController } from './gastos-proxy.controller';
import { ProxyService } from './proxy.service';

// Usuario que el guard de prueba inyecta en request.user (reemplaza al JwtAuthGuard).
let usuarioDePrueba: UsuarioAutenticado;

@Injectable()
class GuardUsuarioDePrueba implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>().user = usuarioDePrueba;
    return true;
  }
}

describe('Ruteo HTTP de mutaciones en /api/gastos/api/v1/gastos-comunes', () => {
  let app: INestApplication;
  let url: string;
  const encolarComando = jest.fn().mockResolvedValue(undefined);

  const admin: UsuarioAutenticado = { sub: 'adm-1', roles: ['administrador'], claims: {} };
  const residente: UsuarioAutenticado = { sub: 'res-1', roles: ['residente'], claims: {} };

  const enviar = (metodo: string, ruta: string, cuerpo?: object) =>
    fetch(`${url}/api/gastos/api/v1/gastos-comunes${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });

  const comandoEncolado = () => {
    expect(encolarComando).toHaveBeenCalledTimes(1);
    const [cola, comando] = encolarComando.mock.calls[0];
    expect(cola).toBe('gastos_comandos_queue');
    return comando;
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [GastosProxyController],
      providers: [
        AsyncMutationService,
        { provide: MessagingService, useValue: { isReady: () => true, encolarComando } },
        { provide: CognitoEmailService, useValue: { obtenerEmail: jest.fn() } },
        { provide: ProxyService, useValue: { forwardGastos: jest.fn() } },
        { provide: APP_GUARD, useClass: GuardUsuarioDePrueba },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    encolarComando.mockClear();
    usuarioDePrueba = admin;
  });

  it('POST /gastos-comunes encola REGISTRAR_GASTO con el condominio en el payload', async () => {
    const cuerpo = { condominioId: '3', unidadId: 'A-101', concepto: 'Cuota', monto: 50000 };
    const res = await enviar('POST', '', cuerpo);
    expect(res.status).toBe(202);
    const comando = comandoEncolado();
    expect(comando.accion).toBe('REGISTRAR_GASTO');
    expect(comando.payload).toEqual({ ...cuerpo, condominio_id: '3' });
  });

  it('PUT /gastos-comunes/7 encola ACTUALIZAR_GASTO con id y condominio en el payload', async () => {
    const res = await enviar('PUT', '/7?condominioId=3', { concepto: 'Cuota', monto: 60000 });
    expect(res.status).toBe(202);
    const comando = comandoEncolado();
    expect(comando.accion).toBe('ACTUALIZAR_GASTO');
    expect(comando.payload).toMatchObject({ id: 7, condominio_id: '3', concepto: 'Cuota', monto: 60000 });
  });

  it('DELETE /gastos-comunes/7 encola ELIMINAR_GASTO con id y condominio en el payload', async () => {
    const res = await enviar('DELETE', '/7?condominioId=3');
    expect(res.status).toBe(202);
    const comando = comandoEncolado();
    expect(comando.accion).toBe('ELIMINAR_GASTO');
    expect(comando.payload).toMatchObject({ id: 7, condominio_id: '3' });
  });

  it('POST /gastos-comunes/7/pagos encola REGISTRAR_PAGO con gasto_id y condominio en el payload', async () => {
    const res = await enviar('POST', '/7/pagos?condominioId=3', { monto: 10000, metodo: 'TRANSFERENCIA' });
    expect(res.status).toBe(202);
    const comando = comandoEncolado();
    expect(comando.accion).toBe('REGISTRAR_PAGO');
    expect(comando.payload).toMatchObject({ gasto_id: 7, condominio_id: '3', monto: 10000 });
  });

  it('el id de la ruta y el condominio de la query mandan sobre los del body', async () => {
    const res = await enviar('PUT', '/7?condominioId=3', { id: 99, condominio_id: '9', monto: 1 });
    expect(res.status).toBe(202);
    expect(comandoEncolado().payload).toMatchObject({ id: 7, condominio_id: '3' });
  });

  it.each([
    ['PATCH', '/7?condominioId=3'],
    ['POST', '/7/otra-cosa?condominioId=3'],
    ['DELETE', '?condominioId=3'],
  ])('%s %s no está soportada: 404 y no encola', async (metodo, ruta) => {
    const res = await enviar(metodo, ruta, metodo === 'DELETE' ? undefined : {});
    expect(res.status).toBe(404);
    expect(encolarComando).not.toHaveBeenCalled();
  });

  it.each([
    ['id no numérico', '/abc?condominioId=3'],
    ['id cero', '/0?condominioId=3'],
    ['sin condominioId', '/7'],
  ])('PUT con %s responde 400 y no encola', async (_caso, ruta) => {
    const res = await enviar('PUT', ruta, { monto: 1 });
    expect(res.status).toBe(400);
    expect(encolarComando).not.toHaveBeenCalled();
  });

  it('un residente no puede registrar gastos: 403 y no encola', async () => {
    usuarioDePrueba = residente;
    const res = await enviar('POST', '', { condominioId: '3', unidadId: 'A-101', concepto: 'Cuota', monto: 1 });
    expect(res.status).toBe(403);
    expect(encolarComando).not.toHaveBeenCalled();
  });
});
