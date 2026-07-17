export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  service?: string;
  requestId?: string;
  jobId?: string;
  traceId?: string;
  userId?: string;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(defaultFields: LogFields = {}) {
  return {
    debug: (message: string, fields?: LogFields) =>
      write('debug', message, { ...defaultFields, ...fields }),
    info: (message: string, fields?: LogFields) =>
      write('info', message, { ...defaultFields, ...fields }),
    warn: (message: string, fields?: LogFields) =>
      write('warn', message, { ...defaultFields, ...fields }),
    error: (message: string, fields?: LogFields) =>
      write('error', message, { ...defaultFields, ...fields }),
    child: (fields: LogFields) => createLogger({ ...defaultFields, ...fields }),
  };
}

export type Logger = ReturnType<typeof createLogger>;
