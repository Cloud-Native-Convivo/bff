import { Injectable, Logger } from '@nestjs/common';
import type { MessageBroker } from './message-broker.interface';

/**
 * Implementación BASE (sin conexión real) del contrato MessageBroker.
 *
 * El transporte real (RabbitMQ vía Amazon MQ) se conectará cuando
 * RABBITMQ_ENABLED=true y se complete la implementación. Esta clase evita
 * que el BFF falle en boot si no hay broker configurado.
 */
@Injectable()
export class MessagingService implements MessageBroker {
  private readonly logger = new Logger(MessagingService.name);

  async publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
  ): Promise<void> {
    this.logger.warn(
      `publish ignorado (RabbitMQ sin configurar): ${exchange}/${routingKey}`,
      JSON.stringify(payload),
    );
  }
}
