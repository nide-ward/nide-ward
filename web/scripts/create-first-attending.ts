import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { getAuth } from "../src/lib/auth";
import { seedAdminEnv } from "../src/lib/env";

/**
 * Creates the first attending from SEED_ADMIN_* environment variables.
 * Public sign-up is disabled, so this (and the Staff screen afterwards) is the only way accounts appear.
 * Refuses to run when an active attending already exists.
 */
async function main() {
  const env = seedAdminEnv();
  const db = getDb();

  const existing = await db
    .select({ id: schema.staffProfile.userId })
    .from(schema.staffProfile)
    .where(eq(schema.staffProfile.clinicalRole, "attending"));
  if (existing.length > 0) {
    console.log("An attending already exists. Nothing to do. Manage staff from the Staff screen.");
    process.exit(0);
  }

  const { user } = await getAuth().api.createUser({
    body: { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD, name: env.SEED_ADMIN_NAME, role: "admin" },
  });
  await db.insert(schema.staffProfile).values({
    userId: user.id,
    displayName: env.SEED_ADMIN_NAME,
    badgeNo: env.SEED_ADMIN_BADGE ?? null,
    clinicalRole: "attending",
  });
  await db.insert(schema.auditLog).values({
    actorId: "system",
    actorName: "seed script",
    action: "staff.create",
    entity: "staff_profile",
    entityId: user.id,
    before: null,
    after: { email: env.SEED_ADMIN_EMAIL, clinicalRole: "attending" },
  });
  console.log(`Created attending ${env.SEED_ADMIN_EMAIL}. Sign in, then remove SEED_ADMIN_PASSWORD from your environment.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
