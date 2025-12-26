/**
 * Tax Tracking Service
 * Handles cost basis calculation, wash sales, and tax reporting
 */

import { db } from '../db/index';
import {
  trades,
  taxLots,
  taxDisposals,
  taxSettings,
  NewTrade,
  NewTaxLot,
  NewTaxDisposal,
  Trade,
  TaxLot,
  TaxSettings
} from '../db/schema';
import { eq, and, desc, asc, gte, lte, sql } from 'drizzle-orm';

export class TaxService {
  /**
   * Retry database operation if connection is terminated
   */
  private async retryOnConnectionError<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[TaxService] Attempt ${attempt}/${maxRetries}: Executing database operation...`);
        return await operation();
      } catch (error: any) {
        console.log(`[TaxService] Attempt ${attempt} FAILED`);
        console.log('[TaxService] Error details:', {
          message: error.message,
          code: error.code,
          causeCode: error.cause?.code,
          causeMessage: error.cause?.message,
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0, 500)
        });

        // Check for Supabase connection termination errors
        // These can be in the error message itself or in the cause/original error
        const errorMessage = error.message || '';
        const causeMessage = error.cause?.message || '';
        const isConnectionError =
          errorMessage.includes('db_termination') ||
          errorMessage.includes('Connection terminated') ||
          errorMessage.includes('Failed query') ||
          errorMessage.includes('ECONNRESET') ||
          causeMessage.includes('db_termination') ||
          causeMessage.includes('Connection terminated') ||
          error.code === 'XX000' ||
          error.code === 'ECONNRESET' ||
          error.cause?.code === 'XX000';

        if (isConnectionError && attempt < maxRetries) {
          // Use longer exponential backoff to give connection pool time to recover
          const delayMs = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
          console.log(`[TaxService] Connection error detected, retrying in ${delayMs}ms (${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        console.log('[TaxService] Not a retriable error or max retries reached');
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Record a buy trade and create tax lot
   */
  async recordBuyTrade(params: {
    walletPublicKey: string;
    tokenMint: string;
    positionId?: string;
    solAmount: number;
    tokenAmount: number;
    priceUsd: number;
    priceSol: number;
    feeSol: number;
    signature: string;
    entryStrategy?: string;
  }): Promise<{ trade: Trade; taxLot: TaxLot }> {
    const {
      walletPublicKey,
      tokenMint,
      positionId,
      solAmount,
      tokenAmount,
      priceUsd,
      priceSol,
      feeSol,
      signature,
      entryStrategy
    } = params;

    console.log('[TaxService] ========== RECORDING BUY TRADE ==========');
    console.log('[TaxService] Params:', {
      wallet: walletPublicKey.slice(0, 8),
      token: tokenMint.slice(0, 8),
      solAmount,
      tokenAmount,
      priceUsd,
      signature: signature.slice(0, 8)
    });

    // Calculate cost basis (includes fees)
    const totalCostUsd = (solAmount + feeSol) * priceSol;
    const costBasisPerToken = totalCostUsd / tokenAmount;

    // Create trade record
    const newTrade: NewTrade = {
      walletPublicKey,
      tokenMint,
      positionId,
      type: 'BUY',
      solAmount: solAmount.toString(),
      tokenAmount: tokenAmount.toString(),
      priceUsd: priceUsd.toString(),
      priceSol: priceSol.toString(),
      feeSol: feeSol.toString(),
      entryStrategy,
      signature,
      costBasisUsd: totalCostUsd.toString(),
    };

    console.log('[TaxService] Entering retry wrapper for database insert...');

    // Retry database inserts on connection errors
    const result = await this.retryOnConnectionError(async () => {
      const [trade] = await db.insert(trades).values(newTrade).returning();
      console.log('[TaxService] ✓ Trade record inserted, ID:', trade.id);

      // Create tax lot
      const newTaxLot: NewTaxLot = {
        walletPublicKey,
        tokenMint,
        buyTradeId: trade.id,
        quantity: tokenAmount.toString(),
        remainingQuantity: tokenAmount.toString(),
        costBasisPerToken: costBasisPerToken.toString(),
        acquisitionDate: new Date(),
      };

      const [taxLot] = await db.insert(taxLots).values(newTaxLot).returning();
      console.log('[TaxService] ✓ Tax lot created, ID:', taxLot.id);

      return { trade, taxLot };
    });

    console.log(`[TaxService] Recorded BUY: ${tokenAmount} tokens @ $${priceUsd.toFixed(6)}, Cost Basis: $${totalCostUsd.toFixed(2)}`);

    return result;
  }

  /**
   * Record a sell trade and match to tax lots using FIFO/LIFO
   */
  async recordSellTrade(params: {
    walletPublicKey: string;
    tokenMint: string;
    positionId?: string;
    solAmount: number;
    tokenAmount: number;
    priceUsd: number;
    priceSol: number;
    feeSol: number;
    signature: string;
    exitStrategy?: string;
  }): Promise<{
    trade: Trade;
    disposals: any[];
    totalGainLoss: number;
    isShortTerm: boolean;
  }> {
    const {
      walletPublicKey,
      tokenMint,
      positionId,
      solAmount,
      tokenAmount,
      priceUsd,
      priceSol,
      feeSol,
      signature,
      exitStrategy
    } = params;

    // Get user's tax settings
    const settings = await this.getTaxSettings(walletPublicKey);
    const method = settings.costBasisMethod || 'FIFO';

    // Get available tax lots
    const availableLots = await db
      .select()
      .from(taxLots)
      .where(
        and(
          eq(taxLots.walletPublicKey, walletPublicKey),
          eq(taxLots.tokenMint, tokenMint),
          eq(taxLots.disposed, false),
          sql`${taxLots.remainingQuantity} > 0`
        )
      )
      .orderBy(method === 'FIFO' ? asc(taxLots.acquisitionDate) : desc(taxLots.acquisitionDate));

    if (availableLots.length === 0) {
      throw new Error('No available tax lots for this token');
    }

    // Calculate proceeds (after fees)
    const proceedsUsd = (solAmount - feeSol) * priceSol;

    let remainingToSell = tokenAmount;
    const disposals: any[] = [];
    let totalCostBasis = 0;
    let totalGainLoss = 0;
    let shortestHoldingPeriod = Infinity;

    // Match sell to tax lots
    for (const lot of availableLots) {
      if (remainingToSell <= 0) break;

      const lotRemaining = parseFloat(lot.remainingQuantity);
      const quantityFromThisLot = Math.min(remainingToSell, lotRemaining);

      // Calculate this lot's portion
      const portionOfSale = quantityFromThisLot / tokenAmount;
      const proceedsForThisLot = proceedsUsd * portionOfSale;
      const costBasisForThisLot = parseFloat(lot.costBasisPerToken) * quantityFromThisLot;
      const gainLoss = proceedsForThisLot - costBasisForThisLot;

      // Calculate holding period
      const holdingPeriodMs = Date.now() - new Date(lot.acquisitionDate).getTime();
      const holdingPeriodDays = Math.floor(holdingPeriodMs / (1000 * 60 * 60 * 24));
      shortestHoldingPeriod = Math.min(shortestHoldingPeriod, holdingPeriodDays);

      disposals.push({
        lotId: lot.id,
        quantityDisposed: quantityFromThisLot,
        proceedsUsd: proceedsForThisLot,
        costBasisUsd: costBasisForThisLot,
        gainLossUsd: gainLoss,
        holdingPeriodDays,
      });

      totalCostBasis += costBasisForThisLot;
      totalGainLoss += gainLoss;
      remainingToSell -= quantityFromThisLot;

      // Update lot
      const newRemaining = lotRemaining - quantityFromThisLot;
      await db
        .update(taxLots)
        .set({
          remainingQuantity: newRemaining.toString(),
          disposed: newRemaining === 0,
        })
        .where(eq(taxLots.id, lot.id));
    }

    const isShortTerm = shortestHoldingPeriod < 365;

    // Check for wash sales if tracking is enabled
    let washSaleDisallowed = 0;
    if (settings.trackWashSales && totalGainLoss < 0) {
      washSaleDisallowed = await this.checkWashSale(
        walletPublicKey,
        tokenMint,
        Math.abs(totalGainLoss)
      );
    }

    // Create trade record
    const newTrade: NewTrade = {
      walletPublicKey,
      tokenMint,
      positionId,
      type: 'SELL',
      solAmount: solAmount.toString(),
      tokenAmount: tokenAmount.toString(),
      priceUsd: priceUsd.toString(),
      priceSol: priceSol.toString(),
      feeSol: feeSol.toString(),
      exitStrategy,
      signature,
      costBasisUsd: totalCostBasis.toString(),
      costBasisMethod: method,
      realizedGainLossUsd: totalGainLoss.toString(),
      holdingPeriodDays: shortestHoldingPeriod,
      isShortTerm,
      isWashSale: washSaleDisallowed > 0,
      washSaleDisallowed: washSaleDisallowed.toString(),
    };

    const [trade] = await db.insert(trades).values(newTrade).returning();

    // Create disposal records
    for (const disposal of disposals) {
      const newDisposal: NewTaxDisposal = {
        sellTradeId: trade.id,
        taxLotId: disposal.lotId,
        quantityDisposed: disposal.quantityDisposed.toString(),
        proceedsUsd: disposal.proceedsUsd.toString(),
        costBasisUsd: disposal.costBasisUsd.toString(),
        gainLossUsd: disposal.gainLossUsd.toString(),
        holdingPeriodDays: disposal.holdingPeriodDays,
      };

      await db.insert(taxDisposals).values(newDisposal);
    }

    console.log(`[TaxService] Recorded SELL: ${tokenAmount} tokens @ $${priceUsd.toFixed(6)}`);
    console.log(`[TaxService] Gain/Loss: $${totalGainLoss.toFixed(2)} (${isShortTerm ? 'SHORT' : 'LONG'}-term)`);
    if (washSaleDisallowed > 0) {
      console.log(`[TaxService] ⚠️ Wash sale: $${washSaleDisallowed.toFixed(2)} disallowed`);
    }

    return { trade, disposals, totalGainLoss, isShortTerm };
  }

  /**
   * Check for wash sales (30-day rule)
   */
  private async checkWashSale(
    walletPublicKey: string,
    tokenMint: string,
    lossAmount: number
  ): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Check for buys within 30 days before or after the loss
    const recentBuys = await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.walletPublicKey, walletPublicKey),
          eq(trades.tokenMint, tokenMint),
          eq(trades.type, 'BUY'),
          gte(trades.timestamp, thirtyDaysAgo),
          lte(trades.timestamp, thirtyDaysFromNow)
        )
      );

    if (recentBuys.length > 0) {
      // Wash sale detected - disallow the loss
      return lossAmount;
    }

    return 0;
  }

  /**
   * Get tax settings for a wallet (create default if not exists)
   */
  async getTaxSettings(walletPublicKey: string): Promise<TaxSettings> {
    const [settings] = await db
      .select()
      .from(taxSettings)
      .where(eq(taxSettings.walletPublicKey, walletPublicKey));

    if (settings) {
      return settings;
    }

    // Create default settings
    const [newSettings] = await db
      .insert(taxSettings)
      .values({
        walletPublicKey,
        costBasisMethod: 'FIFO',
        taxYear: new Date().getFullYear(),
        trackWashSales: true,
      })
      .returning();

    return newSettings;
  }

  /**
   * Update tax settings
   */
  async updateTaxSettings(
    walletPublicKey: string,
    updates: Partial<TaxSettings>
  ): Promise<TaxSettings> {
    const [updated] = await db
      .update(taxSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(taxSettings.walletPublicKey, walletPublicKey))
      .returning();

    return updated;
  }

  /**
   * Get all trades for a wallet
   */
  async getTrades(walletPublicKey: string, year?: number): Promise<Trade[]> {
    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      return await db
        .select()
        .from(trades)
        .where(
          and(
            eq(trades.walletPublicKey, walletPublicKey),
            gte(trades.timestamp, startOfYear),
            lte(trades.timestamp, endOfYear)
          )
        )
        .orderBy(desc(trades.timestamp));
    }

    return await db
      .select()
      .from(trades)
      .where(eq(trades.walletPublicKey, walletPublicKey))
      .orderBy(desc(trades.timestamp));
  }

  /**
   * Get tax summary for a wallet
   */
  async getTaxSummary(walletPublicKey: string, year?: number) {
    const allTrades = await this.getTrades(walletPublicKey, year);
    const sellTrades = allTrades.filter(t => t.type === 'SELL');

    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;
    let washSalesDisallowed = 0;

    for (const trade of sellTrades) {
      const gainLoss = parseFloat(trade.realizedGainLossUsd || '0');
      const washSale = parseFloat(trade.washSaleDisallowed || '0');

      washSalesDisallowed += washSale;

      if (trade.isShortTerm) {
        if (gainLoss > 0) {
          shortTermGains += gainLoss;
        } else {
          shortTermLosses += Math.abs(gainLoss);
        }
      } else {
        if (gainLoss > 0) {
          longTermGains += gainLoss;
        } else {
          longTermLosses += Math.abs(gainLoss);
        }
      }
    }

    const netShortTerm = shortTermGains - shortTermLosses;
    const netLongTerm = longTermGains - longTermLosses;
    const totalNetGainLoss = netShortTerm + netLongTerm;

    return {
      totalTrades: allTrades.length,
      buyTrades: allTrades.filter(t => t.type === 'BUY').length,
      sellTrades: sellTrades.length,
      shortTermGains,
      shortTermLosses,
      netShortTerm,
      longTermGains,
      longTermLosses,
      netLongTerm,
      totalNetGainLoss,
      washSalesDisallowed,
      taxYear: year || new Date().getFullYear(),
    };
  }

  /**
   * Generate 1099-B CSV export
   */
  async export1099B(walletPublicKey: string, year: number): Promise<string> {
    const sellTrades = (await this.getTrades(walletPublicKey, year))
      .filter(t => t.type === 'SELL');

    // CSV header (IRS Form 1099-B format)
    const headers = [
      'Description of Property',
      'Date Acquired',
      'Date Sold',
      'Proceeds',
      'Cost Basis',
      'Gain/Loss',
      'Type',
      'Wash Sale',
    ].join(',');

    const rows: string[] = [headers];

    for (const trade of sellTrades) {
      // Get disposal details to find acquisition date
      const disposalRecords = await db
        .select()
        .from(taxDisposals)
        .where(eq(taxDisposals.sellTradeId, trade.id));

      // Get the earliest acquisition date
      let earliestAcquisition = new Date();
      for (const disposal of disposalRecords) {
        const lot = await db
          .select()
          .from(taxLots)
          .where(eq(taxLots.id, disposal.taxLotId))
          .limit(1);

        if (lot[0]) {
          const acqDate = new Date(lot[0].acquisitionDate);
          if (acqDate < earliestAcquisition) {
            earliestAcquisition = acqDate;
          }
        }
      }

      const row = [
        `"${trade.tokenMint.substring(0, 8)}... (${trade.tokenAmount} tokens)"`,
        earliestAcquisition.toLocaleDateString(),
        new Date(trade.timestamp).toLocaleDateString(),
        parseFloat(trade.solAmount || '0').toFixed(2),
        parseFloat(trade.costBasisUsd || '0').toFixed(2),
        parseFloat(trade.realizedGainLossUsd || '0').toFixed(2),
        trade.isShortTerm ? 'SHORT-TERM' : 'LONG-TERM',
        trade.isWashSale ? 'YES' : 'NO',
      ].join(',');

      rows.push(row);
    }

    return rows.join('\n');
  }
}

// Singleton instance
export const taxService = new TaxService();
