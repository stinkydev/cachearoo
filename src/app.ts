import { Cachearoo } from './cachearoo';
const cachearoo = new Cachearoo();
cachearoo.init().catch((err) => {
  console.error('Init failed', err);
  process.exit(-1);
});
