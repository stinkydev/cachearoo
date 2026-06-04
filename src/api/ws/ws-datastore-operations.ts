import { DataStore } from '../../datastore/datastore';
import { logger } from '../../logger';

const BUCKET_SEPARATOR = '|-//--//--//-|';

export interface IResponseObject {
  id: string;
  value?: any;
  error?: any;
  location?: string;
}

class SessionExpiringKeys {
  private keys: Map<string, any[]>;
  private ds: DataStore;

  constructor(datastore: DataStore) {
    this.keys = new Map();
    this.ds = datastore;
  }

  public add(bucket, key, connection) {
    const _key = bucket + BUCKET_SEPARATOR + key;
    const arr = this.keys.get(_key);
    if (!arr) {
      this.keys.set(_key, [connection]);
    } else {
      if (arr.indexOf(connection) === -1) {
        arr.push(connection);
      }
    }
  }

  public removeByConnection(connection) {
    [...this.keys.entries()]
      .filter(entry => entry[1].indexOf(connection) > -1)
      .forEach((entry) => {
        entry[1].splice(entry[1].indexOf(connection), 1);
        const arr = entry[0].split(BUCKET_SEPARATOR);

        this.ds.remove(arr[0], arr[1], connection)
          .catch(err => logger.error(err.message));

        if (entry[1].length <= 0) {
          this.keys.delete(entry[0]);
        }
      });
  }
}

export class WSAPIDataStoreOperations {
  private ds: DataStore;
  private expiringkeys: SessionExpiringKeys;

  constructor(datastore: DataStore) {
    this.expiringkeys = new SessionExpiringKeys(datastore);
    this.ds = datastore;
  }

  public deleteSessionExpiringKeys(connection) {
    this.expiringkeys.removeByConnection(connection);
  }

  public isReadOperation(msgObj: any): boolean {
    const req = msgObj.request;
    return (req.op === 'read') || (req.op === 'filter');
  }

  public async processOperation(msgObj, connection) {
    const req = msgObj.request;
    const response: IResponseObject = { id: req.id };

    if (req.bucket) req.bucket = `${req.bucket}`;
    req.connection = connection;

    switch (req.op) {
      case 'read':
        connection.info.reads = connection.info.reads + 1;
        try {
          const value = await this.processRead(req);
          response.value = value;
        } catch (err) {
          response.error = err;
        }
        connection.send(JSON.stringify({ response }));
        break;
      case 'filter':
        try {
          const value = await this.processFilter(req);
          response.value = value;
        } catch (err) {
          response.error = err;
        }
        connection.send(JSON.stringify({ response }));
        break;
      case 'write':
        connection.info.writes = connection.info.writes + 1;
        try {
          const key = await this.processWrite(req);
          if (req.expire === 'session') {
            this.expiringkeys.add(req.bucket, key, req.connection);
          }
          response.location = `/_data/${req.bucket}/${key}`;
        } catch (err) {
          response.error = err;
        }
        connection.send(JSON.stringify({ response }));
        break;
      case 'remove':
        connection.info.writes = connection.info.writes + 1;
        try {
          await this.processRemove(req);
        } catch (err) {
          response.error = err;
        }
        connection.send(JSON.stringify({ response }));
        break;
      case 'patch':
        connection.info.writes = connection.info.writes + 1;
        try {
          const value = await this.processPatch(req);
          response.value = value;
        } catch (err) {
          response.error = err;
        }
        connection.send(JSON.stringify({ response }));
        break;
      default:
        response.error = new Error('Operation not found!');
        break;
    }

    if (response.error) {
      throw response.error;
    }
  }

  private async processWrite(req) {
    if ((req.key === undefined) || (req.key === null) || (req.key === '')) {
      req.key = this.ds.generateKey();
    }
    req.key = `${req.key}`;

    let writeMethod = this.ds.write.bind(this.ds);
    if (req.failIfExists) writeMethod = this.ds.writeFailIfExists.bind(this.ds);

    await writeMethod(req.bucket, req.key, req.value, req.connection, req.expire, req.id);
    return req.key;
  }

  private async processPatch(req) {
    return await this.ds.patch(req.bucket, req.key, req.patch, req.connection, null, req.removeDataFromReply);
  }

  private async processRead(req) {
    if ((req.key === undefined) || (req.key === null) || (req.key === '')) {
      return await this.ds.list(req.bucket);
    }
    return (await this.ds.read(req.bucket, req.key)).value;
  }

  private async processFilter(req) {
    return await this.ds.list(req.bucket, req.filter, req.keysOnly);
  }

  private async processRemove(req) {
    return await this.ds.remove(req.bucket, req.key, req.connection, req.id);
  }
}
