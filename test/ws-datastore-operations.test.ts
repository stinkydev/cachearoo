import { expect } from 'chai';
import { WSAPIDataStoreOperations } from '../src/api/ws/ws-datastore-operations';
import { DataStoreInMemory } from '../src/datastore/datastore-memory';
import { StoreError, ALREADY_EXISTS } from '../src/store-error';

// The socket replies a client reads: a missing key, an existing key and a failing store each
// answer with their own code.
describe('socket datastore operations', () => {
  const memory = new DataStoreInMemory();
  const bucket = { key: 'b' } as any;

  const datastore: any = {
    read: (bucketName: string, key: string) => memory.read({ key: bucketName } as any, key),
    write: async () => undefined,
    writeFailIfExists: async () => { throw new StoreError(ALREADY_EXISTS, 'Key k already exists'); },
    list: async () => { throw new Error('disk failure'); },
  };

  const run = async (request: any) => {
    const sent: any[] = [];
    const connection = { info: { reads: 0, writes: 0 }, send: (text: string) => sent.push(JSON.parse(text)) };
    let thrown = null;
    try {
      await new WSAPIDataStoreOperations(datastore).processOperation({ request: { id: '1', ...request } }, connection);
    } catch (err) {
      thrown = err;
    }
    return { response: sent[0].response, thrown };
  };

  before(async () => {
    await memory.write(bucket, 'k', { a: 1 }, null, null);
  });

  it('reads a key', async () => {
    const { response } = await run({ op: 'read', bucket: 'b', key: 'k' });
    expect(response.value).to.deep.equal({ a: 1 });
    expect(response.error).to.equal(undefined);
  });

  it('answers 404 for a missing key, and does not report it as a failure', async () => {
    const { response, thrown } = await run({ op: 'read', bucket: 'b', key: 'nope' });
    expect(response.error.code).to.equal(404);
    expect(thrown).to.equal(null);
  });

  it('answers 404 for a missing bucket', async () => {
    const { response } = await run({ op: 'read', bucket: 'none', key: 'k' });
    expect(response.error.code).to.equal(404);
  });

  it('answers 412 for an existing key, flagged for older clients', async () => {
    const { response } = await run({ op: 'write', bucket: 'b', key: 'k', value: 1, failIfExists: true });
    expect(response.error).to.include({ code: 412, alreadyExists: true });
  });

  it('answers 500 when the store fails', async () => {
    const { response, thrown } = await run({ op: 'filter', bucket: 'b' });
    expect(response.error).to.deep.equal({ code: 500, message: 'disk failure' });
    expect(thrown).to.be.instanceOf(Error);
  });

  it('answers 400 for an unknown operation', async () => {
    const { response } = await run({ op: 'nope', bucket: 'b' });
    expect(response.error.code).to.equal(400);
  });
});
