CREATE TABLE "pending_sells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_public_key" text NOT NULL,
	"token_mint" text NOT NULL,
	"token_symbol" text,
	"sell_percentage" integer NOT NULL,
	"token_amount" numeric(18, 9) NOT NULL,
	"current_price" numeric(18, 9) NOT NULL,
	"entry_price" numeric(18, 9) NOT NULL,
	"current_profit" numeric(8, 4) NOT NULL,
	"estimated_sol_received" numeric(18, 9) NOT NULL,
	"reason" text NOT NULL,
	"strategy" varchar(50) NOT NULL,
	"slippage_bps" integer DEFAULT 300,
	"prepared_transaction" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"signature" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "current_profit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "dca_orders" ADD COLUMN "token_symbol" text;--> statement-breakpoint
ALTER TABLE "dca_orders" ADD COLUMN "strategy_type" varchar(50) DEFAULT 'time-based' NOT NULL;--> statement-breakpoint
ALTER TABLE "dca_orders" ADD COLUMN "slippage_bps" integer DEFAULT 200;--> statement-breakpoint
ALTER TABLE "dca_orders" ADD COLUMN "completed_buys" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "dca_orders" ADD COLUMN "reference_price" numeric(18, 9);--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "token_symbol" text;--> statement-breakpoint
ALTER TABLE "limit_orders" ADD COLUMN "slippage_bps" integer DEFAULT 200;--> statement-breakpoint
CREATE INDEX "pending_sells_wallet_idx" ON "pending_sells" USING btree ("wallet_public_key");--> statement-breakpoint
CREATE INDEX "pending_sells_status_idx" ON "pending_sells" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_sells_token_idx" ON "pending_sells" USING btree ("token_mint");