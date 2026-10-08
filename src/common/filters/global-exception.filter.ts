import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { isAxiosError, type AxiosError } from 'axios';
import type { ErrorResponse } from '../interfaces/error-response';

interface ErrorClasificado {
  statusCode: number;
  code: string;
  message: string;
}

/** Texto legible de un valor de mensaje: arreglos unidos, objetos serializados (nunca "[object Object]"). */
function aTexto(raw: unknown): string {
  if (Array.isArray(raw)) return raw.join(', ');
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

function codigoHttp(statusCode: number): string {
  return HttpStatus[statusCode] ?? `HTTP_${statusCode}`;
}

function desdeHttpException(exception: HttpException): ErrorClasificado {
  const statusCode = exception.getStatus();
  const body = exception.getResponse();
  let message = 'Error interno del servidor';
  if (typeof body === 'string') {
    message = body;
  } else if (typeof body === 'object' && body !== null && 'message' in body) {
    message = aTexto((body as { message: unknown }).message);
  }
  return { statusCode, code: codigoHttp(statusCode), message };
}

function desdeAxios(exception: AxiosError): ErrorClasificado {
  if (!exception.response) {
    // Sin respuesta del downstream (ECONNREFUSED, DNS, timeout): el mensaje
    // de axios trae host y puerto internos. Solo va al log, nunca al cliente.
    return {
      statusCode: HttpStatus.BAD_GATEWAY,
      code: 'BAD_GATEWAY',
      message: 'Servicio no disponible temporalmente',
    };
  }
  const statusCode = exception.response.status;
  const body = exception.response.data as Record<string, unknown> | string | undefined;
  let message = 'Error interno del servidor';
  if (typeof body === 'string') {
    message = body;
  } else if (body && typeof body === 'object') {
    message = aTexto(body.detail ?? body.message ?? JSON.stringify(body));
  }
  return { statusCode, code: codigoHttp(statusCode), message };
}

function clasificarError(exception: unknown): ErrorClasificado {
  if (exception instanceof HttpException) return desdeHttpException(exception);
  if (isAxiosError(exception)) return desdeAxios(exception);
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor',
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ id?: string; method: string; url: string }>();
    const requestId = request.id ?? randomUUID();

    const { statusCode, code, message } = clasificarError(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const detalle = exception instanceof Error ? exception.message : message;
      this.logger.error(
        `[${request.method}] ${request.url} -> ${statusCode} ${detalle}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponse = { statusCode, code, message, requestId };
    response.status(statusCode).json(body);
  }
}
