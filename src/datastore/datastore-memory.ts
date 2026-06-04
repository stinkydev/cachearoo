import { IDataStore, IDataStoreObject, IDataStoreObjectMetaData, IBucketParameters, IBucket } from './idatastore';

export class DataStoreInMemory implements IDataStore {
  private store: Map<string, any>;

  constructor() {
    this.store = new Map();
  }

  private getBucket(key: string): Map<string, any> {
    const bkt = this.store.get(key);
    if (!bkt) throw new Error(`Bucket ${key} not found`);
    return bkt;
  }

  public async read(bucket: IBucket, key: string): Promise<IDataStoreObject> {
    const bkt = this.getBucket(bucket.key);
    const val = bkt.get(key);
    if (!val) throw new Error(`'Key ${key} not found in ${bucket.key}`);
    return { value: val.content, timestamp: val.timestamp };
  }

  public async list(bucket: IBucket, filter: string, keysOnly: boolean): Promise<IDataStoreObjectMetaData[]> {
    let bkt = null;
    try {
      bkt = this.getBucket(bucket.key);
    } catch (err) {
      return [];
    }

    return [...bkt.entries()]
      .filter(entry => !filter || entry[0].substring(0, filter.length) === filter)
      .map((entry) => {
        const obj: IDataStoreObjectMetaData = {
          key: entry[0],
          timestamp: entry[1].timestamp,
          size: entry[1].size,
          expire: entry[1].expire,
        };
        if (!keysOnly) obj.content = entry[1].content;
        return obj;
      });
  }

  public async write(bucket: IBucket, key: string, value: any, tmstmp: string, expire: string):
    Promise<IDataStoreObjectMetaData> {
    let bkt = this.store.get(bucket.key);
    if (!bkt) {
      bkt = new Map();
      this.store.set(bucket.key, bkt);
    }
    const size = JSON.stringify(value).length;
    const timestamp = tmstmp || new Date().toISOString();

    const obj = {
      expire,
      size,
      timestamp,
      content: value,
    };
    bkt.set(key, obj);
    return {
      key,
      timestamp,
      size,
      expire,
      content: value,
    };
  }

  public async remove(bucket: IBucket, key: string) {
    const bkt = this.getBucket(bucket.key);
    bkt.delete(key);
  }

  public async removeBucket(bucket: IBucket) {
    this.store.delete(bucket.key);
  }

  public async removeBucketData(bucket: IBucket) {
    const bkt = this.getBucket(bucket.key);
    bkt.clear();
  }

  public async scanForBuckets(): Promise<string[]> {
    return [...this.store.keys()];
  }

  public async repair(bucket: IBucket): Promise<void> {
    return null;
  }

  public async open(params: IBucketParameters) {
    return;
  }

  public async close(bucket: IBucket) {
    return;
  }

  public async init() {
    return;
  }

  public isOpen(bucket: IBucket): boolean {
    return true;
  }
}
