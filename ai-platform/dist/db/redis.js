"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
let _redis;
function getRedis() {
    if (!_redis) {
        _redis = new ioredis_1.default(config_1.config.REDIS_URL, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            enableReadyCheck: true,
        });
        _redis.on('error', err => logger_1.logger.error({ err }, 'Redis error'));
        _redis.on('connect', () => logger_1.logger.info('Redis connected'));
        _redis.on('reconnecting', () => logger_1.logger.warn('Redis reconnecting...'));
    }
    return _redis;
}
//# sourceMappingURL=redis.js.map