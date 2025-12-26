ALTER TABLE "dca_orders" ALTER COLUMN "total_sol_amount" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "dca_orders" ALTER COLUMN "reference_price" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "limit_orders" ALTER COLUMN "target_price_usd" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "limit_orders" ALTER COLUMN "sol_amount" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "pending_sells" ALTER COLUMN "token_amount" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "pending_sells" ALTER COLUMN "current_price" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "pending_sells" ALTER COLUMN "entry_price" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "pending_sells" ALTER COLUMN "current_profit" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "pending_sells" ALTER COLUMN "estimated_sol_received" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "entry_price_usd" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "token_amount" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "sol_spent" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "current_price" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "current_profit" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "current_profit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "highest_profit" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "highest_profit" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "exit_price_usd" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "positions" ALTER COLUMN "sol_received" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "tax_disposals" ALTER COLUMN "quantity_disposed" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "tax_disposals" ALTER COLUMN "proceeds_usd" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "tax_disposals" ALTER COLUMN "cost_basis_usd" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "tax_disposals" ALTER COLUMN "gain_loss_usd" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "tax_lots" ALTER COLUMN "quantity" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "tax_lots" ALTER COLUMN "remaining_quantity" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "tax_lots" ALTER COLUMN "cost_basis_per_token" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "sol_amount" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "token_amount" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "price_usd" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "price_sol" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "fee_sol" SET DATA TYPE numeric(28, 12);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "fee_sol" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "cost_basis_usd" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "realized_gain_loss_usd" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "wash_sale_disallowed" SET DATA TYPE numeric(28, 9);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "wash_sale_disallowed" SET DEFAULT '0';