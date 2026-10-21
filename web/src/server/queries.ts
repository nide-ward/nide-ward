import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getReadDb, schema } from "@/db";

const { admission, abgReading, bed, insulinRegimen, labMedia, medication, shiftRoster, staffProfile, ward } = schema;

export type AbgRow = typeof abgReading.$inferSelect;
export type AdmissionRow = typeof admission.$inferSelect;

export interface BoardBed {
  id: string;
  name: string;
  type: (typeof bed.$inferSelect)["type"];
  admission: null | {
    id: string;
    patientName: string;
    age: number | null;
    diagnosis: string;
    latestAbg: AbgRow | null;
    basalUnits: number;
    mediaCount: number;
  };
}
export interface BoardWard {
  id: string;
  title: string;
  description: string;
  beds: BoardBed[];
}

/** All wards and beds with current occupancy, latest ABG, basal dose and photo count. */
export async function getBoard(): Promise<BoardWard[]> {
  const db = getReadDb();
  const [wards, beds, active] = await Promise.all([
    db.select().from(ward).orderBy(asc(ward.sortOrder)),
    db.select().from(bed).orderBy(asc(bed.sortOrder)),
    db.select().from(admission).where(eq(admission.status, "active")),
  ]);
  const ids = active.map((a) => a.id);
  const [latest, regimens, media] = ids.length
    ? await Promise.all([
        db
          .selectDistinctOn([abgReading.admissionId])
          .from(abgReading)
          .where(inArray(abgReading.admissionId, ids))
          .orderBy(abgReading.admissionId, desc(abgReading.takenAt), desc(abgReading.createdAt)),
        db.select().from(insulinRegimen).where(inArray(insulinRegimen.admissionId, ids)),
        db
          .select({ admissionId: labMedia.admissionId, n: count() })
          .from(labMedia)
          .where(inArray(labMedia.admissionId, ids))
          .groupBy(labMedia.admissionId),
      ])
    : [[], [], []];

  const latestBy = new Map(latest.map((r) => [r.admissionId, r]));
  const basalBy = new Map(regimens.map((r) => [r.admissionId, r.basalUnits]));
  const mediaBy = new Map(media.map((r) => [r.admissionId, r.n]));
  const activeByBed = new Map(active.map((a) => [a.bedId, a]));

  return wards.map((w) => ({
    id: w.id,
    title: w.title,
    description: w.description,
    beds: beds
      .filter((b) => b.wardId === w.id)
      .map((b) => {
        const a = activeByBed.get(b.id);
        return {
          id: b.id,
          name: b.name,
          type: b.type,
          admission: a
            ? {
                id: a.id,
                patientName: a.patientName,
                age: a.age,
                diagnosis: a.diagnosis,
                latestAbg: latestBy.get(a.id) ?? null,
                basalUnits: basalBy.get(a.id) ?? 0,
                mediaCount: mediaBy.get(a.id) ?? 0,
              }
            : null,
        };
      }),
  }));
}

export async function getBed(bedId: string) {
  const [row] = await getReadDb()
    .select({ bed: bed, ward: ward })
    .from(bed)
    .innerJoin(ward, eq(ward.id, bed.wardId))
    .where(eq(bed.id, bedId));
  return row ?? null;
}

export async function getActiveAdmissionIdForBed(bedId: string) {
  const [row] = await getReadDb()
    .select({ id: admission.id })
    .from(admission)
    .where(and(eq(admission.bedId, bedId), eq(admission.status, "active")));
  return row?.id ?? null;
}

