import { connection, Message, server as WebSocketServer } from 'websocket';
import { WSAPIDataStoreOperations } from './ws-datastore-operations';

import { getDeviceId } from '../../device-id';

import * as URL from 'url';
import { DataStore } from '../../datastore/datastore';
import { Server } from 'http';
import { logger } from '../../logger';

const MAX_OBJ_SIZE = 1024 * 1024 * 128;

interface IBroadcastObject {
  bucket: string;
  key: string;
  timestamp: string;
  originRequestId: string;
  clientId?: string;
  isDeleted?: boolean;
  value?: any;
}

interface IConnectionInfo {
  clientId: string;
  bytesSent: number;
  reads: number;
  writes: number;
  events: number;
  connectedSince: string;
  remoteAddress: string;
}

interface IEventRegistration {
  bucket: string;
  key: string;
}

interface IConnectionWithInfo extends connection {
  info: IConnectionInfo;
  registeredEvents: IEventRegistration[];
  isReplication: boolean;
  sendValues: boolean;
  callback: any;
}

interface IBinaryHeader {
  type: number;
  bucket: string;
  key: string;
  apiKey: string;
}

function bufferToHeader(buffer: Buffer): IBinaryHeader {
  const bucketLength = buffer[1];
  const keyLength = buffer[2];
  const apiKeyLength = buffer[3];
  const res: IBinaryHeader = {
    type: buffer[0],
    bucket: '',
    key: '',
    apiKey: '',
  };

  let offset = 4;
  res.bucket = buffer.toString('utf-8', offset, offset + bucketLength);
  offset += bucketLength;

  res.key = buffer.toString('utf-8', offset, offset + keyLength);
  offset += keyLength;

  res.apiKey = buffer.toString('utf-8', offset, offset + apiKeyLength);

  return res;
}

export class WSAPI {
  private wsServer: WebSocketServer;
  private wsClients: IConnectionWithInfo[] = [];
  private dsOperations: WSAPIDataStoreOperations;
  private apiKey: string | null;
  private publicReadOk: boolean;

  public onSynchronizeReplicationClient: any = null;

  constructor(datastore: DataStore) {
    this.dsOperations = new WSAPIDataStoreOperations(datastore);
  }

  public init(server: Server, apiKey: string | null, publicReadOk: boolean) {
    this.apiKey = apiKey;
    this.publicReadOk = publicReadOk;

    this.wsServer = new WebSocketServer({
      httpServer: server,
      maxReceivedFrameSize: MAX_OBJ_SIZE,
      maxReceivedMessageSize: MAX_OBJ_SIZE,
    });

    // WebSocket server
    this.wsServer.on('request', (request) => {
      const url = URL.parse(request.httpRequest.url, true);
      if (url.query.id === getDeviceId()) {
        logger.warn('Rejecting connection with same id');
        return request.reject();
      }

      const connection = request.accept(null, request.origin) as any as IConnectionWithInfo;
      connection.info = {
        clientId: url.query.id as string,
        bytesSent: 0,
        reads: 0,
        writes: 0,
        events: 0,
        connectedSince: new Date().toISOString(),
        remoteAddress: (request.httpRequest.headers['x-forwarded-for'] ||
          request.httpRequest.connection.remoteAddress) as string,
      };

      connection.registeredEvents = [];
      connection.isReplication = false;
      connection.sendValues = true;
      connection.callback = this.onSynchronizeReplicationClient;
      this.wsClients.push(connection);

      try {
        connection.send(JSON.stringify({ id: getDeviceId() }));
      } catch (e) {
        logger.error(`Could not send device id: ${e.message}`);
      }

      (connection as connection).on('message', (message: Message) => {
        if (message.type === 'binary') {
          const data = message.binaryData;
          try {
            if (data.length >= 128) {
              const headerBuf = data.slice(0, 127);
              const header = bufferToHeader(headerBuf);
              if ((this.apiKey) && (this.apiKey !== header.apiKey)) {
                return connection.send(JSON.stringify({ response: { error: 'Not authorized to send event' } }));
              }
              this.wsBroadcastBinary(header.bucket, header.key, data, connection);
            }
          } catch (err) {
            logger.error(err);
          }

        } else if (message.type === 'utf8') {
            // process WebSocket message
          try {
            connection.info.bytesSent = connection.info.bytesSent + message.utf8Data.length;
            const obj = JSON.parse(message.utf8Data);
            if (obj.msg === 'register-events') {
              if ((this.apiKey) && ((this.apiKey !== obj.apiKey) && (!this.publicReadOk))) {
                return;
              }
              connection.registeredEvents = obj.events;
              connection.isReplication = false;
              connection.sendValues = obj.sendValues;
            }

            if (obj.msg === 'register-replication-client') {
              if ((this.apiKey) && (this.apiKey !== obj.apiKey)) {
                if (!this.publicReadOk) {
                  return connection.send(JSON.stringify({ response: { error: 'Not authorized' } }));
                }
              }
              connection.registeredEvents = obj.events;
              connection.isReplication = true;
              if (connection.callback != null) {
                connection.callback(connection, sendBucket);
              }
            }

            if (obj.msg === 'datastore-operation') {
              if ((this.apiKey) && ((this.apiKey !== obj.apiKey))) {
                const isRead = this.dsOperations.isReadOperation(obj);
                if ((!isRead) || (isRead && !this.publicReadOk)) {
                  return connection.send(JSON.stringify({ response: { id: obj.request.id, error: 'Not authorized' } }));
                }
              }

              this.dsOperations.processOperation(obj, connection)
                .catch(err => logger.error(`WSAPI datastore operation error: ${err.stack}`));
            }

            if (obj.msg === 'event-broadcast') {
              if ((this.apiKey) && (this.apiKey !== obj.apiKey)) {
                return connection.send(JSON.stringify({ response: { error: 'Not authorized to send event' } }));
              }

              if (obj.event.bucket) {
                obj.event.bucket = `${obj.event.bucket}`;
              }
              this.wsBroadcastChange(
                obj.event.bucket,
                obj.event.key,
                obj.event.value,
                false,
                connection,
                new Date().toISOString(),
              );
            }

            if (obj.msg === 'ping') {
              connection.send(JSON.stringify({ pong: new Date().toISOString() }));
            }

          } catch (e) {
            logger.error(e);
            connection.send(JSON.stringify({ response: { error: 'Message is not valid JSON' } }));
          }
        }
      });

      // A socket error (e.g. a client with a poor connection that resets) emits
      // 'error'; without a listener Node throws an unhandled error and can take
      // the whole process down. Log it and let the following 'close' clean up.
      connection.on('error', (err: Error) => {
        logger.warn(`ws client error (${connection.info.remoteAddress}): ${err && err.message ? err.message : err}`);
      });

      connection.on('close', () => {
        const index = this.wsClients.indexOf(connection);
        this.dsOperations.deleteSessionExpiringKeys(connection);

        if (index !== -1) {
          this.wsClients.splice(index, 1);
        }
      });
    });
  }

