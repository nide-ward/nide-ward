ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "display_username" text;--> statement-breakpoint
ALTER TABLE "staff_profile" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Existing accounts get a username from their email's local part (lowercase, invalid characters dropped),
-- so they can still sign in after the switch to username sign-in.
UPDATE "user" SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_.]', '', 'g')), "display_username" = regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9_.]', '', 'g') WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");