import * as winston from 'winston';
import * as dailyRotateFile from 'winston-daily-rotate-file';
import * as fs from 'fs';
import { config } from './config';

const MESSAGE = Symbol.for('message');

const jsonFormatter = (logEntry) => {
  const base = { local: getLocalTimestamp() };
  const json = { ...base, level: logEntry.level, msg: logEntry.message, utc: new Date().toISOString() };
  logEntry[MESSAGE] = JSON.stringify(json);
  return logEntry;
}

function getLocalTimestamp() {
  const d = new Date();
  const tzoffset = d.getTimezoneOffset() * 60000;
  return new Date(d.valueOf() - tzoffset).toISOString().slice(0, -1);
}

let loggerInstance: any;
if (process.env.NODE_ENV === 'test') {
  loggerInstance = {
    debug(str: string) { },
    error(str: string) { },
    trace(str: string) { },
    warn(str: string) { },
    info(str: string) { },
  };
} else {
  try {
    fs.mkdirSync(config.logPath, { recursive: true });
  } catch (e) {
    console.error('Cannot instantiate logger', e);
  }
  loggerInstance = winston.createLogger({
    format: winston.format(jsonFormatter)(),
    transports: [
      new dailyRotateFile(
        {
          datePattern: 'YYYY-MM-DD',
          filename: 'cachearoo.%DATE%.log',
          dirname: `${config.logPath}`,
          level: config.logLevel || 'info',
          maxSize: 2 * 1024 * 1024,
          maxFiles: 7,
          eol: '\r\n',
        }),
      new winston.transports.Console({
        level: config.logLevel || 'info',
        handleExceptions: true,
      })],
  });
  loggerInstance.transports[0].timestamp = true;
  loggerInstance.debug(`Log level=${config.logLevel}`);
}

export const logger = loggerInstance;
