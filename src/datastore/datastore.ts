const jsonPatch = require('json-patch');
import { Semaphore } from 'await-semaphore';
import { FileUtils } from '../file-utils';

import { DataStoreInMemory } from './datastore-memory';
import { DataStoreLevel, ILevelBucketParameters } from './leveldb/datastore-level';
import { IDataStore, IBucket } from './idatastore';
import { EventEmitter } from 'events';
import { Config } from '../config';
import { logger } from '../logger';

const BUCKET_CONFIG_NAME = '_bucket_config';
const VIRTUAL_PATHS_CONFIG_NAME = '_virtual_paths_config';

const writeSemaphore = new Semaphore(1);
const bucketCreationSemaphore = new Semaphore(1);

// not visible in bucket list etc
const systemBuckets = [BUCKET_CONFIG_NAME, VIRTUAL_PATHS_CONFIG_NAME];

export class DataStore extends EventEmitter{
  private storage: IDataStore = null;
  private inMemoryStorage: DataStoreInMemory;
  private buckets: Map<string, IBucket>;
  private config: any;

  private keyLast = '';
  private keyCounter = 0;

  constructor (config: Config) {
    super();
    this.config = config;
    this.inMemoryStorage = new DataStoreInMemory();
    this.buckets = new Map();
  }

  static isValidBucketName(bucketName: string): boolean {
    if (bucketName.trim() !== bucketName) return false;
    if (bucketName.endsWith('.')) return false;
    if (bucketName.startsWith('.')) return false;
    if (['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'].indexOf(bucketName) > -1) return false;
    return true;
  }

  public onDataUpdated: (
    bucket: string,
    key: string,
    value: any,
    isDeleted: boolean,
    userdata: any,
    timestamp: string,
    requestId: string,
  ) => void;

  private doDataUpdateEvent(
    bucket: string,
    key: string,
    value: any,
    isDeleted: boolean,
    userdata: any,
    timestamp: string,
    requestId: string,
  ) {
    if (!this.isSystemBucket(bucket)) {
      this.onDataUpdated(bucket, key, value, isDeleted, userdata, timestamp, requestId);
    } else if (bucket === BUCKET_CONFIG_NAME) {
      this.emit('bucket-list-update');
    } else if (bucket === VIRTUAL_PATHS_CONFIG_NAME) {
      this.emit('virtual-path-update');
    }
  }

  public async init() {
    this.storage = new DataStoreLevel();
    await this.storage.init();
    try {
      await this.createBucket(BUCKET_CONFIG_NAME, null);
    } catch (err) {
      throw new Error(`Create config bucket failed: ${err.message}`);
    }
  }

