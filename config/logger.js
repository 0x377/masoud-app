import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { format } from 'date-fns';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const formattedTimestamp = format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss.SSS');
    let log = `${formattedTimestamp} [${level.toUpperCase()}] ${message}`;

    if (stack) {
        log += `\n${stack}`;
    }

    if (Object.keys(meta).length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        errors({ stack: true }),
        timestamp(),
        process.env.NODE_ENV === 'production' ? json() : customFormat
    ),
    transports: [
        new DailyRotateFile({
            filename: 'logs/application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
            maxFiles: process.env.LOG_FILE_MAX_FILES || '14d',
            level: 'error'
        }),
        new DailyRotateFile({
            filename: 'logs/combined-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
            maxFiles: process.env.LOG_FILE_MAX_FILES || '14d'
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: combine(
            colorize(),
            customFormat
        )
    }));
}

// Custom stream for Morgan
logger.stream = {
    write: (message) => logger.info(message.trim())
};

export default logger;
