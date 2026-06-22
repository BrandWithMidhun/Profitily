import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Logger } from 'nestjs-pino';

/**
 * Global error filter (docs/13 §9, §12). Logs full detail server-side and returns
 * a generic body outward: known client (4xx) errors keep their safe Nest message;
 * everything else becomes a generic 500. No stack traces or internals leak to the
 * client; no secrets/PII are emitted.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const detail =
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception);
    this.logger.error(detail, AllExceptionsFilter.name);

    if (
      status < HttpStatus.INTERNAL_SERVER_ERROR &&
      exception instanceof HttpException
    ) {
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
      return;
    }

    response
      .status(status)
      .json({ statusCode: status, message: 'Internal server error' });
  }
}
