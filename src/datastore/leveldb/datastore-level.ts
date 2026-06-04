import * as level from 'level';
import * as leveldown from 'leveldown';

import { IDataStore, IDataStoreObject, IDataStoreObjectMetaData, IBucketParameters, IBucket } from '../idatastore';
import { FileUtils } from '../../file-utils';
import { config } from '../../config';
import { logger } from '../../logger';
import * as fs from 'fs';

const fsp = fs.promises;

export interface ILevelBucketParameters extends IBucketParameters {
  path: string;
  bucket: IBucket;
}

export class DataStoreLevel implements IDataStore {

  // Build the stored record as JSON text, reusing the already-serialized value
  // string so the (potentially large) value is serialized exactly once.
  private static encodeRecord(expire: string, timestamp: string, size: number, valueStr: string | undefined): string {
    const meta = JSON.stringify({ expire, timestamp, size });
    if (valueStr === undefined) return meta;
    return `${meta.slice(0, -1)},"content":${valueStr}}`;
  }

  public async read(bucket: IBucket, key: string): Promise<IDataStoreObject> {
    const val = JSON.parse(await bucket.db.get(key));
    return { value: val.content, timestamp: val.timestamp };
  }

  public async readBucketMetadata(bucket: IBucket, filter: string): Promise<any[]> {
    const objList: IDataStoreObjectMetaData[] = [];
    const opt = {
      gt: filter,
    };

    return await new Promise((resolve, reject) => {
      bucket.metadb.createReadStream(filter ? opt : null)
        .on('data', function (data: any) {
          const obj: IDataStoreObjectMetaData = {
            key: data.key,
            timestamp: data.value.timestamp,
            size: data.value.size,
            expire: data.value.expire,
          };

          if ((filter) && (obj.key.substring(0, filter.length) !== filter)) {
            resolve(objList);
            this.destroy();
            return;
          }
          objList.push(obj);
        })
        .on('error', (err: Error) => {
          return reject(err);
        })
        .on('close', () => { })
        .on('end', () => {
          return resolve(objList);
        });
    });
  }

  public async list(bucket: IBucket, filter: string, keysOnly: boolean): Promise < IDataStoreObjectMetaData[] > {
    return await new Promise((resolve, reject) => {
      const objList: IDataStoreObjectMetaData[] = [];
      const opt = {
        gt: filter,
      };

      bucket.db.createReadStream(filter ? opt : null)
        .on('data', function (data: any) {
          const val = JSON.parse(data.value);
          const obj: IDataStoreObjectMetaData = {
            key: data.key,
            timestamp: val.timestamp,
            size: val.size,
            expire: val.expire,
          };
          if ((filter) && (obj.key.substring(0, filter.length) !== filter)) {
            resolve(objList);
            this.destroy();
            return;
          }
          if (!keysOnly) {
            obj.content = val.content;
          }
          objList.push(obj);
        })
      .on('error', (err: Error) => {
        return reject(err);
      })
      .on('close', () => {})
      .on('end', () => {
        resolve(objList);
      });
    });
  }

  public async write(bucket: IBucket, key: string, value: any, timestamp: string, expire: string):
    Promise <IDataStoreObjectMetaData> {
    const ts = timestamp || new Date().toISOString();
    const valueStr = JSON.stringify(value);
    const size = valueStr === undefined ? 0 : valueStr.length;

    await bucket.db.put(key, DataStoreLevel.encodeRecord(expire, ts, size, valueStr));
    await bucket.metadb.put(key, { timestamp: ts, size, expire });
    return { expire, timestamp: ts, size, content: value, key };
  }

  public async remove(bucket: IBucket, key: string): Promise<void> {
    await bucket.db.del(key);
    await bucket.metadb.del(key);
  }

  public async removeBucket(bucket: IBucket) {
    bucket.isDeleting = true;
    await this.close(bucket);
    await fsp.rm(bucket.dbPath, { recursive: true, force: true });
    // remove the (now empty) bucket folder; if it still holds e.g. www assets,
    // rmdir fails with ENOTEMPTY (expected) — only log genuinely unexpected errors
    try {
      await fsp.rmdir(config.bucketDir + FileUtils.encodeBucketPath(bucket.key));
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if ((e.code !== 'ENOTEMPTY') && (e.code !== 'ENOENT')) {
        logger.error(`could not remove bucket folder ${e}`);
      }
    }
  }

