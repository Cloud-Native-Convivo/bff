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
