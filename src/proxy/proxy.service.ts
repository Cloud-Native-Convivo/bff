import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Servicio de reenvío (reverse proxy) del BFF hacia los microservicios.
 * En esta etapa solo se usa para Gastos Comunes.
 */
@Injectable()
export class ProxyService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reenvía la solicitud del cliente a la URL base del microservicio
   * de Gastos Comunes, conservando path, query, método HTTP y los headers
   * relevantes (Autorización, Content-Type y correlación).
   *
   * @param headers Headers del request entrante (ya validado el JWT).
   */
  async forwardGastos(
    method: string,
    path: string,
    query: string,
    body?: unknown,
    headers?: Record<string, string | string[] | undefined>,
  ): Promise<unknown> {
    const baseUrl = this.config.get<string>('gastosComunesUrl') ?? '';
    const timeout = this.config.get<number>('proxyTimeoutMs') ?? 10000;
    const suffix = query ? `?${query}` : '';
    const url = `${baseUrl}${path}${suffix}`;

    const { data } = await lastValueFrom(
      this.http.request({
        method,
        url,
        data: body,
        timeout,
        headers: this.buildForwardHeaders(headers),
      }),
    );

    return data;
  }

  /**
   * Selecciona los headers que se propagan al microservicio downstream.
   * Si el cliente no envió un identificador de correlación, se genera uno.
   */
  private buildForwardHeaders(
    headers?: Record<string, string | string[] | undefined>,
  ): Record<string, string> {
    const forward: Record<string, string> = {};
    const source = headers ?? {};

    // Authorization se propaga tal cual: el BFF ya validó el JWT y el
    // microservicio recibe el mismo Access Token.
    if (source['authorization']) {
      forward['authorization'] = asString(source['authorization']) as string;
    }

    if (source['content-type']) {
      forward['content-type'] = asString(source['content-type']) as string;
    }

    forward[CORRELATION_HEADER] =
      asString(source[CORRELATION_HEADER]) ?? newCorrelationId();

    return forward;
  }
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function newCorrelationId(): string {
  return crypto.randomUUID();
}
