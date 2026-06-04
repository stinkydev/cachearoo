
export interface IDataStoreObject {
  timestamp: string;
  value: any;
}

export interface IDataStoreObjectMetaData {
  key: string;
  timestamp: string;
  size: number;
  expire: string;
  content?: any;
}

export interface IBucketParameters {
  name: string;
  bucket?: IBucket;
}

export enum DataStoreType {
  DST_LEVELDB = 'leveldb',
  DST_AZURE = 'azure-table',
}

export interface IBucket {
  key: string;
  config: any;
  status: any;
  isDeleting: boolean;
  disabled: boolean;
  db?: any;
  metadb?: any;
  dbPath?: string;
}

export interface IDataStore {
  init(): Promise<void>;
  read(bucket: IBucket, key: string): Promise<IDataStoreObject>;
  write(
    bucket: IBucket,
    key: string,
    value: any,
    timestamp?: string,
    expire?: string): Promise<IDataStoreObjectMetaData>;
  repair(bucket: IBucket, dbPath: string, metaPath: string): Promise<void>;
  list(bucket: IBucket, filter: string, keysOnly: boolean): Promise<IDataStoreObjectMetaData[]>;
  scanForBuckets(): Promise<string[]>;
  open(params: IBucketParameters): Promise<void>;
  isOpen(bucket: IBucket): boolean;
  close(name: IBucket): Promise<void>;
  remove(bucket: IBucket, key: string): Promise<void>;
  removeBucketData(bucket: IBucket): Promise<void>;
  removeBucket(bucket: IBucket): Promise<void>;
}
