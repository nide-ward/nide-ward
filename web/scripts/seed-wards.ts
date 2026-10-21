import { getDb, schema } from "../src/db";
import { WARDS } from "../src/db/wards";

/** Idempotent: safe to re-run after changing src/db/wards.ts. */
async function main() {
  const db = getDb();
  let order = 0;
  for (const [wardIndex, w] of WARDS.entries()) {
    await db
      .insert(schema.ward)
      .values({ id: w.id, title: w.title, description: w.description, sortOrder: wardIndex })
      .onConflictDoUpdate({
        target: schema.ward.id,
        set: { title: w.title, description: w.description, sortOrder: wardIndex },
      });
    for (const b of w.beds) {
      order += 1;
      await db
        .insert(schema.bed)
        .values({ id: b.id, wardId: w.id, name: b.name, type: b.type, sortOrder: order })
        .onConflictDoUpdate({
          target: schema.bed.id,
          set: { wardId: w.id, name: b.name, type: b.type, sortOrder: order },
        });
    }
  }
  console.log(`Seeded ${WARDS.length} wards and ${order} beds.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
