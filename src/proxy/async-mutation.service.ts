import {
  Injectable,
  ServiceUnavailableException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { MessagingService } from '../messaging/messaging.service';
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

  constructor(private readonly messaging: MessagingService) {}

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
    const comando: ComandoMutacion = {
      ticket_id,
      modulo,
      accion,
      usuario_id: user?.sub ?? 'anonimo',
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
}
