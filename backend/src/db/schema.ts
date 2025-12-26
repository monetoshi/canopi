/**
 * Drizzle ORM Database Schema
 * Complete schema for Canopi trading bot with tax tracking
 */

import { pgTable, uuid, text, decimal, timestamp, boolean, integer, varchar, index, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// POSITIONS TABLE
// ============================================================================
export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletPublicKey: text('wallet_public_key').notNull(),
  tokenMint: text('token_mint').notNull(),

  // Entry information
  entryTime: timestamp('entry_time').notNull(),
  entryPriceUsd: decimal('entry_price_usd', { precision: 28, scale: 12 }).notNull(),
  tokenAmount: decimal('token_amount', { precision: 28, scale: 9 }).notNull(),
  solSpent: decimal('sol_spent', { precision: 28, scale: 9 }).notNull(),

  // Current status
  currentPrice: decimal('current_price', { precision: 28, scale: 12 }),
  currentProfit: decimal('current_profit', { precision: 12, scale: 4 }).default('0'), // Percentage
  highestProfit: decimal('highest_profit', { precision: 12, scale: 4 }).default('0'),

  // Exit information
  exitTime: timestamp('exit_time'),
  exitPriceUsd: decimal('exit_price_usd', { precision: 28, scale: 12 }),
  solReceived: decimal('sol_received', { precision: 28, scale: 9 }),

  // Strategy
  strategy: varchar('strategy', { length: 50 }).notNull(), // 'aggressive', 'moderate', 'hodl', 'dca', etc.
  exitStagesCompleted: integer('exit_stages_completed').default(0),

  // Status
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'closing', 'closed'

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  walletIdx: index('positions_wallet_idx').on(table.walletPublicKey),
  statusIdx: index('positions_status_idx').on(table.status),
  tokenIdx: index('positions_token_idx').on(table.tokenMint),
}));

// ============================================================================
// TRADES TABLE (Buy & Sell transactions)
// ============================================================================
export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletPublicKey: text('wallet_public_key').notNull(),
  tokenMint: text('token_mint').notNull(),
  positionId: uuid('position_id').references(() => positions.id),

  // Trade details
  type: varchar('type', { length: 10 }).notNull(), // 'BUY' or 'SELL'
  solAmount: decimal('sol_amount', { precision: 28, scale: 9 }).notNull(),
  tokenAmount: decimal('token_amount', { precision: 28, scale: 9 }).notNull(),
  priceUsd: decimal('price_usd', { precision: 28, scale: 12 }).notNull(),
  priceSol: decimal('price_sol', { precision: 28, scale: 12 }).notNull(),
  feeSol: decimal('fee_sol', { precision: 28, scale: 12 }).default('0'),

  // Strategy context
  entryStrategy: varchar('entry_strategy', { length: 50 }), // 'instant', 'limit', 'dca'
  exitStrategy: varchar('exit_strategy', { length: 50 }), // strategy name

  // Blockchain
  signature: text('signature').notNull().unique(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),

  // Tax-specific fields
  costBasisUsd: decimal('cost_basis_usd', { precision: 28, scale: 9 }),
  costBasisMethod: varchar('cost_basis_method', { length: 20 }), // 'FIFO', 'LIFO', 'SPECIFIC_ID'
  realizedGainLossUsd: decimal('realized_gain_loss_usd', { precision: 28, scale: 9 }),
  holdingPeriodDays: integer('holding_period_days'),
  isShortTerm: boolean('is_short_term'),
  isWashSale: boolean('is_wash_sale').default(false),
  washSaleDisallowed: decimal('wash_sale_disallowed', { precision: 28, scale: 9 }).default('0'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  walletTimestampIdx: index('trades_wallet_timestamp_idx').on(table.walletPublicKey, table.timestamp),
  tokenIdx: index('trades_token_idx').on(table.tokenMint),
  positionIdx: index('trades_position_idx').on(table.positionId),
  typeIdx: index('trades_type_idx').on(table.type),
  signatureIdx: index('trades_signature_idx').on(table.signature),
}));

// ============================================================================
// TAX LOTS (For FIFO/LIFO/Specific ID tracking)
// ============================================================================
export const taxLots = pgTable('tax_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletPublicKey: text('wallet_public_key').notNull(),
  tokenMint: text('token_mint').notNull(),
  buyTradeId: uuid('buy_trade_id').references(() => trades.id).notNull(),

  // Lot details
  quantity: decimal('quantity', { precision: 28, scale: 9 }).notNull(),
  remainingQuantity: decimal('remaining_quantity', { precision: 28, scale: 9 }).notNull(),
  costBasisPerToken: decimal('cost_basis_per_token', { precision: 28, scale: 12 }).notNull(),
  acquisitionDate: timestamp('acquisition_date').notNull(),

  // Status
  disposed: boolean('disposed').default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  walletTokenIdx: index('tax_lots_wallet_token_idx').on(table.walletPublicKey, table.tokenMint),
  buyTradeIdx: index('tax_lots_buy_trade_idx').on(table.buyTradeId),
  disposedIdx: index('tax_lots_disposed_idx').on(table.disposed),
}));

