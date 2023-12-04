import { TestSuite } from '@tbd54566975/dwn-sdk-js/tests';


// Remove when we Node.js v18 is no longer supported by this project.
// Node.js v18 maintenance begins 2023-10-18 and is EoL 2025-04-30: https://github.com/nodejs/release#release-schedule
import { webcrypto } from 'node:crypto';
import { DataStoreCozo } from '../src/data-store-cozo.ts';
import { EventLogCozo } from '../src/event-log-cozo.ts';
import { MessageStoreCozo } from '../src/message-store-cozo.ts';
import { TestCozo } from './test-cozo.ts';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

describe('Cozo Store Test Suite', () => {
  const cozo = new TestCozo();
  const dataStore = new DataStoreCozo(cozo);
  const eventLog = new EventLogCozo(cozo);
  const messageStore = new MessageStoreCozo(cozo);
  TestSuite.runStoreDependentTests({
    messageStore,
    dataStore,
    eventLog
  });
});