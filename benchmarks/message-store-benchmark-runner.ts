import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { CozoClosableAdapter } from '../src/adapters/cozo-closable-adapter.js';
import { MessageStoreCozo } from '../src/message-store-cozo.js';
import { runMessageStoreBenchmark } from './message-store-benchmark.js';

const { MessageStoreLevel } = require('@tbd54566975/dwn-sdk-js/dist/esm/src/store/message-store-level.js');

const rocksdb = new CozoClosableAdapter('rocksdb', './rocksdb');
const results = {};

const rocksMessageStore = new MessageStoreCozo(rocksdb);
const rocksResults = await runMessageStoreBenchmark(rocksMessageStore);
results['rocksdb'] = rocksResults;
const mem = new CozoClosableAdapter('mem');
const memMessageStore = new MessageStoreCozo(mem);
const memResults = await runMessageStoreBenchmark(memMessageStore);
results['mem'] = memResults;
const sqliteCozo = new CozoClosableAdapter('sqlite', './test.db');
const sqliteMessageStore = new MessageStoreCozo(sqliteCozo);
const sqliteResults = await runMessageStoreBenchmark(sqliteMessageStore);
results['sqlite'] = sqliteResults;

const messageStore = new MessageStoreLevel({
  blockstoreLocation : 'BENCHMARK-BLOCK',
  indexLocation      : 'BENCHMARK-INDEX',
});
const levelResults = await runMessageStoreBenchmark(messageStore);
results['level'] = levelResults;

console.log(JSON.stringify(results, null, 2));



