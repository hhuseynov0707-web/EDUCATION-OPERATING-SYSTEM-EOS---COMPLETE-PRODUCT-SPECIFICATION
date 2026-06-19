import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: AuditAction;
  entity: string;
}

/**
 * Marks a write endpoint for automatic audit logging by AuditInterceptor.
 * Example: @Audit({ action: 'UPDATE', entity: 'Student' })
 */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
