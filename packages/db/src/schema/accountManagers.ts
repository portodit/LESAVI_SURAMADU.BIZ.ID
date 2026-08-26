// accountManagers types and insert schema
// The table is defined in rbac.ts to avoid circular imports
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountManagersTable } from "./rbac";

export { accountManagersTable };
export { accountManagersRelations } from "./rbac";

export const insertAccountManagerSchema = createInsertSchema(accountManagersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAccountManager = z.infer<typeof insertAccountManagerSchema>;
export type AccountManager = typeof accountManagersTable.$inferSelect;
