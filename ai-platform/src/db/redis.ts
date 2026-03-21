import Redis from 'ioredis';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

let _redis: Redis;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
    });
    _redis.on('error',   err  => logger.error({ err }, 'Redis error'));
    _redis.on('connect', ()   => logger.info('Redis connected'));
    _redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));
  }
  return _redis;
}
