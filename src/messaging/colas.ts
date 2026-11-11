import type { Options } from 'amqplib';

/**
 * Colas de comandos que el BFF declara antes de publicar (assertQueue).
 *
 * RabbitMQ rechaza con 406 PRECONDITION_FAILED una declaración cuyos argumentos
 * difieren de los de la cola ya existente. Por eso cada entrada debe ser un espejo
 * exacto de cómo la declara su consumidor:
 *  - espacios_comandos_queue: ms-espacios-comunes, app/events/comandos_consumer.py
 *  - gastos_comandos_queue:   ms-gastos-comunes, config/RabbitMqConfig.java
 * Si cambia la declaración en un microservicio, hay que cambiarla aquí.
 */
export interface DefinicionCola {
  readonly nombre: string;
  readonly opciones: Options.AssertQueue;
}

export const COLAS = {
  espaciosComandos: {
    nombre: 'espacios_comandos_queue',
    opciones: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'espacios_dlx',
        'x-dead-letter-routing-key': 'espacios_comandos_dlq',
      },
    },
  },
  gastosComandos: {
    nombre: 'gastos_comandos_queue',
    opciones: { durable: true },
  },
} as const satisfies Record<string, DefinicionCola>;

export function buscarCola(nombre: string): DefinicionCola | undefined {
  return Object.values<DefinicionCola>(COLAS).find((cola) => cola.nombre === nombre);
}
