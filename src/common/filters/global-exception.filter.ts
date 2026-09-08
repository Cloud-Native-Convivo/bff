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
import { isAxiosError } from 'axios';
import type { ErrorResponse } from '../interfaces/error-response';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ id?: string; method: string; url: string }>();
    const requestId = request.id ?? randomUUID();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body
      ) {
        const raw = (body as { message: unknown }).message;
        message = Array.isArray(raw) ? raw.join(', ') : String(raw);
      }
      code = HttpStatus[statusCode] ?? `HTTP_${statusCode}`;
    } else if (isAxiosError(exception)) {
      if (exception.response) {
        statusCode = exception.response.status;
        const body = exception.response.data as Record<string, unknown> | string | undefined;
        if (typeof body === 'string') {
          message = body;
        } else if (body && typeof body === 'object') {
          const raw = body.detail ?? body.message ?? JSON.stringify(body);
          message = Array.isArray(raw) ? raw.join(', ') : String(raw);
        }
        code = HttpStatus[statusCode] ?? `HTTP_${statusCode}`;
      } else {
        statusCode = HttpStatus.BAD_GATEWAY;
        code = 'BAD_GATEWAY';
        message = exception.message || 'Error de comunicación con el servicio downstream';
      }
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${statusCode} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponse = { statusCode, code, message, requestId };
    response.status(statusCode).json(body);
  }
}
