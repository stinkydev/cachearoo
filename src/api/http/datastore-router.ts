import { Router, Request, Response } from 'express';
import { DataStore } from '../../datastore/datastore';
import { logger } from '../../logger';

const router = Router();
const DEFAULT_ERROR_CODE = 500;

function handleError(res: Response, err: Error, code?: number) {
  logger.error(`REST api error ${err}`);
  res.status(code || DEFAULT_ERROR_CODE).json({ error: err.message });
}

export class DataStoreRouter {
  public static getRouter(ds: DataStore): Router {
    router.route('/_repair/:bucket')
      .get(async (req, res, next) => {
        try {
          await ds.repair(getBucket(req));
          res.json({ repair: 'ok' });
        } catch (err) {
          handleError(res, err);
        }
      });

    router.route('/_meta/:bucket')
      .get(async (req, res, next) => {
        try {
          const arr = await ds.readBucketMetadata(getBucket(req), req.query.filter as string);
          res.json(arr);
        } catch (err) {
          handleError(res, err);
        }
      });

    router.route('/_data/:bucket')
      .get(async (req, res, next) => {
        try {
          const arr = await ds.list(getBucket(req), req.query.filter as string, isTrue(req.query.keysOnly));
          res.json(arr);
        } catch (err) {
          handleError(res, err, 404);
        }
      })
      .post((req, res, next) => {
        doPost(req, res, true);
      })
      .delete(async (req, res, next) => {
        try {
          await ds.removeBucketAndData(getBucket(req));
          res.send('ok');
        } catch (err) {
          handleError(res, new Error(`Could not delete bucket data in bucket: ${getBucket(req)} ${err.message}`));
        }
      });

    router.route('/_data/:bucket/:key')
      .get(async (req, res, next) => {
        try {
          const obj = await ds.read(getBucket(req), getKey(req));
          res.header('X-Write-Timestamp', obj.timestamp);
          res.json(obj.value);
        } catch (err) {
          handleError(res, err, 404);
        }
      }).post(async (req, res, next) => {
        await doPost(req, res, false);
      }).put(async (req, res, next) => {
        await doPost(req, res, false);
      }).patch(async (req, res, next) => {
        try {
          const obj = await ds.patch(
            getBucket(req),
            getKey(req),
            req.body,
            null,
            null,
            (req.header('RemoveDataFromReply') === 'true'),
          );
          res.json(obj);
        } catch (err) {
          handleError(res, err);
        }
      }).delete(async (req, res, next) => {
        try {
          await ds.remove(getBucket(req), getKey(req));
          res.send('ok');
        } catch (err) {
          handleError(res, new Error(`Could not delete bucket=${getBucket(req)}, key=${getKey(req)}`));
        }
      });

    async function doPost(req: Request, res: Response, generateKey: boolean) {
      let key = getKey(req);
      const bucket = getBucket(req);
      if (generateKey) {
        key = ds.generateKey();
        // send generated key back in header
        res.location(`/_data/${bucket}/${key}`);
        res.header('Access-Control-Expose-Headers', 'Location');
      }

      if (req.header('Expire') === 'session') {
        res.status(400).send('Session expiration keys cannot be written with REST protocol');
        return;
      }

      let writeFunc = ds.write.bind(ds);
      if (req.header('FailIfExists') === 'true') { writeFunc = ds.writeFailIfExists.bind(ds); }

      try {
        await writeFunc(bucket, key, req.body, null, null, null);
        if (generateKey) {
          res.status(201).send('Created');
        } else {
          res.send();
        }
      } catch (err) {
        if (err.name === 'EEXISTS') {
          handleError(res, err, 412);
        } else {
          handleError(res, err, 500);
        }
      }
    }
    return router;
  }
}

// Query string values are strings; treat only 'true'/'1' as true (not the literal 'false').
function isTrue(value: unknown): boolean {
  return value === 'true' || value === '1';
}

const getBucket = function (req: Request): string {
  return req.params.bucket as string;
};

const getKey = function (req: Request): string {
  return req.params.key as string;
};
