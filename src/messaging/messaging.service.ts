import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { MessageBroker } from './message-broker.interface';
import type { ComandoMutacion } from './comando-mutacion.interface';

/**
 * Servicio de mensajería y nivelación de carga (Queue-based Load Leveling).
 *
 * Centraliza la comunicación y balanceo hacia RabbitMQ:
 * - Evita saturar microservicios downstream mediante buffering y control de flujo.
 * - Conexión tolerante a fallos (Fail-Safe Boot): no bloquea el arranque del BFF si el broker no está disponible.
 * - Reintento automático en background ante desconexiones.
 */
@Injectable()
export class MessagingService
  implements MessageBroker, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MessagingService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<boolean>('rabbitmqEnabled') ?? false;
    if (!enabled) {
      this.logger.log('MessagingService: RabbitMQ deshabilitado por configuración (RABBITMQ_ENABLED=false)');
      return;
    }

    // Iniciar conexión no bloqueante
    void this.conectar();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    await this.cerrarConexion();
  }

  isReady(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  async publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
  ): Promise<void> {
    if (!this.isReady()) {
      this.logger.warn(
        `publish buffering/fallback (RabbitMQ no conectado aún): ${exchange}/${routingKey}`,
        typeof payload === 'string' ? payload : JSON.stringify(payload),
      );
      return;
    }

    try {
      const buffer = Buffer.from(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
      );
      const ex = exchange || this.config.get<string>('rabbitmqExchange') || 'espacios_events';
      await this.channel!.assertExchange(ex, 'topic', { durable: true });
      this.channel!.publish(ex, routingKey, buffer, {
        persistent: true,
        contentType: 'application/json',
      });
      this.logger.debug(`Mensaje publicado en exchange ${ex} con routingKey ${routingKey}`);
    } catch (error) {
      this.logger.error(`Error publicando mensaje a RabbitMQ: ${String(error)}`);
    }
  }

  async publishFanout(
    exchange: string,
    payload: unknown,
  ): Promise<void> {
    if (!this.isReady()) {
      this.logger.warn(
        `publishFanout buffering/fallback (RabbitMQ no conectado aún): ${exchange}`,
        typeof payload === 'string' ? payload : JSON.stringify(payload),
      );
      return;
    }

    try {
      const buffer = Buffer.from(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
      );
      await this.channel!.assertExchange(exchange, 'fanout', { durable: true });
      this.channel!.publish(exchange, '', buffer, {
        persistent: true,
        contentType: 'application/json',
      });
      this.logger.debug(`Mensaje publicado en exchange fanout ${exchange}`);
    } catch (error) {
      this.logger.error(`Error publicando en exchange fanout ${exchange}: ${String(error)}`);
    }
  }

  async sendToQueue(
    queue: string,
    payload: unknown,
    options?: { priority?: number },
  ): Promise<void> {
    if (!this.isReady()) {
      this.logger.warn(
        `sendToQueue buffering/fallback (RabbitMQ no conectado aún): cola=${queue}`,
      );
      return;
    }

    try {
      const buffer = Buffer.from(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
      );
      await this.channel!.assertQueue(queue, { durable: true });
      this.channel!.sendToQueue(queue, buffer, {
        persistent: true,
        contentType: 'application/json',
        priority: options?.priority,
      });
      this.logger.debug(`Mensaje nivelado enviado a cola ${queue}`);
    } catch (error) {
      this.logger.error(`Error enviando mensaje a cola ${queue}: ${String(error)}`);
    }
  }

  async encolarComando(
    queue: string,
    comando: ComandoMutacion,
  ): Promise<void> {
    await this.sendToQueue(queue, JSON.stringify(comando));
  }

  private async conectar(): Promise<void> {
    if (this.isConnecting || this.isReady()) return;
    this.isConnecting = true;

    const urls = this.config.get<string>('rabbitmqUrls') ?? 'amqp://localhost:5672';
    const exchange = this.config.get<string>('rabbitmqExchange') ?? 'espacios_events';

    try {
      this.logger.log(`Conectando a RabbitMQ en ${urls}...`);
      const conn = await amqp.connect(urls);
      const ch = await conn.createChannel();

      // Declarar exchange común de eventos para regular la saga
      await ch.assertExchange(exchange, 'topic', { durable: true });
      // Limitar prefetch para proteger a los consumidores de picos repentinos
      await ch.prefetch(10);

      conn.on('error', (err) => {
        this.logger.error(`Error en conexión RabbitMQ: ${String(err)}`);
        this.programarReconexion();
      });

      conn.on('close', () => {
        this.logger.warn('Conexión con RabbitMQ cerrada. Programando reconexión...');
        this.connection = null;
        this.channel = null;
        this.programarReconexion();
      });

      this.connection = conn;
      this.channel = ch;
      this.logger.log(`MessagingService conectado exitosamente a RabbitMQ (Exchange: ${exchange})`);
    } catch (error) {
      this.logger.warn(`No se pudo conectar a RabbitMQ (${String(error)}) — reintentando en 10s...`);
      this.programarReconexion();
    } finally {
      this.isConnecting = false;
    }
  }

  private programarReconexion(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.conectar();
    }, 10000);
  }

  private async cerrarConexion(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
    } catch (error) {
      this.logger.warn(`Error al cerrar conexión con RabbitMQ: ${String(error)}`);
    }
  }
}