/** Everything the chart needs, for an active or discharged admission. */
export async function getAdmissionDetail(id: string) {
  const db = getReadDb();
  const [[head], abgs, regimen, meds, media] = await Promise.all([
    db
      .select({ admission: admission, bed: bed, ward: ward })
      .from(admission)
      .innerJoin(bed, eq(bed.id, admission.bedId))
      .innerJoin(ward, eq(ward.id, bed.wardId))
      .where(eq(admission.id, id)),
    db.select().from(abgReading).where(eq(abgReading.admissionId, id)).orderBy(asc(abgReading.takenAt), asc(abgReading.createdAt)),
    db.select().from(insulinRegimen).where(eq(insulinRegimen.admissionId, id)),
    db.select().from(medication).where(eq(medication.admissionId, id)).orderBy(asc(medication.createdAt)),
    db.select().from(labMedia).where(eq(labMedia.admissionId, id)).orderBy(asc(labMedia.createdAt)),
  ]);
  if (!head) return null;
  return { ...head, abgs, regimen: regimen[0] ?? null, meds, media };
}
export type AdmissionDetail = NonNullable<Awaited<ReturnType<typeof getAdmissionDetail>>>;

/** Lightweight version used by polling to detect that the chart changed under an open form. */
export async function getAdmissionVersion(id: string) {
  const [row] = await getReadDb().select({ version: admission.version }).from(admission).where(eq(admission.id, id));
  return row?.version ?? null;
}

const PAGE_SIZE = 25;

export async function listArchive(search: string, page: number) {
  const db = getReadDb();
  const term = search.trim();
  const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  const where = and(
    eq(admission.status, "discharged"),
    term
      ? or(
          ilike(admission.patientName, like),
          ilike(admission.diagnosis, like),
          ilike(admission.bedId, like),
          sql`to_char(${admission.dischargedAt} at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI') ilike ${like}`,
        )
      : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ admission: admission, bed: bed, ward: ward })
      .from(admission)
      .innerJoin(bed, eq(bed.id, admission.bedId))
      .innerJoin(ward, eq(ward.id, bed.wardId))
      .where(where)
      .orderBy(desc(admission.dischargedAt))
      .limit(PAGE_SIZE)
      .offset(Math.max(0, page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(admission).where(where),
  ]);
  const ids = rows.map((r) => r.admission.id);
  const [latest, regimens] = ids.length
    ? await Promise.all([
        db
          .selectDistinctOn([abgReading.admissionId])
          .from(abgReading)
          .where(inArray(abgReading.admissionId, ids))
          .orderBy(abgReading.admissionId, desc(abgReading.takenAt), desc(abgReading.createdAt)),
        db.select().from(insulinRegimen).where(inArray(insulinRegimen.admissionId, ids)),
      ])
    : [[], []];
  const latestBy = new Map(latest.map((r) => [r.admissionId, r]));
  const regBy = new Map(regimens.map((r) => [r.admissionId, r]));
  return {
    total,
    pageSize: PAGE_SIZE,
    rows: rows.map((r) => ({ ...r, latestAbg: latestBy.get(r.admission.id) ?? null, regimen: regBy.get(r.admission.id) ?? null })),
  };
}

export async function getRoster() {
  const [row] = await getReadDb().select().from(shiftRoster).orderBy(desc(shiftRoster.id)).limit(1);
  return row ?? null;
}

export async function listStaff() {
  const db = getReadDb();
  const [profiles, users] = await Promise.all([
    db.select().from(staffProfile).orderBy(asc(staffProfile.displayName)),
    db.select({ id: schema.user.id, username: schema.user.username }).from(schema.user),
  ]);
  const usernameBy = new Map(users.map((u) => [u.id, u.username ?? ""]));
  return profiles.map((p) => ({ ...p, username: usernameBy.get(p.userId) ?? "" }));
}

/** Census for the print view: every bed in every ward with its active patient detail. */
export async function getCensus() {
  const board = await getBoard();
  const db = getReadDb();
  const ids = board.flatMap((w) => w.beds.map((b) => b.admission?.id).filter((x): x is string => !!x));
  const [regimens, meds, fullAdm] = ids.length
    ? await Promise.all([
        db.select().from(insulinRegimen).where(inArray(insulinRegimen.admissionId, ids)),
        db.select().from(medication).where(inArray(medication.admissionId, ids)),
        db.select().from(admission).where(inArray(admission.id, ids)),
      ])
    : [[], [], []];
  return {
    board,
    admissions: new Map(fullAdm.map((a) => [a.id, a])),
    regimens: new Map(regimens.map((r) => [r.admissionId, r])),
    meds,
  };
}
