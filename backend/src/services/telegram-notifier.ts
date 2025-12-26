/**
 * Telegram Notifier Service
 * Handles all bot interactions and pushes notifications to users
 */

import TelegramBot from 'node-telegram-bot-api';
import { db } from '../db/index';
import { telegramUsers, Trade } from '../db/schema';
import { Position } from '../types';
import { DCAOrder } from '../types/dca.types';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.util';

export class TelegramNotifier {
  private bot: TelegramBot | null = null;
  private isInitialized = false;
  private linkCodes = new Map<string, { wallet: string, expires: number }>();
  public botUsername: string | null = null;

  constructor() {
    this.initialize();
    
    // Clean up expired codes every hour
    setInterval(() => {
      const now = Date.now();
      for (const [code, data] of this.linkCodes.entries()) {
        if (data.expires < now) this.linkCodes.delete(code);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Generate a temporary link code for a wallet
   */
  public generateLinkCode(walletPublicKey: string): string {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store with 10-minute expiration
    this.linkCodes.set(code, {
      wallet: walletPublicKey,
      expires: Date.now() + 10 * 60 * 1000
    });

    return code;
  }

  /**
   * Initialize the Telegram Bot
   */
  private async initialize() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      logger.warn('[Telegram] TELEGRAM_BOT_TOKEN not found - notifications disabled');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      
      // Fetch bot info
      const me = await this.bot.getMe();
      this.botUsername = me.username || null;
      logger.info(`[Telegram] Bot initialized as @${this.botUsername}`);

      this.setupCommands();
      this.isInitialized = true;
      logger.info('[Telegram] Bot initialized and listening for commands');
    } catch (error: any) {
      logger.error(`[Telegram] Failed to initialize bot: ${error.message}`);
    }
  }

  /**
   * Setup bot commands
   */
  private setupCommands() {
    if (!this.bot) return;

    // /start command - Link wallet to Telegram
    this.bot.onText(/\/start (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const input = match?.[1]; // This is now the link code
      const username = msg.from?.username || msg.from?.first_name || 'User';

      if (!input) {
        this.bot?.sendMessage(chatId, '❌ Please use the "Link Telegram" button on the dashboard.');
        return;
      }

      // Check if input is a valid link code
      const linkData = this.linkCodes.get(input);
      
      // Validation: Must exist and not be expired
      if (!linkData || linkData.expires < Date.now()) {
        this.bot?.sendMessage(chatId, '❌ Invalid or expired link code. Please generate a new one from the dashboard.');
        return;
      }

      const walletPublicKey = linkData.wallet;
      
      // Remove code after use (one-time use)
      this.linkCodes.delete(input);

      try {
        // Link wallet to chat ID
        await db.insert(telegramUsers).values({
          walletPublicKey,
          chatId,
          username,
          updatedAt: new Date()
        }).onConflictDoUpdate({
          target: telegramUsers.walletPublicKey,
          set: { chatId, username, updatedAt: new Date() }
        });

        this.bot?.sendMessage(chatId, 
          `✅ <b>Wallet Linked Successfully!</b>\n\n` +
          `Hello ${username},\n` +
          `Your wallet <code>${walletPublicKey.slice(0, 8)}...</code> is now linked to this Telegram account.\n\n` +
          `You will receive real-time notifications for your trades, DCA buys, and automated exits.`,
          { parse_mode: 'HTML' }
        );
        
        logger.info(`[Telegram] Linked wallet ${walletPublicKey.slice(0, 8)} to chat ${chatId} using code`);
      } catch (error: any) {
        logger.error(`[Telegram] Link error: ${error.message}`);
        this.bot?.sendMessage(chatId, '❌ Failed to link wallet. Please try again.');
      }
    });

    // /help command
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id.toString();
      this.bot?.sendMessage(chatId, 
        `🤖 <b>Canopi Bot Help</b>\n\n` +
        `• <b>Linked Wallet:</b> Link via dashboard\n` +
        `• <b>Notifications:</b> Automatic alerts for all trades\n` +
        `• <b>Settings:</b> Use /settings to configure alerts\n` +
        `• <b>Unlink:</b> Use /stop to unlink your wallet\n` +
        `• <b>Status:</b> Use /status to check bot health\n`,
        { parse_mode: 'HTML' }
      );
    });

    // /status command
    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id.toString();
      this.bot?.sendMessage(chatId, '🟢 <b>Canopi Bot Status: Healthy</b>', { parse_mode: 'HTML' });
    });

    // /settings command
    this.bot.onText(/\/settings/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const user = await this.getUserByChatId(chatId);

      if (!user) {
        this.bot?.sendMessage(chatId, '❌ No wallet linked. Please link your wallet first using the dashboard.');
        return;
      }

      this.sendSettingsMenu(chatId, user);
    });

    // /stop command (Unlink)
    this.bot.onText(/\/stop/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const user = await this.getUserByChatId(chatId);

      if (!user) {
        this.bot?.sendMessage(chatId, 'You are not linked to any wallet.');
        return;
      }

      try {
        await db.delete(telegramUsers).where(eq(telegramUsers.walletPublicKey, user.walletPublicKey));
        this.bot?.sendMessage(chatId, '🚫 <b>Wallet Unlinked</b>\n\nYou will no longer receive notifications.', { parse_mode: 'HTML' });
        logger.info(`[Telegram] Unlinked wallet ${user.walletPublicKey} from chat ${chatId}`);
      } catch (e: any) {
        logger.error(`[Telegram] Unlink error: ${e.message}`);
        this.bot?.sendMessage(chatId, '❌ Failed to unlink wallet.');
      }
    });

    // Handle callback queries (Settings toggles)
    this.bot.on('callback_query', async (query) => {
      if (!query.message || !query.data) return;
      const chatId = query.message.chat.id.toString();
      const action = query.data;

      const user = await this.getUserByChatId(chatId);
      if (!user) {
        this.bot?.answerCallbackQuery(query.id, { text: 'No wallet linked' });
        return;
      }

      try {
        let updateData: Partial<typeof telegramUsers.$inferSelect> = {};
        let text = '';

        switch (action) {
          case 'toggle_trades':
            updateData = { notifyTrades: !user.notifyTrades };
            text = `Trades notifications ${!user.notifyTrades ? 'enabled' : 'disabled'}`;
            break;
          case 'toggle_dca':
            updateData = { notifyDca: !user.notifyDca };
            text = `DCA notifications ${!user.notifyDca ? 'enabled' : 'disabled'}`;
            break;
          case 'toggle_exits':
            updateData = { notifyExits: !user.notifyExits };
            text = `Exit notifications ${!user.notifyExits ? 'enabled' : 'disabled'}`;
            break;
          case 'toggle_errors':
            updateData = { notifyErrors: !user.notifyErrors };
            text = `Error alerts ${!user.notifyErrors ? 'enabled' : 'disabled'}`;
            break;
        }

        if (Object.keys(updateData).length > 0) {
          await db.update(telegramUsers)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(telegramUsers.walletPublicKey, user.walletPublicKey));
          
          const updatedUser = { ...user, ...updateData };
          
          await this.bot?.answerCallbackQuery(query.id, { text });
          await this.sendSettingsMenu(chatId, updatedUser, query.message.message_id);
        }
      } catch (e: any) {
        logger.error(`[Telegram] Settings update error: ${e.message}`);
        this.bot?.answerCallbackQuery(query.id, { text: 'Failed to update settings' });
      }
    });
  }

  /**
   * Helper to send/update settings menu
   */
  private async sendSettingsMenu(chatId: string, user: any, messageId?: number) {
    const getStatus = (val: boolean | null) => val ? '✅ ON' : '❌ OFF';
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: `Trades ${getStatus(user.notifyTrades)}`, callback_data: 'toggle_trades' },
          { text: `DCA ${getStatus(user.notifyDca)}`, callback_data: 'toggle_dca' }
        ],
        [
          { text: `Exits ${getStatus(user.notifyExits)}`, callback_data: 'toggle_exits' },
          { text: `Errors ${getStatus(user.notifyErrors)}`, callback_data: 'toggle_errors' }
        ]
      ]
    };

    const text = `⚙️ <b>Notification Settings</b>\n\n` +
      `Wallet: <code>${user.walletPublicKey.slice(0, 8)}...</code>\n` +
      `Customize your alerts below:`;

    if (messageId) {
      await this.bot?.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } else {
      await this.bot?.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    }
  }

  /**
   * Get user by Chat ID
   */
  private async getUserByChatId(chatId: string) {
    const [user] = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId));
    return user;
  }

  /**
   * Get user settings
   */
  private async getUser(walletPublicKey: string) {
    const [user] = await db.select().from(telegramUsers).where(eq(telegramUsers.walletPublicKey, walletPublicKey));
    return user;
  }

  /**
   * Send notification about a trade (Buy/Sell)
   */
  async notifyTrade(trade: Trade, symbol?: string) {
    if (!this.isInitialized || !this.bot) return;

    const user = await this.getUser(trade.walletPublicKey);
    if (!user || !user.notifyTrades) return;

    const isBuy = trade.type === 'BUY';
    const typeLabel = isBuy ? '🟢 BUY' : '🔴 SELL';
    const amountLabel = isBuy ? `${parseFloat(trade.solAmount).toFixed(4)} SOL` : `${parseFloat(trade.tokenAmount).toLocaleString()} tokens`;
    
    const message = 
      `🎯 <b>Trade Executed: ${typeLabel}</b>\n\n` +
      `<b>Token:</b> ${symbol || trade.tokenMint.slice(0, 8)}\n` +
      `<b>Amount:</b> ${amountLabel}\n` +
      `<b>Price:</b> $${parseFloat(trade.priceUsd).toFixed(6)}\n` +
      `<b>Value:</b> ${parseFloat(trade.solAmount).toFixed(4)} SOL\n\n` +
      `<a href="https://solscan.io/tx/${trade.signature}">View Transaction</a>`;

    try {
      await this.bot.sendMessage(user.chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (e: any) {
      logger.error(`[Telegram] Send failed: ${e.message}`);
    }
  }

  /**
   * Send notification for DCA Buy
   */
  async notifyDcaBuy(order: DCAOrder, buyNumber: number, signature: string, actualTokens: number, actualSol: number, price: number) {
    if (!this.isInitialized || !this.bot) return;

    const user = await this.getUser(order.walletPublicKey);
    if (!user || !user.notifyDca) return;

    const message = 
      `💵 <b>DCA Buy Executed (${buyNumber}/${order.numberOfBuys})</b>\n\n` +
      `<b>Token:</b> ${order.tokenSymbol || order.tokenMint.slice(0, 8)}\n` +
      `<b>Bought:</b> ${actualTokens.toLocaleString()} tokens\n` +
      `<b>Spent:</b> ${actualSol.toFixed(4)} SOL\n` +
      `<b>Price:</b> $${price.toFixed(6)}\n\n` +
      `<a href="https://solscan.io/tx/${signature}">View Transaction</a>`;

    try {
      await this.bot.sendMessage(user.chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (e: any) {
      logger.error(`[Telegram] Send failed: ${e.message}`);
    }
  }

  /**
   * Send notification for Exit Condition Triggered
   */
  async notifyExitTriggered(position: Position, reason: string, signature?: string) {
    if (!this.isInitialized || !this.bot) return;

    const user = await this.getUser(position.walletPublicKey);
    if (!user || !user.notifyExits) return;

    const profit = position.currentProfit || 0;
    const profitLabel = profit >= 0 ? `+${profit.toFixed(2)}%` : `${profit.toFixed(2)}%`;
    
    const message = 
      `🚨 <b>Exit Triggered: ${position.mint.slice(0, 8)}</b>\n\n` +
      `<b>Reason:</b> ${reason}\n` +
      `<b>Current P&L:</b> ${profitLabel}\n` +
      `<b>Holding:</b> ${position.tokenAmount.toLocaleString()} tokens\n\n` +
      (signature ? `<a href="https://solscan.io/tx/${signature}">View Transaction</a>` : `⚡ <i>Auto-exit in progress...</i>`);

    try {
      await this.bot.sendMessage(user.chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (e: any) {
      logger.error(`[Telegram] Send failed: ${e.message}`);
    }
  }

  /**
   * Send generic alert
   */
  async notifyError(walletPublicKey: string, error: string) {
    if (!this.isInitialized || !this.bot) return;

    const user = await this.getUser(walletPublicKey);
    if (!user || !user.notifyErrors) return;

    const message = `⚠️ <b>Bot Alert (Error)</b>\n\n<code>${error}</code>`;

    try {
      await this.bot.sendMessage(user.chatId, message, { parse_mode: 'HTML' });
    } catch (e: any) {
      logger.error(`[Telegram] Send failed: ${e.message}`);
    }
  }
}

export const telegramNotifier = new TelegramNotifier();
