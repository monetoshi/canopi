ALTER TABLE "tax_settings" ALTER COLUMN "tax_year" SET DEFAULT 2026;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "is_private" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "execution_wallet" text;