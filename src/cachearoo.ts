import { config } from './config';
import { logger } from './logger';

import { DataStore } from './datastore/datastore';
import { WSAPI } from './api/ws/ws-api';
import { DataStoreRouter } from './api/http/datastore-router';

import * as bucketRouter from './api/http/bucket-router';
import * as virtualPaths from './virtual-paths';
import * as security from './security';
import * as replicationClient from './replication-client';
import * as deviceId from './device-id';
import express = require('express');
import path = require('path');
import { Request, Response, NextFunction } from 'express';

const app = express();

app.set('query parser', 'simple');

const httpPort = config.httpServerPort;

const httpHeaders = function (req: Request, res: Response, next: NextFunction) {
  res.header('X-Served-By', `Cachearoo ver ${config.version}`);
  res.header('X-Timestamp', new Date().toISOString());
  next();
};

const allowCrossDomain = function (req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, API-Key, X-Timestamp');
  res.header('Access-Control-Expose-Headers', 'X-Timestamp');

  // intercept OPTIONS method
  if ('OPTIONS' === req.method) {
    res.status(200).end();
  } else {
    next();
  }
};

function jsonOnly(req: Request, res: Response, next: NextFunction) {
  if ((req.method === 'PUT') || (req.method === 'POST') || (req.method === 'PATCH')) {
    const contentType = req.headers['content-type'];
    if (!contentType || contentType.split(';')[0].toLowerCase() !== 'application/json') {
      res.status(400).send(`Wrong content type ${contentType}`);
      return;
    }
  }
  next();
}

export class Cachearoo {
  private datastore: DataStore;
  private ws: WSAPI;
  private server: any;
  private lastReqPerSeconds = 0;
  private reqPerSecHandle: any;
  private httpRequestCount = 0;
  private httpRequestsPerSec = 0;

  constructor() {
    this.datastore = new DataStore(config);
    this.ws = new WSAPI(this.datastore);
    this.datastore.onDataUpdated = (bucket, key, value, isDeleted, userdata, timestamp, requestId) => {
      this.ws.wsBroadcastChange(bucket, key, value, isDeleted, userdata, timestamp, requestId);
    };
  }

  private increaseRequestCount(req: Request, res: Response, next: NextFunction) {
    this.httpRequestCount += 1;
    next();
  }

  private ping(req: Request, res: Response) {
    const status = {
      httpRequestCount: this.httpRequestCount,
      httpRequestsPerSec: this.httpRequestsPerSec,
      timestamp: new Date().toISOString(),
      backend: config.storageKind,
    };
    res.json(status);
  }

  private getReqPerSecond() {
    this.reqPerSecHandle = setInterval(() => {
      this.httpRequestsPerSec = this.httpRequestCount - this.lastReqPerSeconds;
      this.lastReqPerSeconds = this.httpRequestCount;
    }, 1000);
  }

  public init = async (): Promise<express.Application> => {
    deviceId.generateOrLoadDeviceID();

    try {
      await this.datastore.init();
      logger.info('Data store init ok');
    } catch (err) {
      logger.error(`Storage init failed: ${err.message}`);
      throw err;
    }

    this.configureRoutes();
    await this.configureVirtualPaths();
    await this.configureBuckets();
    logger.info(`Starting server on http://127.0.0.1:${httpPort}/`);

    this.server = app.listen(httpPort);
    this.ws.init(this.server, config.apiKey, config.publicRead);
    logger.info(`Cachearoo version ${config.version} started`);
    if (config.apiKey) {
      logger.info('API key required');
    }
    if ((config.apiKey) && (config.publicRead)) {
      logger.info('Public read ok');
    }

    this.ws.setSynchronizeReplicationClientCallback(async (connection: any, bucketCallback: any) => {
      for (const i in connection.registeredEvents) {
        try {
          const objects = await this.datastore.list(connection.registeredEvents[i].bucket);
          bucketCallback(connection, connection.registeredEvents[i].bucket, objects);
        } catch (err) {
          logger.error(`error during synchronization of replication client: ${err}`);
        }
      }
    });

    this.datastore.on('bucket-list-update', () => {
      this.configureBuckets();
    });

    this.datastore.on('virtual-path-update', () => {
      this.configureVirtualPaths();
    });

    this.getReqPerSecond();
    return app;
  }

  private configureRoutes() {
    const assetPath = process.env['CACHEAROO_RUN_MODE'] === 'dev' ? '../build/assets' : '../assets';

    app.use(allowCrossDomain);
    app.use(httpHeaders);
    app.use(express.json({ limit: '10mb' }));
    app.use(jsonOnly);
    app.use('/_admin', security.authentication);
    app.use('/_auth', security.authentication);
    app.get('/_auth', (req, res) => {
      res.json({ apiKey: config.apiKey, version: config.version });
    });
    app.use('/_data', security.checkAPIKey);
    app.use('/_data', this.increaseRequestCount.bind(this));
    app.use('/_config', security.checkAPIKey);
    app.use(DataStoreRouter.getRouter(this.datastore));
    app.use('/js', express.static(path.join(__dirname, assetPath, 'js')));
    app.use('/_admin', express.static(path.join(__dirname, assetPath, '_admin')));
    app.get('/_ping', this.ping.bind(this));
    app.get('/_status', this.getStatus.bind(this));
    app.get('/_id', deviceId.serveDeviceId);
    app.get('/', (req, res) => { res.redirect(config.indexRedirect); });
  }

  private async configureVirtualPaths() {
    return virtualPaths.load(app, this.datastore);
  }

  private async configureBuckets() {
    const buckets = await this.datastore.updateBuckets();
    bucketRouter.updateRoutes(app, buckets);
    await replicationClient.initReplicationClients(buckets, this.datastore);
  }

  public getStatus(req: Request, res: Response) {
    const status = {
      httpRequestCount: this.httpRequestCount,
      httpRequestsPerSec: this.httpRequestsPerSec,
      timestamp: new Date().toISOString(),
      backend: config.storageKind,
      webSocketConnections: this.ws.getClientConnectionInfo(),
    };
    res.json(status);
  }

  public release() {
    // close all listeners, used for test suite to exit properly
    this.server.close();
    clearInterval(this.reqPerSecHandle);
    this.datastore.removeAllListeners();
  }
}