// ============================================================================
// TAX DISPOSALS (Matching sells to lots)
// ============================================================================
export const taxDisposals = pgTable('tax_disposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellTradeId: uuid('sell_trade_id').references(() => trades.id).notNull(),
  taxLotId: uuid('tax_lot_id').references(() => taxLots.id).notNull(),

  // Disposal details
  quantityDisposed: decimal('quantity_disposed', { precision: 28, scale: 9 }).notNull(),
  proceedsUsd: decimal('proceeds_usd', { precision: 28, scale: 9 }).notNull(),
  costBasisUsd: decimal('cost_basis_usd', { precision: 28, scale: 9 }).notNull(),
  gainLossUsd: decimal('gain_loss_usd', { precision: 28, scale: 9 }).notNull(),
  holdingPeriodDays: integer('holding_period_days').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sellTradeIdx: index('tax_disposals_sell_trade_idx').on(table.sellTradeId),
  taxLotIdx: index('tax_disposals_tax_lot_idx').on(table.taxLotId),
}));

// ============================================================================
// TAX SETTINGS (User preferences)
// ============================================================================
export const taxSettings = pgTable('tax_settings', {
  walletPublicKey: text('wallet_public_key').primaryKey(),

  // Preferences
  costBasisMethod: varchar('cost_basis_method', { length: 20 }).default('FIFO'), // 'FIFO', 'LIFO', 'SPECIFIC_ID'
  taxYear: integer('tax_year').default(new Date().getFullYear()),
  trackWashSales: boolean('track_wash_sales').default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// DCA ORDERS
// ============================================================================
export const dcaOrders = pgTable('dca_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletPublicKey: text('wallet_public_key').notNull(),
  tokenMint: text('token_mint').notNull(),
  tokenSymbol: text('token_symbol'),
  strategyType: varchar('strategy_type', { length: 50 }).notNull().default('time-based'),

  // Order configuration
  totalSolAmount: decimal('total_sol_amount', { precision: 28, scale: 9 }).notNull(),
  numberOfBuys: integer('number_of_buys').notNull(),
  intervalMinutes: integer('interval_minutes').notNull(),
  slippageBps: integer('slippage_bps').default(200),

  // Current status
  currentBuy: integer('current_buy').default(0),
  lastBuyTime: timestamp('last_buy_time'),
  nextBuyTime: timestamp('next_buy_time'),
  completedBuys: jsonb('completed_buys').default([]),
  referencePrice: decimal('reference_price', { precision: 28, scale: 12 }),
  isPrivate: boolean('is_private').default(false),

  // Exit strategy for position
  exitStrategy: varchar('exit_strategy', { length: 50 }).notNull(),

  // Status
  status: varchar('status', { length: 20 }).default('active'), // 'active', 'paused', 'completed', 'cancelled'

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  walletIdx: index('dca_orders_wallet_idx').on(table.walletPublicKey),
  statusIdx: index('dca_orders_status_idx').on(table.status),
  nextBuyTimeIdx: index('dca_orders_next_buy_time_idx').on(table.nextBuyTime),
}));

// ============================================================================
// LIMIT ORDERS
// ============================================================================
export const limitOrders = pgTable('limit_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletPublicKey: text('wallet_public_key').notNull(),
  tokenMint: text('token_mint').notNull(),
  tokenSymbol: text('token_symbol'),

  // Order details
  type: varchar('type', { length: 10 }).notNull(), // 'BUY' or 'SELL'
  targetPriceUsd: decimal('target_price_usd', { precision: 28, scale: 12 }).notNull(),
  solAmount: decimal('sol_amount', { precision: 28, scale: 9 }).notNull(),
  slippageBps: integer('slippage_bps').default(200),

  // Conditions
  condition: varchar('condition', { length: 20 }).notNull(), // 'ABOVE', 'BELOW'

  // Exit strategy (for buy orders)
  exitStrategy: varchar('exit_strategy', { length: 50 }),

  // Privacy (Stealth Limit Orders)
  isPrivate: boolean('is_private').default(false),
  executionWallet: text('execution_wallet'),

  // Status
  status: varchar('status', { length: 20 }).default('active'), // 'active', 'filled', 'cancelled', 'expired'
  filledAt: timestamp('filled_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  walletIdx: index('limit_orders_wallet_idx').on(table.walletPublicKey),
  statusIdx: index('limit_orders_status_idx').on(table.status),
  tokenIdx: index('limit_orders_token_idx').on(table.tokenMint),
}));

