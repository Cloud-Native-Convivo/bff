import {
  Injectable,
  ServiceUnavailableException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { MessagingService } from '../messaging/messaging.service';
import { CognitoEmailService } from '../auth/cognito-email.service';
import type { ComandoMutacion } from '../messaging/comando-mutacion.interface';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado';

export interface Respuesta202 {
  ticket_id: string;
  estado: string;
  status_url: string;
  creado_en: string;
}

@Injectable()
export class AsyncMutationService {
  private readonly logger = new Logger(AsyncMutationService.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly cognitoEmail: CognitoEmailService,
  ) {}

  async despachar(
    modulo: 'ESPACIOS' | 'GASTOS' | 'CONDOMINIOS',
    accion: string,
    req: Request,
    user?: UsuarioAutenticado,
  ): Promise<Respuesta202> {
    if (!this.messaging.isReady()) {
      this.logger.warn(`Broker no disponible para mutacion ${modulo}:${accion}`);
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Servicio de colas temporalmente no disponible para mutaciones asincronas',
        retryAfter: 5,
      });
    }

    const ticket_id = randomUUID();
    const queue = modulo === 'ESPACIOS' ? 'espacios_comandos_queue' : 'gastos_comandos_queue';
    const usuario_email = await this.resolverEmailSiAplica(accion, req, user);
    const comando: ComandoMutacion = {
      ticket_id,
      modulo,
      accion,
      usuario_id: user?.sub ?? 'anonimo',
      ...(usuario_email ? { usuario_email } : {}),
      rol: user?.roles?.[0] ?? 'residente',
      path: req.originalUrl,
      metodo: req.method,
      payload: req.body,
      timestamp: new Date().toISOString(),
    };

    await this.messaging.encolarComando(queue, comando);
    this.logger.log(`Mutacion encolada [${ticket_id}] -> ${queue} (${modulo}:${accion})`);

    const prefix = modulo === 'ESPACIOS' ? '/api/v1/espacios-comunes' : '/api/v1/gastos';
    return {
      ticket_id,
      estado: 'EN_COLA',
      status_url: `${prefix}/jobs/${ticket_id}`,
      creado_en: comando.timestamp,
    };
  }

  /**
   * El email solo se necesita para notificar al residente que reserva — y
   * solo Cognito lo resuelve así, porque su access token nunca trae el
   * claim `email` (ver CognitoEmailService).
   */
  private async resolverEmailSiAplica(
    accion: string,
    req: Request,
    user?: UsuarioAutenticado,
  ): Promise<string | undefined> {
    if (accion !== 'CREAR_RESERVA' || !user?.sub) {
      return undefined;
    }
    const esCognito = user.claims?.['token_use'] === 'access' && typeof user.claims?.['client_id'] === 'string';
    if (!esCognito) {
      return undefined;
    }
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!accessToken) {
      return undefined;
    }
    return this.cognitoEmail.obtenerEmail(accessToken, user.sub);
  }
}
