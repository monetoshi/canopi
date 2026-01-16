declare module 'node-telegram-bot-api' {
    export interface ConstructorOptions {
        polling?: boolean;
        request?: any;
    }

    export interface Message {
        chat: {
            id: number;
        };
        from?: {
            username?: string;
            first_name?: string;
        };
        message_id: number;
    }

    export interface CallbackQuery {
        id: string;
        message?: Message;
        data?: string;
    }

    export default class TelegramBot {
        constructor(token: string, options?: ConstructorOptions);
        onText(regexp: RegExp, callback: (msg: Message, match: RegExpExecArray | null) => void): void;
        on(event: string, callback: (arg: any) => void): void;
        sendMessage(chatId: string | number, text: string, options?: any): Promise<Message>;
        editMessageText(text: string, options?: any): Promise<Message>;
        answerCallbackQuery(callbackQueryId: string, options?: any): Promise<boolean>;
        stopPolling(): Promise<void>;
        getMe(): Promise<{ username: string }>;
    }
}
