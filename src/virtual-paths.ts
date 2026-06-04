import { DataStore } from './datastore/datastore';
import * as express from 'express';
import { Express } from 'express';
import { logger } from './logger';

exports.bucketName = '_virtual_paths_config';

export async function load(app: Express, ds: DataStore) {
  try {
    await ds.write('_bucket_config', exports.bucketName, {}, null, null, null);
  } catch (err) {
    logger.error('Could not create virtual paths bucket');
  }
  const list = await ds.list(exports.bucketName);
  const routes = new Map();
  for (let i = 0; i < list.length; i += 1) {
    routes.set(list[i].key, list[i].content);
  }

  applyRouting(app, routes);
};

function applyRouting(app: Express, routes: Map<string, any>) {
  [...routes.values()].forEach((route) => {
    logger.info(`Virtual path ${route.virtualPath} to ${route.physicalPath}`);
    app.use(`/${route.virtualPath}`, express.static(route.physicalPath));
  });
}
