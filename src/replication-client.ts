import { client as WebSocketClient } from 'websocket';
import { DataStore } from './datastore/datastore';
import { IBucket } from './datastore/idatastore';
import { getDeviceId } from './device-id';
import { logger } from './logger';
const reconnectDelay = 5000;
const clients = new Map<string, ReplicationClient>();

class ReplicationClient {
  public uri: string;
  private socket: WebSocketClient;
  private ds: DataStore;

  private doReconnect: boolean;
  private _status: string;
  private _connected: boolean;

  private callback;
  private connection;

  private bucket: IBucket;

  public get status() { return this._status }
  public get connected() { return this._connected }

  constructor(uri: string, bucket: IBucket, callback) {
    this.uri = uri;

    this.socket = new WebSocketClient({
      maxReceivedMessageSize: 128 * 1024 * 1024,
      keepalive: true,
      keepaliveInterval: 5000,
      dropConnectionOnKeepaliveTimeout: true,
      keepaliveGracePeriod: 10000,
    } as any);

    this.doReconnect = true;
    this._status = 'not started';
    this._connected = false;
    this.callback = callback;
    this.connection = null;

    this.bucket = bucket;
  }

  public disconnect() {
    this.doReconnect = false;
    this._connected = false;
    if (this.connection) {
      this.connection.close();
    }
  }

  public connect() {
    this.socket.on('connectFailed', (error) => {
      logger.error(`Replication connect error ${error.toString()}`);
      this._connected = false;
      this.bucket.status.replicationConnected = false;
      this.bucket.status.replicationStatus = error.toString();
      this._status = error.toString();
      this.reconnect();
    });

    this.socket.on('connect', (connection) => {
      logger.info(`Replication connected for ${this.bucket.key} to ${this.uri}`);
      this.bucket.status.replicationConnected = true;
      this.bucket.status.replicationStatus = `connected to ${this.uri}`;
      this._status = `connected to ${this.uri}`;
      this._connected = true;
      this.connection = connection;
      connection.sendUTF(JSON.stringify({
        msg: 'register-replication-client',
        apiKey: this.bucket.config.apiKey,
        events: [{ bucket: this.bucket.key, key: '*' }],
      }));

      connection.on('error', (error) => {
        logger.error(`ws client error ${error}`);
      });

      connection.on('close', () => {
        this.bucket.status.replicationConnected = false;
        this.bucket.status.replicationStatus = `disconnected - ${this.uri}`;
        logger.warn('ws client closed');
        this._connected = false;
        this._status = 'closed';
        this.reconnect();
      });

      connection.on('message', (message) => {
        if (message.type === 'utf8') {
          try {
            const msg = JSON.parse(message.utf8Data);
            if ((msg) && (msg.bucket)) {
              this.callback(msg);
            } else if (msg.response?.error) {
              this.bucket.status.replicationStatus = msg.response.error;
            }
          } catch (err) {
            logger.error(`Replication client failed to receive message: ${message}`);
          }
        }
      });
    });
    this.tryConnect();
  }

  // socket.connect() throws synchronously for a malformed/relative URI, which the
  // 'connectFailed' handler does not catch. Treat that like any other connect
  // failure (log + schedule reconnect) so one bad bucket URI can't crash the server.
  private tryConnect() {
    try {
      this.socket.connect(this.uri);
    } catch (err) {
      const message = (err instanceof Error) ? err.message : String(err);
      logger.error(`Replication connect error for ${this.bucket.key}: ${message}`);
      this._connected = false;
      this.bucket.status.replicationConnected = false;
      this.bucket.status.replicationStatus = message;
      this._status = message;
      this.reconnect();
    }
  }

  private reconnect() {
    if (!this.doReconnect) {
      logger.debug('Skip reconnect');
      return;
    }
    logger.info('reconnecting in 5000ms');
    setTimeout(() => { this.tryConnect(); }, reconnectDelay);
  }
}

export function initReplicationClients(buckets, datastore: DataStore) {
  for (let i = 0; i < buckets.length; i += 1) {
    if ((buckets[i].config.replication === true) && (!buckets[i].config.disabled)) {
      const client = clients.get(buckets[i].key);
      if (client) {
        if (buckets[i].config.replicationURI === client.uri) continue;
        killWebSocket(buckets[i].key);
      }
      setupWebSocket(`${buckets[i].config.replicationURI}?id=${getDeviceId()}`, buckets[i], (replObj) => {
        datastore.receiveReplicationMessage(replObj);
      });
    } else {
      killWebSocket(buckets[i].key);
    }
  }
}

function disconnectIfOpen(key: string) {
  const client = clients.get(key);
  if (client) {
    client.disconnect();
  }
}

function setupWebSocket(uri, bucket: IBucket, callback) {
  disconnectIfOpen(bucket.key);
  const client = new ReplicationClient(uri, bucket, callback);
  clients.set(bucket.key, client);
  client.connect();
}

function killWebSocket(key: string) {
  const client = clients.get(key);
  if (!client) return;

  client.disconnect();
  clients.delete(key);
}


export function getReplicationStatus(bucket: IBucket) {
  const client = clients.get(bucket.key)
  if (!client) {
    return [false, 'disabled'];
  }
  
  return [client.connected, client.status];
}