  public async createBuckets(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1) {
      try {
        await this.createBucket(keys[i], null);
      } catch (err) {
        logger.error(`Create bucket failed for ${keys[i]}, reason: ${err}}`);
      }
    }
  }

  public async createBucket(id: string, config?: any) {
    if (!this.buckets.has(id)) {
      if (!DataStore.isValidBucketName(id)) throw new Error('Invalid bucket name');

      const bucket: IBucket = {
        key: id,
        disabled: false,
        isDeleting: false,
        config: {},
        status: {},
      };
      this.buckets.set(id, bucket);
    }
    const bucket = this.buckets.get(id);
    bucket.status.isOpen = this.storage.isOpen(bucket);
    await this.applyBucketConfig(id, config);
  }

  public async createBucketIfNotExists(id: string) {
    if (this.buckets.has(id)) return;

    const release = await bucketCreationSemaphore.acquire();
    try {
      await this.createBucket(id, null);
    } finally {
      release();
    }
  }

  // create bucket if it doesn't exist and apply config (supplied or from datastore)
  private async initializeBucket(id: string, config: any, throwError = true) {
    try {
      await this.createBucket(id, config);
      this.doDataUpdateEvent(BUCKET_CONFIG_NAME, id, null, null, null, null, null);
    } catch (err) {
      logger.error('Initialize bucket failed: ', err);
      if (throwError) throw err;
    }
  }

  private getEmptyConfig() {
    return {};
  }

  // apply config and save to storage. If none supplied, create empty and store
  private async applyBucketConfig(id: string, config: any) {
    const configBucket = this.buckets.get(BUCKET_CONFIG_NAME);
    if (config) {
    // config is passed, store it and apply
      await this.storage.write(configBucket, id, config);
      this.buckets.get(id).config = config;
      await this.updateDBState(id, config);
    } else {
    // config is not passed, try to read it
      try {
        const config = await this.storage.read(configBucket, id);
        delete config.value.isDeleting;
        this.buckets.get(id).config = config.value;
        await this.updateDBState(id, config.value);
      } catch (err) {
        const conf = this.getEmptyConfig();
        await this.updateDBState(id, conf);
        await this.storage.write(configBucket, id, conf);
        this.buckets.get(id).config = conf;
      }
    }
  }

  private async updateDBState(id: string, config: any) {
    const bucket = this.buckets.get(id);

    if (config.disabled) {
      if (await this.storage.isOpen(bucket)) {
        this.storage.close(bucket);
      }
      return;
    }

    if (!this.storage.isOpen(bucket)) {
      try {
        const params: ILevelBucketParameters = {
          bucket,
          path: this.getBucketPath(id),
          name: id,
        };
        await this.storage.open(params);
        await this.deleteExpiredKeys(bucket);
        bucket.status.isOpen = true;
      } catch (err) {
        bucket.status.isOpen = false;
        logger.error(`Could not open db - ${err.message}`);
        throw err;
      }
    }
  }

  private getStorage(bucket: IBucket) {
    if ((bucket === null) || (bucket === undefined)) {
      return this.storage;
    }

    if (bucket.config.persistenceDisabled) {
      return this.inMemoryStorage;
    }
    return this.storage;
  }

  private getBucketPath(id: string): string {
    return `${this.config.bucketDir}${FileUtils.encodeBucketPath(id)}/db`;
  }

  private isSystemBucket(bucketName: string): boolean {
    return (systemBuckets.indexOf(bucketName) > -1);
  }

  private bucketExists(id: string): boolean {
    return this.buckets.has(id);
  }

  public async deleteBucket(id: string) {
    this.buckets.delete(id);
    await this.storage.remove(this.buckets.get(BUCKET_CONFIG_NAME), id);
  }

  // returns cached bucket config
  public async getBucketConfig(id: string) {
    if (this.bucketExists(id)) {
      return {
        timestamp: new Date().toISOString(),
        value: this.buckets.get(id),
      };
    }
    throw new Error(`Bucket does not exist: ${id}`);
  }

  private async deleteExpiredKeys(bucket: IBucket) {
    const storage = this.getStorage(bucket);
    const keys = await this.storage.list(bucket, null, true);
    for (let i = 0; i < keys.length; i += 1) {
      if (keys[i].expire === 'session') {
        await storage.remove(bucket, keys[i].key);
      }
    }
  }

  public async updateBuckets() {
    const buckets = await this.storage.scanForBuckets();
    try {
      await this.createBuckets(buckets);
    } catch (err) {
      logger.error(`Create buckets failed: ${err}`);
    }
    return await this.list(BUCKET_CONFIG_NAME, null, null, true);
  }

  private getConfigBucket(): IBucket {
    return this.buckets.get(BUCKET_CONFIG_NAME);
  }

  public async repair(bucketName: string) {
    const bucket = this.buckets.get(bucketName);
    if (!bucket) throw new Error('Repair error, bucket does not exist');
    if (bucket.status.repairing === true) throw new Error('Bucket already repairing');

    const storage = this.getStorage(bucket);
    const dbPath = this.getBucketPath(bucketName);
    const metaPath = `${dbPath}/metadata`;
    await storage.repair(bucket, dbPath, metaPath);
  }

  public async read(bucketName: string, key: string) {
    let bucket = this.buckets.get(bucketName);
    const storage = this.getStorage(bucket);

    if (bucketName === BUCKET_CONFIG_NAME) {
      return this.getBucketConfig(key);
    }

    // if bucket is not available, try a rescan
    if (!bucket) {
      await this.updateBuckets();
      bucket = this.buckets.get(bucketName);
    }
    if (!bucket) throw new Error(`Bucket ${bucketName} not found`);
    return await storage.read(bucket, key);
  }

  private async waitForBucketCreation(bucketName: string) {
    const bucket = this.buckets.get(bucketName);
    if (bucket.status.isOpen) {
      return;
    }
    const release = await bucketCreationSemaphore.acquire();
    release();
  }

  public async write(bucketName: string, key: string, value: any, userdata: any, expire: string, requestId: string) {
    if (bucketName === BUCKET_CONFIG_NAME) {
      return this.initializeBucket(key, value);
    }

    await this.createBucketIfNotExists(bucketName);
    await this.waitForBucketCreation(bucketName);
    const bucket = this.buckets.get(bucketName);
    const storage = this.getStorage(bucket);
    const obj = await storage.write(bucket, key, value, null, expire);
    this.doDataUpdateEvent(bucketName, key, value, null, userdata, obj.timestamp, requestId);
  }

  public async writeFailIfExists(bucketName: string, key: string,
      value: any, userdata: any, expire: string, requestId: string) {
    const release = await writeSemaphore.acquire();

    let exists = false;
    try {
      await this.read(bucketName, key);
      exists = true;
    } catch (err) {
      await this.write(bucketName, key, value, userdata, expire, requestId);
    } finally {
      release();
    }
    if (exists) throw new Error('EEXISTS');
  }

  public async patch(bucketName: string, key: string, patch: any,
    userdata: any, requestId: string, removeDataFromReply: boolean) {

    const bucket = this.buckets.get(bucketName);
    const storage = this.getStorage(bucket);

    const release = await writeSemaphore.acquire();
    try {
      const obj = await storage.read(bucket, key);
      const patched = jsonPatch.apply(obj.value, patch);
      await storage.write(bucket, key, obj.value, null, null);
      this.doDataUpdateEvent(bucketName, key, patched, null, userdata, null, requestId);
      return removeDataFromReply ? {} : patched;
    } finally {
      release();
    }
  }

  public async remove(bucketName: string, key: string, userdata?: any, requestId?: string) {
    const bucket = this.buckets.get(bucketName);
    const storage = this.getStorage(bucket);

    if (bucketName === BUCKET_CONFIG_NAME) {
      return this.removeBucketAndData(key);
    }

    await storage.remove(bucket, key);
    this.doDataUpdateEvent(bucketName, key, null, true, userdata, null, requestId);
  }

  // read all items in bucket
  public async list(bucketName: string, filter: string = null, keysOnly = false, objRef: any = null) {
    const storage = this.getStorage(this.buckets.get(bucketName));

    if (bucketName === BUCKET_CONFIG_NAME) {
      if (objRef) {
        return [...this.buckets.values()];
      }
      return [...this.buckets.values()].map((bucket) => {
        const str = JSON.stringify(bucket);
        const objCopy = JSON.parse(str);
        delete(objCopy.db);
        objCopy.timestamp = new Date().toISOString();
        objCopy.size = str.length;
        return objCopy;
      });
    }

    const bucket = this.buckets.get(bucketName);

    if ((bucket == null) || (bucket.isDeleting) || (!storage.isOpen(bucket))) {
      return [];
    }

    if (keysOnly) {
      return this.readBucketMetadata(bucketName, filter);
    }
    return storage.list(bucket, filter, keysOnly);
  }

  public async readBucketMetadata(bucketName: string, filter: string) {
    const bucket = this.buckets.get(bucketName);
    const storage = this.getStorage(bucket);

    if ((bucket == null) || (bucket.isDeleting) || (!storage.isOpen(bucket))) {
      return [];
    }
    if (typeof (storage as any).readBucketMetadata === 'function') {
      return (storage as any).readBucketMetadata(bucket, filter);
    }
    return storage.list(bucket, filter, true);
  }

  public async removeBucketData(bucketName: string) {
    const bucket = this.buckets.get(bucketName);
    const storage = this.getStorage(bucket);

    await storage.removeBucketData(bucket);
    this.doDataUpdateEvent(bucketName, null, null, true, null, null, null);
  }

  public async removeBucketAndData(bucketName: string) {
    await this.storage.removeBucket(this.buckets.get(bucketName));
    await this.storage.remove(this.getConfigBucket(), bucketName);
    this.buckets.delete(bucketName);
  }

  public async receiveReplicationMessage(replObj: any) {
    const bucket = this.buckets.get(replObj.bucket);
    if ((bucket == null) || (bucket.disabled)) {
      logger.warn(`Replication msg arrived but bucket is disabled/non-existing - ${replObj.bucket}`);
      return;
    }

    const storage = this.getStorage(bucket);

    if (replObj.data) {
      // resynchronize complete bucket
      const keysSynced = [];
      for (let i = 0; i < replObj.data.length; i += 1) {
        const value = replObj.data[i].content;
        this.doDataUpdateEvent(replObj.bucket, replObj.data[i].key, value, null, null, null, null);
        keysSynced.push(replObj.data[i].key);
        try {
          await this.storage.write(bucket, replObj.data[i].key, value, replObj.data[i].timestamp);
        } catch (err) {
          logger.error('replicationMessage error when writing to datastore:', err);
        }
      }

      if (this.config.replicationKeepLocalObjects) return;

      // delete local keys that were not synced
      const data = await storage.list(bucket, null, true);
      for (let i = 0; i < data.length; i += 1) {
        let found = false;
        for (let j = 0; j < keysSynced.length; j += 1) {
          if (data[i].key === keysSynced[j]) {
            found = true;
            break;
          }
        }
        if (!found) {
          try {
            await storage.remove(bucket, data[i].key);
            logger.info(`Deleted key ${data[i].key}`);
          } catch (err) {
            logger.error(err);
          }
        }
      }
    } else if (replObj.value) {
      const value = replObj.value;
      try {
        await storage.write(bucket, replObj.key, value, replObj.timestamp, 'repl-client');
        this.doDataUpdateEvent(replObj.bucket, replObj.key, value, null, null, null, null);
      } catch (err) {
        logger.error('replicationMessage error when writing to datastore:', err);
      }
    } else if (replObj.isDeleted) {
      try {
        await storage.remove(bucket, replObj.key);
        this.doDataUpdateEvent(replObj.bucket, replObj.key, null, true, null, null, 'repl-client');
      } catch (err) {
        logger.error(err);
      }
    }
  }

  public generateKey() {
    let key = `gen_${new Date().valueOf()}`;
    if (key === this.keyLast) {
      this.keyCounter += 1;
      key = `${key}-${this.keyCounter}`;
    } else {
      this.keyLast = key;
      this.keyCounter = 0;
    }
    return key;
  }

}