// ============================================================================
// PENDING SELLS (Auto-Exit triggers)
// ============================================================================
export const pendingSells = pgTable('pending_sells', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletPublicKey: text('wallet_public_key').notNull(),
  tokenMint: text('token_mint').notNull(),
  tokenSymbol: text('token_symbol'),

  // Sell details
  sellPercentage: integer('sell_percentage').notNull(),
  tokenAmount: decimal('token_amount', { precision: 28, scale: 9 }).notNull(),
  currentPrice: decimal('current_price', { precision: 28, scale: 12 }).notNull(),
  entryPrice: decimal('entry_price', { precision: 28, scale: 12 }).notNull(),
  currentProfit: decimal('current_profit', { precision: 12, scale: 4 }).notNull(),
  estimatedSolReceived: decimal('estimated_sol_received', { precision: 28, scale: 9 }).notNull(),

  // Context
  reason: text('reason').notNull(),
  strategy: varchar('strategy', { length: 50 }).notNull(),
  slippageBps: integer('slippage_bps').default(300),
  preparedTransaction: text('prepared_transaction').notNull(),

  // Status
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'executing', 'executed', 'cancelled', 'expired'
  signature: text('signature'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  walletIdx: index('pending_sells_wallet_idx').on(table.walletPublicKey),
  statusIdx: index('pending_sells_status_idx').on(table.status),
  tokenIdx: index('pending_sells_token_idx').on(table.tokenMint),
}));

// ============================================================================
// PORTFOLIO SNAPSHOTS (For historical tracking)
// ============================================================================
export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletPublicKey: text('wallet_public_key').notNull(),

  // Portfolio values
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  totalValueUsd: decimal('total_value_usd', { precision: 18, scale: 2 }).notNull(),
  solBalance: decimal('sol_balance', { precision: 18, scale: 9 }).notNull(),
  numPositions: integer('num_positions').notNull(),
  totalProfitLossUsd: decimal('total_profit_loss_usd', { precision: 18, scale: 2 }).notNull(),
}, (table) => ({
  walletTimestampIdx: index('portfolio_snapshots_wallet_timestamp_idx').on(table.walletPublicKey, table.timestamp),
}));

// ============================================================================
// RELATIONS (for Drizzle queries)
// ============================================================================

export const positionsRelations = relations(positions, ({ many }) => ({
  trades: many(trades),
}));

export const tradesRelations = relations(trades, ({ one, many }) => ({
  position: one(positions, {
    fields: [trades.positionId],
    references: [positions.id],
  }),
  taxLots: many(taxLots),
  disposals: many(taxDisposals),
}));

export const taxLotsRelations = relations(taxLots, ({ one, many }) => ({
  buyTrade: one(trades, {
    fields: [taxLots.buyTradeId],
    references: [trades.id],
  }),
  disposals: many(taxDisposals),
}));

export const taxDisposalsRelations = relations(taxDisposals, ({ one }) => ({
  sellTrade: one(trades, {
    fields: [taxDisposals.sellTradeId],
    references: [trades.id],
  }),
  taxLot: one(taxLots, {
    fields: [taxDisposals.taxLotId],
    references: [taxLots.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS (for use in application)
// ============================================================================

export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type TaxLot = typeof taxLots.$inferSelect;
export type NewTaxLot = typeof taxLots.$inferInsert;

export type TaxDisposal = typeof taxDisposals.$inferSelect;
export type NewTaxDisposal = typeof taxDisposals.$inferInsert;

export type TaxSettings = typeof taxSettings.$inferSelect;
export type NewTaxSettings = typeof taxSettings.$inferInsert;

export type DCAOrder = typeof dcaOrders.$inferSelect;
export type NewDCAOrder = typeof dcaOrders.$inferInsert;

export type LimitOrder = typeof limitOrders.$inferSelect;
export type NewLimitOrder = typeof limitOrders.$inferInsert;

export type PendingSellRecord = typeof pendingSells.$inferSelect;
export type NewPendingSell = typeof pendingSells.$inferInsert;

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type NewPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

// ============================================================================
// TELEGRAM USERS TABLE
// ============================================================================
export const telegramUsers = pgTable('telegram_users', {
  walletPublicKey: text('wallet_public_key').primaryKey(),
  chatId: text('chat_id').notNull(),
  username: text('username'),
  
  // Notification preferences
  notifyTrades: boolean('notify_trades').default(true),
  notifyDca: boolean('notify_dca').default(true),
  notifyExits: boolean('notify_exits').default(true),
  notifyErrors: boolean('notify_errors').default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type TelegramUser = typeof telegramUsers.$inferSelect;
export type NewTelegramUser = typeof telegramUsers.$inferInsert;
