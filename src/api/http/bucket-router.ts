import { Express } from 'express';
// tslint:disable-next-line: no-duplicate-imports
import * as express from 'express';
import { IBucket } from '../../datastore/idatastore';
import { FileUtils } from '../../file-utils';
import { logger } from '../../logger';
import { config } from '../../config';

const currentRoutes: Map<string, boolean> = new Map();

function createRoute(app: Express, key: string, dir: string) {
  app.use(`/${encodeURIComponent(key)}`, express.static(dir));
  currentRoutes.set(key, true);
  logger.info(`Route ${key} to ${dir}`);
}

function createNewRoutes(app: Express, buckets: IBucket[]) {
  // add / update static routes
  for (let i = 0; i < buckets.length; i += 1) {
    const dir = `${config.bucketDir}${FileUtils.encodeBucketPath(buckets[i].key)}/www/`;
    const route = currentRoutes.get(buckets[i].key);
    if ((!route) && (!buckets[i].disabled) && (buckets[i].key.substring(0, 1) !== '_')) {
      createRoute(app, buckets[i].key, dir);
    }
  }
}

export function updateRoutes(app: Express, buckets: IBucket[]) {
  try {
    createNewRoutes(app, buckets);
  } catch (err) {
    logger.error('Could not update routes');
    throw err;
  }
}
