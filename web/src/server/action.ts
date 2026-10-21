import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb, schema, type Db, type Tx } from "@/db";
import { can, type Permission } from "@/lib/permissions";
import { getStaff, type Staff } from "@/lib/session";

export type ErrorCode = "unauthenticated" | "forbidden" | "validation" | "conflict" | "not_found" | "invalid_state" | "error";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; code: ErrorCode; error: string };

/** Thrown inside a handler to abort the transaction and return a friendly failure. */
export class ActionError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const CONFLICT_MESSAGE = "Someone else updated this chart while you were editing. Reload to see the latest version, then redo your change.";

interface Ctx<S extends z.ZodType> {
  staff: Staff;
  input: z.output<S>;
  db: Db;
}

/**
 * Every server action goes through here:
 *  1. authenticate (active staff profile required)
 *  2. authorise against the shared permission table
 *  3. validate input with zod
 *  4. run the handler (handlers open their own transaction and write the audit row inside it)
 * Authorisation is always enforced server-side; hiding buttons in the UI is only convenience.
 */
export async function runAction<S extends z.ZodType, T>(
  permission: Permission,
  inputSchema: S,
  rawInput: unknown,
  handler: (ctx: Ctx<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const staff = await getStaff();
  if (!staff) return { ok: false, code: "unauthenticated", error: "Your session has ended. Sign in again." };
  if (!can(staff.role, permission)) {
    return { ok: false, code: "forbidden", error: "Your role is not allowed to do this." };
  }
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return { ok: false, code: "validation", error: `${where}${first?.message ?? "Invalid input"}` };
  }
  try {
    const data = await handler({ staff, input: parsed.data, db: getDb() });
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, code: err.code, error: err.message };
    // Unique violation on the "one active admission per bed" index.
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "23505") {
      return { ok: false, code: "conflict", error: "That bed was just taken. Reload the board." };
    }
    console.error("Action failed", err);
    return { ok: false, code: "error", error: "Something went wrong. Nothing was saved. Try again." };
  }
}

export async function audit(
  tx: Tx,
  staff: Staff,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await tx.insert(schema.auditLog).values({
    actorId: staff.userId,
    actorName: staff.displayName,
    action,
    entity,
    entityId,
    before: before === undefined ? null : before,
    after: after === undefined ? null : after,
  });
}

/**
 * Optimistic concurrency: bump the admission version only if it still equals what the client
 * loaded. Returns the previous and updated rows. Throws a conflict if somebody else got there first.
 */
export async function guardedUpdate(
  tx: Tx,
  admissionId: string,
  expectedVersion: number,
  set: Partial<typeof schema.admission.$inferInsert> = {},
) {
  const [before] = await tx.select().from(schema.admission).where(eq(schema.admission.id, admissionId)).for("update");
  if (!before) throw new ActionError("not_found", "This admission no longer exists.");
  if (before.status !== "active") throw new ActionError("invalid_state", "This patient has already been discharged.");
  if (before.version !== expectedVersion) throw new ActionError("conflict", CONFLICT_MESSAGE);
  const [after] = await tx
    .update(schema.admission)
    .set({ ...set, version: sql`${schema.admission.version} + 1`, updatedAt: new Date() })
    .where(and(eq(schema.admission.id, admissionId), eq(schema.admission.version, expectedVersion)))
    .returning();
  if (!after) throw new ActionError("conflict", CONFLICT_MESSAGE);
  return { before, after };
}

/** Loads an active admission or throws. Used by append-only actions that do not need the version check. */
export async function requireActiveAdmission(tx: Tx, admissionId: string) {
  const [row] = await tx.select().from(schema.admission).where(eq(schema.admission.id, admissionId));
  if (!row) throw new ActionError("not_found", "This admission no longer exists.");
  if (row.status !== "active") throw new ActionError("invalid_state", "This patient has already been discharged.");
  return row;
}
