import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAction } from '@prisma/client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Writes an immutable audit row for any handler annotated with @Audit(...).
 * Captures actor, action, entity, the returned entity id, request body as the
 * "new value", client IP and user-agent. Failures to log never block the request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;
    const requestBody = req.body;

    return next.handle().pipe(
      tap((result) => {
        const entityId =
          (result && (result.id as string)) ?? (req.params?.id as string) ?? null;

        void this.prisma.auditLog
          .create({
            data: {
              actorUserId: user?.userId ?? null,
              action: meta.action as AuditAction,
              entity: meta.entity,
              entityId: entityId ? String(entityId) : null,
              newValue: meta.action === AuditAction.DELETE ? undefined : sanitize(requestBody),
              ip: ip ?? null,
              userAgent: userAgent ?? null,
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}

/** Strip obviously sensitive fields before persisting request bodies. */
function sanitize(body: unknown): object | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of ['password', 'passwordHash', 'token', 'refreshToken']) {
    if (key in clone) clone[key] = '[redacted]';
  }
  return clone;
}
