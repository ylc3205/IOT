import { env } from '../../config/env';

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;

type LogLevel = keyof typeof levels;

class Logger {
  private currentLevel: number;

  constructor() {
    this.currentLevel = levels[env.LOG_LEVEL as LogLevel] ?? levels.info;
  }

  private formatMessage(level: string, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaString = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  public debug(message: string, meta?: unknown): void {
    if (this.currentLevel <= levels.debug) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  public info(message: string, meta?: unknown): void {
    if (this.currentLevel <= levels.info) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  public warn(message: string, meta?: unknown): void {
    if (this.currentLevel <= levels.warn) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  public error(message: string, meta?: unknown): void {
    if (this.currentLevel <= levels.error) {
      console.error(this.formatMessage('error', message, meta));
    }
  }
}

export const logger = new Logger();

