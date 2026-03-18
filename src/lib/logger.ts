/**
 * Production-ready logger utility
 *
 * In production, you may want to integrate with:
 * - External logging services (Datadog, LogRocket, Sentry)
 * - File-based logging
 * - Structured logging (JSON format)
 *
 * For now, this provides a consistent logging interface.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const isDevelopment = process.env.NODE_ENV === "development";

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  const minLevel = isDevelopment ? "debug" : "info";
  return levels.indexOf(level) >= levels.indexOf(minLevel);
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, context));
    }
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (shouldLog("error")) {
      const errorContext: LogContext = { ...context };

      if (error instanceof Error) {
        errorContext.errorName = error.name;
        errorContext.errorMessage = error.message;
        if (isDevelopment) {
          errorContext.stack = error.stack;
        }
      } else if (error !== undefined) {
        errorContext.error = String(error);
      }

      console.error(formatMessage("error", message, errorContext));
    }
  },

  // For API request logging
  apiError(
    method: string,
    path: string,
    error: unknown,
    context?: LogContext
  ): void {
    this.error(`API Error: ${method} ${path}`, error, context);
  },
};

export default logger;
