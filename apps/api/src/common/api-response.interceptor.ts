import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { Request } from 'express';
import { ok, type ApiMeta } from '@footcast/shared';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? 'unknown';

    return next.handle().pipe(
      map((body: unknown) => {
        if (
          body &&
          typeof body === 'object' &&
          'success' in body &&
          'requestId' in body
        ) {
          return body;
        }
        if (body && typeof body === 'object' && 'data' in body && 'meta' in body) {
          const wrapped = body as { data: unknown; meta: ApiMeta | null };
          return ok(wrapped.data, requestId, wrapped.meta);
        }
        return ok(body, requestId);
      }),
    );
  }
}
