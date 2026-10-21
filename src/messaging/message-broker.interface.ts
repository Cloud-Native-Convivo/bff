/**
 * Contrato de mensajería asíncrona y nivelación de carga (Queue-based Load Leveling) del BFF.
 *
 * Centraliza la publicación, amortiguación y balanceo de carga en RabbitMQ
 * para evitar la sobrecarga de microservicios de dominio (ms-espacios-comunes y ms-gastos-comunes).
 */
import type { ComandoMutacion } from './comando-mutacion.interface';

export interface MessageBroker {
  publish(exchange: string, routingKey: string, payload: unknown): Promise<void>;
  publishFanout(exchange: string, payload: unknown): Promise<void>;
  sendToQueue(queue: string, payload: unknown, options?: { priority?: number }): Promise<void>;
  encolarComando(queue: string, comando: ComandoMutacion): Promise<void>;
  isReady(): boolean;
}
