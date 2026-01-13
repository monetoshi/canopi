ALTER TABLE "positions" ADD COLUMN "is_private" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "execution_wallet" text;