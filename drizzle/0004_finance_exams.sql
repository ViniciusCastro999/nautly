CREATE TYPE "public"."payment_method" AS ENUM('pix', 'card', 'cash', 'transfer', 'other');--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"booking_id" text,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" DEFAULT 'pix' NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"description" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attachment" ADD COLUMN "reviewed_by_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_booking_uq" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_org_paid_idx" ON "payment" USING btree ("organization_id","paid_at");--> statement-breakpoint
CREATE INDEX "payment_contact_idx" ON "payment" USING btree ("contact_id");--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Exames já enviados antes desta versão contam como revisados.
UPDATE "attachment" SET "reviewed_at" = "created_at" WHERE "category" = 'exam';
