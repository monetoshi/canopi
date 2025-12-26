/**
 * Tax API Endpoints
 * Handles tax reporting, trades, and exports
 */

import express, { Request, Response } from 'express';
import { taxService } from '../services/tax.service';
import { logger } from '../utils/logger.util';
import { authenticateAdmin } from './wallet-server';

const router = express.Router();

/**
 * GET /api/tax/trades/:walletPublicKey
 * Get all trades for a wallet
 */
router.get('/trades/:walletPublicKey', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;
    const { year } = req.query;

    logger.info(`GET /api/tax/trades/${walletPublicKey}${year ? `?year=${year}` : ''}`);

    const trades = await taxService.getTrades(
      walletPublicKey,
      year ? parseInt(year as string) : undefined
    );

    res.json({
      success: true,
      data: trades,
      count: trades.length,
    });
  } catch (error: any) {
    logger.error('[TaxAPI] Error getting trades:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/tax/summary/:walletPublicKey
 * Get tax summary for a wallet
 */
router.get('/summary/:walletPublicKey', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;
    const { year } = req.query;

    logger.info(`GET /api/tax/summary/${walletPublicKey}${year ? `?year=${year}` : ''}`);

    const summary = await taxService.getTaxSummary(
      walletPublicKey,
      year ? parseInt(year as string) : undefined
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logger.error('[TaxAPI] Error getting summary:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/tax/export/:walletPublicKey
 * Export 1099-B CSV for a wallet
 */
router.get('/export/:walletPublicKey', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        error: 'Year parameter is required',
      });
    }

    logger.info(`GET /api/tax/export/${walletPublicKey}?year=${year}`);

    const csv = await taxService.export1099B(walletPublicKey, parseInt(year as string));

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="1099-B_${year}.csv"`);
    res.send(csv);
  } catch (error: any) {
    logger.error('[TaxAPI] Error exporting 1099-B:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/tax/settings/:walletPublicKey
 * Get tax settings for a wallet
 */
router.get('/settings/:walletPublicKey', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey } = req.params;

    logger.info(`GET /api/tax/settings/${walletPublicKey}`);

    const settings = await taxService.getTaxSettings(walletPublicKey);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    logger.error('[TaxAPI] Error getting settings:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/tax/settings
 * Update tax settings for a wallet
 */
router.post('/settings', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { walletPublicKey, costBasisMethod, taxYear, trackWashSales } = req.body;

    if (!walletPublicKey) {
      return res.status(400).json({
        success: false,
        error: 'walletPublicKey is required',
      });
    }

    logger.info(`POST /api/tax/settings for ${walletPublicKey}`);

    const updates: any = {};
    if (costBasisMethod) updates.costBasisMethod = costBasisMethod;
    if (taxYear) updates.taxYear = taxYear;
    if (trackWashSales !== undefined) updates.trackWashSales = trackWashSales;

    const settings = await taxService.updateTaxSettings(walletPublicKey, updates);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    logger.error('[TaxAPI] Error updating settings:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
