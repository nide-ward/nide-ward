-- Roles rework: nurse is removed, admin is added. Existing attendings become admins (they keep
-- staff management), any nurse becomes a resident. Postgres cannot drop an enum value in place,
-- so the type is rebuilt: new type, remapped column, old type dropped, new type renamed back.
ALTER TABLE "staff_profile" ALTER COLUMN "clinical_role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."clinical_role";--> statement-breakpoint
CREATE TYPE "public"."clinical_role" AS ENUM('admin', 'attending', 'resident');--> statement-breakpoint
ALTER TABLE "staff_profile" ALTER COLUMN "clinical_role" SET DATA TYPE "public"."clinical_role" USING (CASE "clinical_role" WHEN 'attending' THEN 'admin' WHEN 'nurse' THEN 'resident' ELSE "clinical_role" END)::"public"."clinical_role";--> statement-breakpoint
UPDATE "user" SET "role" = CASE WHEN "id" IN (SELECT "user_id" FROM "staff_profile" WHERE "clinical_role" = 'admin') THEN 'admin' ELSE 'user' END WHERE "id" IN (SELECT "user_id" FROM "staff_profile");
