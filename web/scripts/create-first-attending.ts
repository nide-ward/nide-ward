import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import { getAuth } from "../src/lib/auth";
import { seedAdminEnv } from "../src/lib/env";
import { placeholderEmail } from "../src/lib/username";

/**
 * Creates the first attending from SEED_ADMIN_* environment variables (local .env.local only,
 * never on Vercel). Public sign-up is disabled, so this (and the Staff screen afterwards) is the
 * only way accounts appear. The seeded password is temporary: the attending sets their own at
 * first sign-in. Refuses to run when an attending already exists.
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

  const username = env.SEED_ADMIN_USERNAME; // validated and lowercased by the schema
  const { user } = await getAuth().api.createUser({
    body: {
      email: placeholderEmail(username),
      password: env.SEED_ADMIN_PASSWORD,
      name: env.SEED_ADMIN_NAME,
      role: "admin",
      data: { username, displayUsername: username },
    },
  });
  await db.insert(schema.staffProfile).values({
    userId: user.id,
    displayName: env.SEED_ADMIN_NAME,
    badgeNo: env.SEED_ADMIN_BADGE ?? null,
    clinicalRole: "attending",
    mustChangePassword: true,
  });
  await db.insert(schema.auditLog).values({
    actorId: "system",
    actorName: "seed script",
    action: "staff.create",
    entity: "staff_profile",
    entityId: user.id,
    before: null,
    after: { username, clinicalRole: "attending" },
  });
  console.log(`Created attending "${username}". Sign in, set your own password, then delete SEED_ADMIN_PASSWORD from .env.local.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
