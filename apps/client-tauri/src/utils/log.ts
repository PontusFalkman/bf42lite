// src/utils/log.ts

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

interface LogConfig {
    level: LogLevel;
    enabledTags: Set<string>;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
};

// Default config — switch here for "debug build"
const config: LogConfig = {
    level: 'info', // show: error, warn, info
    enabledTags: new Set(['NET', 'CONQUEST', 'SIM', 'RENDER', 'RECON']),
};

function shouldLog(level: LogLevel, tag: string): boolean {
    if (LEVEL_ORDER[level] > LEVEL_ORDER[config.level]) return false;
    if (!config.enabledTags.has(tag)) return false;
    return true;
}

export const log = {
    setLevel(level: LogLevel): void {
        config.level = level;
    },

    enable(tag: string): void {
        config.enabledTags.add(tag);
    },

    disable(tag: string): void {
        config.enabledTags.delete(tag);
    },

    error(tag: string, msg: string, data?: any): void {
        if (shouldLog('error', tag)) console.error(`[ERROR][${tag}] ${msg}`, data ?? '');
    },

    warn(tag: string, msg: string, data?: any): void {
        if (shouldLog('warn', tag)) console.warn(`[WARN][${tag}] ${msg}`, data ?? '');
    },

    info(tag: string, msg: string, data?: any): void {
        if (shouldLog('info', tag)) console.info(`[INFO][${tag}] ${msg}`, data ?? '');
    },

    debug(tag: string, msg: string, data?: any): void {
        if (shouldLog('debug', tag)) console.debug(`[DEBUG][${tag}] ${msg}`, data ?? '');
    },

    trace(tag: string, msg: string, data?: any): void {
        if (shouldLog('trace', tag)) console.log(`[TRACE][${tag}] ${msg}`, data ?? '');
    },
};
