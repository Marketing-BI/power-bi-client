import winston from "winston";

const logConfiguration = {
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.sss'
        }),
        winston.format.printf(info => `${info.timestamp} - ${info.level.toUpperCase()}: ${info.message}`),
    )
};

export const logger = winston.createLogger(logConfiguration);
