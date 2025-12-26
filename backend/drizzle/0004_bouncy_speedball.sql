CREATE TABLE "telegram_users" (
	"wallet_public_key" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"username" text,
	"notify_trades" boolean DEFAULT true,
	"notify_dca" boolean DEFAULT true,
	"notify_exits" boolean DEFAULT true,
	"notify_errors" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
