CREATE TYPE "public"."admission_status" AS ENUM('active', 'discharged');--> statement-breakpoint
CREATE TYPE "public"."bed_type" AS ENUM('regular', 'extra', 'paid', 'overflow');--> statement-breakpoint
CREATE TYPE "public"."clinical_role" AS ENUM('attending', 'resident', 'nurse');--> statement-breakpoint
CREATE TYPE "public"."urine_acetone" AS ENUM('Negative', 'Trace', '+', '++', '+++', '++++');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "abg_reading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_id" uuid NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"ph" double precision,
	"pco2" double precision,
	"po2" double precision,
	"hco3" double precision,
	"hco3_std" double precision,
	"na" double precision,
	"k" double precision,
	"cl" double precision,
	"ca" double precision,
	"rbg" double precision,
	"hb" double precision,
	"recorded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_id" text NOT NULL,
	"patient_name" text NOT NULL,
	"age" integer NOT NULL,
	"diagnosis" text NOT NULL,
	"risk_factors" text DEFAULT '' NOT NULL,
	"admitted_at" timestamp with time zone NOT NULL,
	"admitted_by" text NOT NULL,
	"status" "admission_status" DEFAULT 'active' NOT NULL,
	"urine_acetone" "urine_acetone" DEFAULT 'Negative' NOT NULL,
	"current_rbg" double precision,
	"labs_imaging" text DEFAULT '' NOT NULL,
	"consultations" text DEFAULT '' NOT NULL,
	"followup_plan" text DEFAULT '' NOT NULL,
	"discharged_at" timestamp with time zone,
	"discharged_by" text,
	"discharge_outcome" text,
	"discharge_notes" text,
	"attending_at_discharge" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bed" (
	"id" text PRIMARY KEY NOT NULL,
	"ward_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "bed_type" NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insulin_regimen" (
	"admission_id" uuid PRIMARY KEY NOT NULL,
	"basal_units" double precision DEFAULT 0 NOT NULL,
	"basal_label" text DEFAULT 'Lantus (Glargine) at 11:00 PM' NOT NULL,
	"breakfast_units" double precision DEFAULT 0 NOT NULL,
	"breakfast_notes" text DEFAULT 'Actrapid before breakfast (9:00 AM)' NOT NULL,
	"lunch_units" double precision DEFAULT 0 NOT NULL,
	"lunch_notes" text DEFAULT 'Actrapid before lunch (3:00 PM)' NOT NULL,
	"dinner_units" double precision DEFAULT 0 NOT NULL,
	"dinner_notes" text DEFAULT 'Actrapid before dinner (9:00 PM)' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"original_name" text DEFAULT '' NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_media_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "medication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admission_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dose" text DEFAULT '--' NOT NULL,
	"frequency" text DEFAULT 'OD' NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_roster" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc1" text NOT NULL,
	"doc2" text,
	"attending" text NOT NULL,
	"shift_start" text DEFAULT '09:00 AM' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"badge_no" text,
	"clinical_role" "clinical_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ward" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abg_reading" ADD CONSTRAINT "abg_reading_admission_id_admission_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission" ADD CONSTRAINT "admission_bed_id_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."bed"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bed" ADD CONSTRAINT "bed_ward_id_ward_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."ward"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insulin_regimen" ADD CONSTRAINT "insulin_regimen_admission_id_admission_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_media" ADD CONSTRAINT "lab_media_admission_id_admission_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication" ADD CONSTRAINT "medication_admission_id_admission_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profile" ADD CONSTRAINT "staff_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abg_admission_time_idx" ON "abg_reading" USING btree ("admission_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_one_active_per_bed" ON "admission" USING btree ("bed_id") WHERE "admission"."status" = 'active';--> statement-breakpoint
CREATE INDEX "admission_status_idx" ON "admission" USING btree ("status","discharged_at");--> statement-breakpoint
CREATE INDEX "admission_name_idx" ON "admission" USING btree ("patient_name");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id","at");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "bed_ward_idx" ON "bed" USING btree ("ward_id","sort_order");--> statement-breakpoint
CREATE INDEX "lab_media_admission_idx" ON "lab_media" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "medication_admission_idx" ON "medication" USING btree ("admission_id");