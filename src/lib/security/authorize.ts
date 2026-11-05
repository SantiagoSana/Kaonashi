// KAONASHI RBAC AUTHORIZATION CHOKE POINT (§9.6)
import { StaffRole } from '../types';
import { globalAuditLogger } from '../audit-logger';

export interface AuthContext {
  userId: string;
  role: StaffRole;
  branchIds?: string[];
  customerId?: string;
  ipHash?: string;
}

export type Permission =
  | 'menu:read'
  | 'menu:create'
  | 'menu:edit_price'
  | 'menu:toggle_86'
  | 'menu:delete'
  | 'inventory:read'
  | 'inventory:adjust'
  | 'orders:read'
  | 'orders:read_all'
  | 'orders:manage'
  | 'orders:accept_reject'
  | 'orders:cancel_refund'
  | 'kds:full'
  | 'reservations:read'
  | 'reservations:manage'
  | 'promotions:read'
  | 'promotions:manage'
  | 'promotions:approve'
  | 'campaigns:read'
  | 'campaigns:manage'
  | 'qr:generate'
  | 'qr:edit'
  | 'qr:revoke'
  | 'coupons:validate_in_person'
  | 'coupons:manage'
  | 'distribution:log'
  | 'costs:manage'
  | 'logistics:manage'
  | 'data_hub:import_all'
  | 'data_hub:import_sales'
  | 'data_hub:export_all'
  | 'data_hub:export_metrics'
  | 'branding:read'
  | 'branding:manage'
  | 'users:manage'
  | 'audit:read'
  | 'audit:verify';

const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  sysmaster: [
    'menu:read',
    'menu:create',
    'menu:edit_price',
    'menu:toggle_86',
    'menu:delete',
    'inventory:read',
    'inventory:adjust',
    'orders:read',
    'orders:read_all',
    'orders:manage',
    'orders:accept_reject',
    'orders:cancel_refund',
    'kds:full',
    'reservations:read',
    'reservations:manage',
    'promotions:read',
    'promotions:manage',
    'promotions:approve',
    'campaigns:read',
    'campaigns:manage',
    'qr:generate',
    'qr:edit',
    'qr:revoke',
    'coupons:validate_in_person',
    'coupons:manage',
    'distribution:log',
    'costs:manage',
    'logistics:manage',
    'data_hub:import_all',
    'data_hub:import_sales',
    'data_hub:export_all',
    'data_hub:export_metrics',
    'branding:read',
    'branding:manage',
    'users:manage',
    'audit:read',
    'audit:verify',
  ],
  kitchen_manager: [
    'menu:read',
    'menu:toggle_86',
    'inventory:read',
    'inventory:adjust',
    'orders:read',
    'kds:full',
    'reservations:read',
  ],
  marketing_manager: [
    'menu:read',
    'orders:read',
    'promotions:read',
    'promotions:manage',
    'campaigns:read',
    'campaigns:manage',
    'qr:generate',
    'qr:edit',
    'qr:revoke',
    'coupons:manage',
    'distribution:log',
    'costs:manage',
    'data_hub:export_metrics',
    'branding:read',
  ],
  ops_subadmin: [
    'menu:read',
    'menu:create',
    'menu:toggle_86',
    'inventory:read',
    'inventory:adjust',
    'orders:read',
    'orders:read_all',
    'orders:manage',
    'orders:accept_reject',
    'orders:cancel_refund',
    'reservations:read',
    'reservations:manage',
    'promotions:read',
    'campaigns:read',
    'logistics:manage',
    'data_hub:import_sales',
  ],
  reception: [
    'menu:read',
    'orders:read',
    'orders:accept_reject',
    'reservations:read',
    'reservations:manage',
    'coupons:validate_in_person',
  ],
  customer: ['menu:read'],
};

/**
 * Single choke point for authorization. Denies by default.
 */
export function authorize(
  ctx: AuthContext,
  permission: Permission,
  resource?: { ownerId?: string; branchId?: string }
): { authorized: boolean; reason?: string } {
  if (!ctx || !ctx.role) {
    globalAuditLogger.log({
      actor: ctx?.userId || 'anonymous',
      role: 'customer',
      action: 'access.denied',
      resource: permission,
      outcome: 'denied',
      details: { reason: 'No auth context' },
    });
    return { authorized: false, reason: 'UNAUTHENTICATED' };
  }

  const allowedPermissions = ROLE_PERMISSIONS[ctx.role] || [];
  const hasPermission = allowedPermissions.includes(permission);

  if (!hasPermission) {
    globalAuditLogger.log({
      actor: ctx.userId,
      role: ctx.role,
      action: 'access.denied',
      resource: permission,
      outcome: 'denied',
      details: { reason: `Role ${ctx.role} lacks permission ${permission}` },
      ipHash: ctx.ipHash,
    });
    return { authorized: false, reason: 'FORBIDDEN' };
  }

  // Branch isolation check: if staff user has assigned branchIds, ensure resource matches
  if (ctx.branchIds && ctx.branchIds.length > 0 && resource?.branchId) {
    if (!ctx.branchIds.includes(resource.branchId)) {
      globalAuditLogger.log({
        actor: ctx.userId,
        role: ctx.role,
        action: 'access.denied',
        resource: `${permission}:${resource.branchId}`,
        outcome: 'denied',
        details: { reason: 'Branch scope violation' },
        ipHash: ctx.ipHash,
      });
      return { authorized: false, reason: 'BRANCH_SCOPE_FORBIDDEN' };
    }
  }

  return { authorized: true };
}
