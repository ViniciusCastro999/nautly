CREATE TYPE "public"."anamnesis_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."attendance" AS ENUM('attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('receipt', 'attendance');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('weekly', 'biweekly');--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'anamnesis_viewed';--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'anamnesis_filled';--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'measurement_created';--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'document_issued';--> statement-breakpoint
CREATE TABLE "anamnesis" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"template_id" text NOT NULL,
	"status" "anamnesis_status" DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"answers_encrypted" text,
	"filled_by" text,
	"requested_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "anamnesis_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "booking_series" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"host_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"event_type_id" text NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issued_document" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"issued_by_id" text NOT NULL,
	"kind" "document_kind" NOT NULL,
	"number" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"author_id" text NOT NULL,
	"measured_on" date NOT NULL,
	"weight_kg" numeric(5, 2),
	"height_cm" numeric(5, 1),
	"waist_cm" numeric(5, 1),
	"hip_cm" numeric(5, 1),
	"body_fat_pct" numeric(4, 1),
	"muscle_mass_kg" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "attendance" "attendance";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "event_type" ADD COLUMN "price_cents" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anamnesis" ADD CONSTRAINT "anamnesis_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_event_type_id_event_type_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_document" ADD CONSTRAINT "issued_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_document" ADD CONSTRAINT "issued_document_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_document" ADD CONSTRAINT "issued_document_issued_by_id_user_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anamnesis_contact_idx" ON "anamnesis" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "issued_document_org_number_uq" ON "issued_document" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "issued_document_contact_idx" ON "issued_document" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "measurement_contact_idx" ON "measurement" USING btree ("contact_id","measured_on");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_series_id_booking_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."booking_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_series_idx" ON "booking" USING btree ("series_id");