import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

const SAFE_BODY_KEYS = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'trackingToken',
  'tracking_token',
  'secret',
  'providerResponse',
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SAFE_BODY_KEYS.has(k) ? '[REDACTED]' : sanitize(v);
    }
    return out;
  }
  return value;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const req = ctx.getRequest<{ method: string; url: string }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : null;

    let code = 'INTERNAL_ERROR';
    let message = 'Erreur interne du serveur.';
    if (typeof raw === 'string') {
      message = raw;
    } else if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      if (typeof r['code'] === 'string') code = r['code'];
      else if (status === 400) code = 'BAD_REQUEST';
      else if (status === 401) code = 'UNAUTHORIZED';
      else if (status === 403) code = 'FORBIDDEN';
      else if (status === 404) code = 'NOT_FOUND';
      else if (status === 409) code = 'CONFLICT';
      else if (status === 429) code = 'TOO_MANY_REQUESTS';
      const m = r['message'];
      if (typeof m === 'string') message = m;
      else if (Array.isArray(m)) message = m.join('; ');
    }
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${req.method} ${req.url} -> ${status} ${code}: ${JSON.stringify(sanitize(raw))}`,
      );
    }
    res.status(status).json({ statusCode: status, code, message });
  }
}
