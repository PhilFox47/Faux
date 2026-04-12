import fs from 'fs';
import path from 'path';
import db from './db';

let currentLogFile: string | null = null;
let isLoggingEnabledCache: boolean | null = null;
let lastCacheUpdate = 0;

function isLoggingEnabled(): boolean {
  const now = Date.now();
  if (isLoggingEnabledCache === null || now - lastCacheUpdate > 5000) {
    try {
      const settings = db.prepare("SELECT enable_performance_logging FROM settings WHERE id = 1").get() as any;
      isLoggingEnabledCache = settings?.enable_performance_logging === 1;
    } catch (e) {
      isLoggingEnabledCache = false;
    }
    lastCacheUpdate = now;
  }
  return isLoggingEnabledCache;
}

function getLogFile(): string {
  if (!currentLogFile) {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    currentLogFile = path.join(logsDir, `faux_session_${timestamp}.log`);
    fs.writeFileSync(currentLogFile, `--- Faux Performance Log Session Started at ${new Date().toISOString()} ---\n`);
  }
  return currentLogFile;
}

export function logPerformance(operation: string, durationMs: number, details: any = {}) {
  if (!isLoggingEnabled()) return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    durationMs,
    ...details
  };

  try {
    fs.appendFileSync(getLogFile(), JSON.stringify(logEntry) + '\n');
  } catch (e) {
    console.error("Failed to write to performance log:", e);
  }
}
