/**
 * Contrato de mensajería asíncrona del BFF.
 *
 * La integración con RabbitMQ / Amazon MQ se implementará posteriormente,
 * leyendo la conexión desde variables de entorno (RABBITMQ_URLS,
 * RABBITMQ_EXCHANGE). Por ahora solo se define la API.
 */
export interface MessageBroker {
  publish(exchange: string, routingKey: string, payload: unknown): Promise<void>;
}