  public getClientConnectionInfo() {
    const res = { numberOfClients: this.wsClients.length, clients: [] as any[] };
    this.wsClients.forEach(client => res.clients.push(client.info));
    return res;
  }

  public setSynchronizeReplicationClientCallback (func: any) {
    this.onSynchronizeReplicationClient = func;
  }

  // Does a connection's registration list cover (bucket, key)? '*' matches any.
  private isSubscribed(registeredEvents: IEventRegistration[], bucket: string, key: string): boolean {
    for (const ev of registeredEvents) {
      if (((ev.bucket === bucket) || (ev.bucket === '*')) && ((ev.key === key) || (ev.key === '*'))) {
        return true;
      }
    }
    return false;
  }

  // Send to one subscriber without letting a failure (e.g. a dead/poor socket)
  // abort the broadcast loop or propagate back into the datastore write path.
  private safeSend(destination: IConnectionWithInfo, payload: string | Buffer) {
    try {
      destination.send(payload);
      destination.info.events++;
    } catch (err) {
      logger.warn(`Failed to send to ws client (${destination.info.remoteAddress}): ${err && (err as Error).message ? (err as Error).message : err}`);
    }
  }

  public wsBroadcastBinary(bucket: string, key: string, value: Buffer, originConnection: connection) {
    for (const destination of this.wsClients) {
      if (destination === originConnection) continue;
      if (this.isSubscribed(destination.registeredEvents, bucket, key)) {
        this.safeSend(destination, value);
      }
    }
  }

  public wsBroadcastChange(bucket: string, key: string, value: any, isDeleted: boolean,
      originConnection: any, timestamp: string, originRequestId?: string) {

    const base: IBroadcastObject = { bucket, key, timestamp, originRequestId };
    if (originConnection) {
      base.clientId = originConnection.clientId;
    }
    if (isDeleted) {
      base.isDeleted = true;
    }

    // The payload only varies by whether `value` is included, so serialize at
    // most twice and reuse the strings across every matching subscriber.
    let strWithValue: string | null = null;
    let strWithoutValue: string | null = null;

    for (const destination of this.wsClients) {
      if (destination === originConnection) continue;
      if (!this.isSubscribed(destination.registeredEvents, bucket, key)) continue;

      const sendValue = destination.isReplication || destination.sendValues;
      let payload: string;
      if (sendValue) {
        if (strWithValue === null) strWithValue = JSON.stringify({ ...base, value });
        payload = strWithValue;
      } else {
        if (strWithoutValue === null) strWithoutValue = JSON.stringify(base);
        payload = strWithoutValue;
      }
      this.safeSend(destination, payload);
    }
  }
}

function sendBucket(connection: any, bucket: string, data: any) {
  connection.send(JSON.stringify({ bucket, data }));
}