  public async removeBucketData(bucket: IBucket) : Promise < void > {
    const arr = await this.readBucketMetadata(bucket, null);
    await Promise.all(arr.map(item => this.remove(bucket, item.key)));
  }

  private static async doRepair(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      leveldown.repair(path, (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  }

  public async repair(bucket: IBucket, dbPath: string, metaPath: string): Promise<void> {
    let wasOpen = false;
    if (this.isOpen(bucket)) {
      await this.close(bucket);
      wasOpen = true;
    }
    bucket.status.repairing = true;
    try {
      logger.info(`Repairing db ${bucket.key}..`);
      await DataStoreLevel.doRepair(dbPath);
      await DataStoreLevel.doRepair(metaPath);
      logger.info(`DB ${bucket.key} repaired`);
      if (wasOpen) await this.open({ bucket, path: bucket.dbPath, name: '' });
    } finally {
      bucket.status.repairing = false;
    }
  }

  static async openDB(path, opt): Promise<any> {
    return new Promise((resolve, reject) => {
      level(path, opt, (err: Error, db: any) => {
        if (err) return reject(err);
        return resolve(db);
      });
    });
  }

  public async open(params: ILevelBucketParameters): Promise<void> {
    const path = params.path;
    if (params.bucket.isDeleting) {
      throw new Error('db is being deleted');
    }
    const metaPath = `${path}/metadata`;
    try {
      await fs.promises.mkdir(path, { recursive: true });
    } catch (err) {
      logger.error('leveldb - cannot create bucket folder');
      throw err;
    }

    let db = null;
    try {
      // Records are stored as raw JSON text (utf8) so we serialize the value
      // ourselves exactly once in write(); this is byte-compatible with data
      // previously written using the 'json' value encoding.
      db = await DataStoreLevel.openDB(path, {
        valueEncoding: 'utf8',
      });
    } catch (err) {
      logger.error(`leveldb - cannot open ${path} ${err}`);
      throw err;
    }

    let copyMetadata = false;
    try {
      await fsp.stat(metaPath);
    } catch (err) {
      copyMetadata = true;
    }

    let metadb;
    try {
      metadb = await DataStoreLevel.openDB(metaPath, { valueEncoding: 'json' });
    } catch (err) {
      logger.error(`leveldb - cannot open metadata db ${metaPath} ${err}`);
      throw err;
    }
    params.bucket.db = db;
    params.bucket.metadb = metadb;
    params.bucket.dbPath = path;
    if (copyMetadata) {
      await this.copyBucketMetaData(params.bucket);
    }
    logger.info(`leveldb - opened ${path}`);
  }

  public async close(bucket: IBucket) {
    if (bucket.db) {
      await bucket.metadb.close();
      await bucket.db.close();
      bucket.db = null;
    } else {
      throw new Error('Level.close: Bucket does not exist');
    }
  }

  public async init() {
    return;
  }

  public async scanForBuckets() {
    const arr = await FileUtils.dirList(config.bucketDir);
    const res = [];
    for (let i = 0; i < arr.length; i += 1) {
      if ((arr[i]) && (arr[i].isDir)) res.push(FileUtils.decodeBucketPath(arr[i].file));
    }
    return res;
  }

  public isOpen(bucket: IBucket) {
    return (bucket.db) && ((bucket.db.isOpen()) && (bucket.metadb.isOpen()));
  }

  private async copyBucketMetaData(bucket: IBucket) {
    logger.info(`Copying metadata for bucket ${bucket.key}`);
    const objects = await this.list(bucket, null, true);
    const ops = [];
    for (let i = 0; i < objects.length; i += 1) {
      ops.push({
        type: 'put', key: objects[i].key, value: {
          timestamp: objects[i].timestamp,
          size: objects[i].size,
          expire: objects[i].expire,
        },
      });
    }
    await bucket.metadb.batch(ops);
  }
}
