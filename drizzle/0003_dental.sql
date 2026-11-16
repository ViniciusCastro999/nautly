CREATE TYPE "public"."treatment_plan_status" AS ENUM('draft', 'presented', 'approved', 'rejected', 'completed');--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'odontogram_updated';--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'treatment_plan_updated';--> statement-breakpoint
ALTER TYPE "public"."access_action" ADD VALUE 'treatment_plan_approved';--> statement-breakpoint
ALTER TYPE "public"."document_kind" ADD VALUE 'certificate';--> statement-breakpoint
ALTER TYPE "public"."document_kind" ADD VALUE 'prescription';--> statement-breakpoint
CREATE TABLE "procedure" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"effect" text,
	"per_tooth" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tooth_record" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"tooth" smallint NOT NULL,
	"status" text DEFAULT 'healthy' NOT NULL,
	"surfaces" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_item" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"procedure_id" text,
	"description" text NOT NULL,
	"tooth" smallint,
	"surfaces" text,
	"price_cents" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_id" text
);
--> statement-breakpoint
CREATE TABLE "treatment_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "treatment_plan_status" DEFAULT 'draft' NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"approval_token" text NOT NULL,
	"valid_until" date,
	"approved_at" timestamp with time zone,
	"approved_by_name" text,
	"approved_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatment_plan_approval_token_unique" UNIQUE("approval_token")
);
--> statement-breakpoint
ALTER TABLE "procedure" ADD CONSTRAINT "procedure_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tooth_record" ADD CONSTRAINT "tooth_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tooth_record" ADD CONSTRAINT "tooth_record_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tooth_record" ADD CONSTRAINT "tooth_record_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_item" ADD CONSTRAINT "treatment_item_plan_id_treatment_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."treatment_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_item" ADD CONSTRAINT "treatment_item_procedure_id_procedure_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedure"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_item" ADD CONSTRAINT "treatment_item_done_by_id_user_id_fk" FOREIGN KEY ("done_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan" ADD CONSTRAINT "treatment_plan_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan" ADD CONSTRAINT "treatment_plan_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan" ADD CONSTRAINT "treatment_plan_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "procedure_org_idx" ON "procedure" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tooth_record_contact_tooth_uq" ON "tooth_record" USING btree ("contact_id","tooth");--> statement-breakpoint
CREATE INDEX "treatment_item_plan_idx" ON "treatment_item" USING btree ("plan_id","position");--> statement-breakpoint
CREATE INDEX "treatment_plan_contact_idx" ON "treatment_plan" USING btree ("contact_id","created_at");