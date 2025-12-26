CREATE TABLE "dca_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_public_key" text NOT NULL,
	"token_mint" text NOT NULL,
	"total_sol_amount" numeric(18, 9) NOT NULL,
	"number_of_buys" integer NOT NULL,
	"interval_minutes" integer NOT NULL,
	"current_buy" integer DEFAULT 0,
	"last_buy_time" timestamp,
	"next_buy_time" timestamp,
	"exit_strategy" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limit_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_public_key" text NOT NULL,
	"token_mint" text NOT NULL,
	"type" varchar(10) NOT NULL,
	"target_price_usd" numeric(18, 9) NOT NULL,
	"sol_amount" numeric(18, 9) NOT NULL,
	"condition" varchar(20) NOT NULL,
	"exit_strategy" varchar(50),
	"status" varchar(20) DEFAULT 'active',
	"filled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_public_key" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"total_value_usd" numeric(18, 2) NOT NULL,
	"sol_balance" numeric(18, 9) NOT NULL,
	"num_positions" integer NOT NULL,
	"total_profit_loss_usd" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_public_key" text NOT NULL,
	"token_mint" text NOT NULL,
	"entry_time" timestamp NOT NULL,
	"entry_price_usd" numeric(18, 9) NOT NULL,
	"token_amount" numeric(18, 9) NOT NULL,
	"sol_spent" numeric(18, 9) NOT NULL,
	"current_price" numeric(18, 9),
	"current_profit" numeric(8, 4),
	"highest_profit" numeric(8, 4) DEFAULT '0',
	"exit_time" timestamp,
	"exit_price_usd" numeric(18, 9),
	"sol_received" numeric(18, 9),
	"strategy" varchar(50) NOT NULL,
	"exit_stages_completed" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sell_trade_id" uuid NOT NULL,
	"tax_lot_id" uuid NOT NULL,
	"quantity_disposed" numeric(18, 9) NOT NULL,
	"proceeds_usd" numeric(18, 9) NOT NULL,
	"cost_basis_usd" numeric(18, 9) NOT NULL,
	"gain_loss_usd" numeric(18, 9) NOT NULL,
	"holding_period_days" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_public_key" text NOT NULL,
	"token_mint" text NOT NULL,
	"buy_trade_id" uuid NOT NULL,
	"quantity" numeric(18, 9) NOT NULL,
	"remaining_quantity" numeric(18, 9) NOT NULL,
	"cost_basis_per_token" numeric(18, 9) NOT NULL,
	"acquisition_date" timestamp NOT NULL,
	"disposed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_settings" (
	"wallet_public_key" text PRIMARY KEY NOT NULL,
	"cost_basis_method" varchar(20) DEFAULT 'FIFO',
	"tax_year" integer DEFAULT 2025,
	"track_wash_sales" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_public_key" text NOT NULL,
	"token_mint" text NOT NULL,
	"position_id" uuid,
	"type" varchar(10) NOT NULL,
	"sol_amount" numeric(18, 9) NOT NULL,
	"token_amount" numeric(18, 9) NOT NULL,
	"price_usd" numeric(18, 9) NOT NULL,
	"price_sol" numeric(18, 9) NOT NULL,
	"fee_sol" numeric(18, 9) DEFAULT '0',
	"entry_strategy" varchar(50),
	"exit_strategy" varchar(50),
	"signature" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"cost_basis_usd" numeric(18, 9),
	"cost_basis_method" varchar(20),
	"realized_gain_loss_usd" numeric(18, 9),
	"holding_period_days" integer,
	"is_short_term" boolean,
	"is_wash_sale" boolean DEFAULT false,
	"wash_sale_disallowed" numeric(18, 9) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trades_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
ALTER TABLE "tax_disposals" ADD CONSTRAINT "tax_disposals_sell_trade_id_trades_id_fk" FOREIGN KEY ("sell_trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_disposals" ADD CONSTRAINT "tax_disposals_tax_lot_id_tax_lots_id_fk" FOREIGN KEY ("tax_lot_id") REFERENCES "public"."tax_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_lots" ADD CONSTRAINT "tax_lots_buy_trade_id_trades_id_fk" FOREIGN KEY ("buy_trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dca_orders_wallet_idx" ON "dca_orders" USING btree ("wallet_public_key");--> statement-breakpoint
CREATE INDEX "dca_orders_status_idx" ON "dca_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dca_orders_next_buy_time_idx" ON "dca_orders" USING btree ("next_buy_time");--> statement-breakpoint
CREATE INDEX "limit_orders_wallet_idx" ON "limit_orders" USING btree ("wallet_public_key");--> statement-breakpoint
CREATE INDEX "limit_orders_status_idx" ON "limit_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "limit_orders_token_idx" ON "limit_orders" USING btree ("token_mint");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_wallet_timestamp_idx" ON "portfolio_snapshots" USING btree ("wallet_public_key","timestamp");--> statement-breakpoint
CREATE INDEX "positions_wallet_idx" ON "positions" USING btree ("wallet_public_key");--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "positions_token_idx" ON "positions" USING btree ("token_mint");--> statement-breakpoint
CREATE INDEX "tax_disposals_sell_trade_idx" ON "tax_disposals" USING btree ("sell_trade_id");--> statement-breakpoint
CREATE INDEX "tax_disposals_tax_lot_idx" ON "tax_disposals" USING btree ("tax_lot_id");--> statement-breakpoint
CREATE INDEX "tax_lots_wallet_token_idx" ON "tax_lots" USING btree ("wallet_public_key","token_mint");--> statement-breakpoint
CREATE INDEX "tax_lots_buy_trade_idx" ON "tax_lots" USING btree ("buy_trade_id");--> statement-breakpoint
CREATE INDEX "tax_lots_disposed_idx" ON "tax_lots" USING btree ("disposed");--> statement-breakpoint
CREATE INDEX "trades_wallet_timestamp_idx" ON "trades" USING btree ("wallet_public_key","timestamp");--> statement-breakpoint
CREATE INDEX "trades_token_idx" ON "trades" USING btree ("token_mint");--> statement-breakpoint
CREATE INDEX "trades_position_idx" ON "trades" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "trades_type_idx" ON "trades" USING btree ("type");--> statement-breakpoint
CREATE INDEX "trades_signature_idx" ON "trades" USING btree ("signature");