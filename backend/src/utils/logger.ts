const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

const MAX_LEVEL: Level = (process.env.LOG_LEVEL as Level | undefined) ?? 'info';

function ts() {
  return new Date().toISOString();
}

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] > LEVELS[MAX_LEVEL]) return;
  const prefix = `[${ts()}] [${level.toUpperCase().padEnd(5)}]`;
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(`${prefix} ${message}${metaStr}`);
}

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
};
