import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

import { getDb, schema } from "../src/db";
import { getAuth, platformRoleFor } from "../src/lib/auth";
import { normalizeUsername, placeholderEmail } from "../src/lib/username";

/**
 * Creates or updates one admin account from CLI args:
 *   bun scripts/upsert-admin.ts <username> <displayName> <password>
 * Sets mustChangePassword=false so the given password is usable immediately.
 */
async function main() {
  const [usernameRaw, displayName, password] = process.argv.slice(2);
  if (!usernameRaw || !displayName || !password) {
    console.error("Usage: bun scripts/upsert-admin.ts <username> <displayName> <password>");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }

  const username = normalizeUsername(usernameRaw);
  const db = getDb();
  const auth = getAuth();

  const [existing] = await db
    .select({ userId: schema.user.id, profile: schema.staffProfile })
    .from(schema.user)
    .leftJoin(schema.staffProfile, eq(schema.staffProfile.userId, schema.user.id))
    .where(eq(schema.user.username, username))
    .limit(1);

  if (existing) {
    const headers = new Headers();
    await auth.api.setUserPassword({ body: { userId: existing.userId, newPassword: password }, headers });
    await auth.api.setRole({ body: { userId: existing.userId, role: platformRoleFor("admin") }, headers });
    await auth.api.revokeUserSessions({ body: { userId: existing.userId }, headers });
    if (existing.profile) {
      await db
        .update(schema.staffProfile)
        .set({
          displayName,
          clinicalRole: "admin",
          active: true,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.staffProfile.userId, existing.userId));
    } else {
      await db.insert(schema.staffProfile).values({
        userId: existing.userId,
        displayName,
        clinicalRole: "admin",
        mustChangePassword: false,
      });
    }
    await db
      .update(schema.user)
      .set({ name: displayName, role: "admin", updatedAt: new Date() })
      .where(eq(schema.user.id, existing.userId));
    console.log(`Updated admin "${username}" (${displayName}).`);
    process.exit(0);
  }

  const { user } = await auth.api.createUser({
    body: {
      email: placeholderEmail(username),
      password,
      name: displayName,
      role: "admin",
      data: { username, displayUsername: username },
    },
  });
  await db.insert(schema.staffProfile).values({
    userId: user.id,
    displayName,
    clinicalRole: "admin",
    mustChangePassword: false,
  });
  await db.insert(schema.auditLog).values({
    actorId: "system",
    actorName: "upsert-admin script",
    action: "staff.create",
    entity: "staff_profile",
    entityId: user.id,
    before: null,
    after: { username, clinicalRole: "admin", displayName },
  });
  console.log(`Created admin "${username}" (${displayName}).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
