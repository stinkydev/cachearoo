import * as nconf from 'nconf';
import { DataStoreType } from './datastore/idatastore';
import * as path from 'path';

const pjson = require('../package.json');

const version = pjson.version;

export class Config {
  public httpServerPort: number;
  public storageKind: DataStoreType;
  public AZURE_STORAGE_CONNECTION_STRING: string;
  public apiKey: string;
  public publicRead: boolean;
  public bucketDir: string;
  public logPath: string;
  public logLevel: string;
  public indexRedirect: string;
  public replicationKeepLocalObjects: boolean;
  public version: string = version;

  constructor() {
    readArguments();
    // config use ENV variables first, if they does not exist, use config file values instead
    const configFile = './config.json';
    nconf.env().file({ file: configFile });
    this.readSettings();
  }

  public setConfigFile(fn: string) {
    nconf.env().file({ file: fn });
    this.readSettings();
  }

  private readSettings() {
    const defaultBucketPath = path.join(process.cwd(), 'buckets');
    const defaultLogPath = path.join(process.cwd(), 'logs');
    this.httpServerPort = nconf.get('PORT') || 4300;
    this.storageKind = nconf.get('CACHEAROO_STORAGE_KIND') || 'leveldb'; // 'leveldb' or 'azure-table'
    this.AZURE_STORAGE_CONNECTION_STRING = nconf.get('AZURE_STORAGE_CONNECTION_STRING');
    this.apiKey = nconf.get('CACHEAROO_API_KEY');
    this.publicRead = !!nconf.get('CACHEAROO_PUBLIC_READ');
    // bucket paths are built by concatenation, so bucketDir must end with a separator
    const bucketDir: string = nconf.get('CACHEAROO_BUCKET_DIR') || defaultBucketPath;
    this.bucketDir = (bucketDir.endsWith('/') || bucketDir.endsWith('\\')) ? bucketDir : `${bucketDir}/`;
    this.logPath = nconf.get('CACHEAROO_LOG_PATH') || defaultLogPath;
    this.logLevel = nconf.get('CACHEAROO_LOG_LEVEL') || 'info';
    this.indexRedirect = nconf.get('CACHEAROO_INDEX_REDIRECT') || '/_admin';
    this.replicationKeepLocalObjects = (nconf.get('CACHEAROO_REPLICATION_KEEP_LOCAL_OBJECTS') === '1') || false;
  }

  public getUsers() {
    try {
      const users = JSON.parse(nconf.get('CACHEAROO_USERS'));

      if (Object.prototype.toString.call(users) === '[object Array]') {
        return users;
      }
      throw new Error('Users not an array');

    } catch (e) {
      return [];
    }
  }
}

function readArguments() {
  const args = process.argv;
  args.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if ((args[i] === '-p') && (i < args.length)) {
      process.env['PORT'] = args[i + 1];
    }
  }
}

export const config = new Config();
