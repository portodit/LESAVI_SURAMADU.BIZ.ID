import type { Request, Response, NextFunction } from "express";
import { db, accountManagersTable, rolePermissionsTable, permissionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function checkPermission(userId: number, permissionCode: string): Promise<boolean> {
  const [am] = await db
    .select()
    .from(accountManagersTable)
    .where(eq(accountManagersTable.id, userId));
  if (!am?.roleId) return false;

  const [perm] = await db
    .select()
    .from(permissionsTable)
    .where(eq(permissionsTable.code, permissionCode));
  if (!perm) return false;

  const [rp] = await db
    .select()
    .from(rolePermissionsTable)
    .where(
      and(
        eq(rolePermissionsTable.roleId, am.roleId),
        eq(rolePermissionsTable.permissionId, perm.id)
      )
    );
  return !!rp;
}

/**
 * Middleware factory: require a specific permission.
 * Must be mounted AFTER requireAuth.
 */
export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const hasPermission = await checkPermission(user.id, permissionCode);
    if (!hasPermission) {
      res.status(403).json({ error: "Kamu tidak memiliki izin untuk mengakses fitur ini." });
      return;
    }
    next();
  };
}

/**
 * Middleware factory: require any of the given permissions.
 */
export function requireAnyPermission(permissionCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    for (const code of permissionCodes) {
      if (await checkPermission(user.id, code)) {
        next();
        return;
      }
    }
    res.status(403).json({ error: "Kamu tidak memiliki izin untuk mengakses fitur ini." });
  };
}

/**
 * Middleware factory: require ALL of the given permissions.
 */
export function requireAllPermissions(permissionCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    for (const code of permissionCodes) {
      if (!(await checkPermission(user.id, code))) {
        res.status(403).json({ error: "Kamu tidak memiliki izin untuk mengakses fitur ini." });
        return;
      }
    }
    next();
  };
}
