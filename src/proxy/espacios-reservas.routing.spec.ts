import { CanActivate, ExecutionContext, INestApplication, Injectable } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { RolesGuard } from '../authorization/roles.guard';
import { CognitoEmailService } from '../auth/cognito-email.service';
import { MessagingService } from '../messaging/messaging.service';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';
import { AsyncMutationService } from './async-mutation.service';
import { EspaciosProxyController } from './espacios-proxy.controller';
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

describe('Ruteo HTTP de reservas en /api/v1/espacios-comunes', () => {
  let app: INestApplication;
  let url: string;
  const encolarComando = jest.fn().mockResolvedValue(undefined);

  const residente: UsuarioAutenticado = { sub: 'res-1', roles: ['residente'], claims: {} };
  const admin: UsuarioAutenticado = { sub: 'adm-1', roles: ['admin'], claims: {} };

  const enviar = (metodo: string, ruta: string) =>
    fetch(`${url}/api/v1/espacios-comunes${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: metodo === 'DELETE' || metodo === 'GET' ? undefined : '{}',
    });

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [EspaciosProxyController],
      providers: [
        AsyncMutationService,
        { provide: MessagingService, useValue: { isReady: () => true, encolarComando } },
        { provide: CognitoEmailService, useValue: { obtenerEmail: jest.fn() } },
        { provide: ProxyService, useValue: { forwardEspacios: jest.fn() } },
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
    usuarioDePrueba = residente;
  });

  it('DELETE /reservas/5 responde 202 y encola CANCELAR_RESERVA con reserva_id 5', async () => {
    const res = await enviar('DELETE', '/reservas/5');
    expect(res.status).toBe(202);
    expect(encolarComando).toHaveBeenCalledTimes(1);
    const [cola, comando] = encolarComando.mock.calls[0];
    expect(cola).toBe('espacios_comandos_queue');
    expect(comando).toMatchObject({ accion: 'CANCELAR_RESERVA', reserva_id: 5, usuario_id: 'res-1' });
    expect(comando.accion).not.toBe('ELIMINAR_ESPACIO');
  });

  it('un admin también cancela por la ruta de reservas, no por la de espacios', async () => {
    usuarioDePrueba = admin;
    const res = await enviar('DELETE', '/reservas/5');
    expect(res.status).toBe(202);
    expect(encolarComando.mock.calls[0][1]).toMatchObject({ accion: 'CANCELAR_RESERVA', reserva_id: 5 });
  });

  it('DELETE /espacios/5 sigue siendo ELIMINAR_ESPACIO (solo admin) y no lleva reserva_id', async () => {
    usuarioDePrueba = admin;
    const res = await enviar('DELETE', '/espacios/5?condominio_id=3');
    expect(res.status).toBe(202);
    const comando = encolarComando.mock.calls[0][1];
    expect(comando).toMatchObject({ accion: 'ELIMINAR_ESPACIO', espacio_id: 5, condominio_id: 3 });
    expect(comando).not.toHaveProperty('reserva_id');
  });

  it('DELETE /reservas/-2 responde 400 y no encola', async () => {
    const res = await enviar('DELETE', '/reservas/-2');
    expect(res.status).toBe(400);
    expect(encolarComando).not.toHaveBeenCalled();
  });

  it('DELETE /reservas sin id responde 400 con el mensaje de la reserva y no encola', async () => {
    const res = await enviar('DELETE', '/reservas');
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('El id de la reserva debe ser un entero positivo');
    expect(encolarComando).not.toHaveBeenCalled();
  });

  it('un residente no puede eliminar espacios: 403 y no encola', async () => {
    const res = await enviar('DELETE', '/espacios/5?condominio_id=3');
    expect(res.status).toBe(403);
    expect(encolarComando).not.toHaveBeenCalled();
  });

  it('DELETE /reservas/abc responde 400 y no encola', async () => {
    const res = await enviar('DELETE', '/reservas/abc');
    expect(res.status).toBe(400);
    expect(encolarComando).not.toHaveBeenCalled();
  });

  it.each(['PUT', 'PATCH'])('%s /reservas/5 responde 405 y no encola', async (metodo) => {
    const res = await enviar(metodo, '/reservas/5');
    expect(res.status).toBe(405);
    expect(encolarComando).not.toHaveBeenCalled();
  });
});
