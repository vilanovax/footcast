import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { fail } from '@footcast/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? 'unknown';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      response.status(status).json(
        fail(
          HttpStatus[status] ?? 'HTTP_ERROR',
          Array.isArray(message) ? message.join(', ') : String(message),
          requestId,
          typeof payload === 'object' ? payload : undefined,
        ),
      );
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        fail(
          'INTERNAL_ERROR',
          exception instanceof Error ? exception.message : 'Unexpected error',
          requestId,
        ),
      );
  }
}
