# dwn-cozo-store

## Why cozo 
- [COZO repo](https://github.com/cozodb/cozo) 

- [COZO tutorial](https://docs.cozodb.org/en/latest/tutorial.html)
> CozoDB is a general-purpose, transactional, relational database that uses Datalog for query, is embeddable but can also handle huge amounts of data and concurrency, and focuses on graph data and algorithms. It supports time travel and it is performant!
Cozo is open source DB and query engine that could be run on top of few storage engines. 

- In-memory, non-persistent backend
- SQLite storage backend
- RocksDB storage backend
- Sled storage backend
- TiKV distributed storage backend

It is targeted to be hight perfomance and scalable.

Also you could run wasm module on browser.

## Why cozo-store
I see a few benefits to use Cozo store for your DWNs

- nice for tests 
- TYPE SAFE and more strict 
- fast 
- could be embedded in your app

## How to use

Install package
```bash
npm i dwn-cozo-store
```

As far as few cozo implementations differ a bit. I create a small interface that make library abstract from cozo build 
`ICozoDb` is abstract interface 
`CozoClosableAdapter` is adapter that implement `ICozoDb` and could be used with any cozo implementation. Make cozo open/close on demand.

In memory example:
```ts
import { ICozoDb, CozoResult, DataStoreCozo, EventLogCozo, MessageStoreCozo, CozoClosableAdapter  } from 'dwn-cozo-store';
  const cozo = new CozoClosableAdapter();
  const dataStore = new DataStoreCozo(cozo);
  const eventLog = new EventLogCozo(cozo);
  const messageStore = new MessageStoreCozo(cozo);


```

Sqlite example:

```ts
import { ICozoDb, CozoResult, DataStoreCozo, EventLogCozo, MessageStoreCozo, CozoClosableAdapter  } from 'dwn-cozo-store';

  const cozo = new CozoClosableAdapter('sqllite', 'test.db');
  const dataStore = new DataStoreCozo(cozo);
  const eventLog = new EventLogCozo(cozo);
  const messageStore = new MessageStoreCozo(cozo);


```

Also works with Already existing cozo instance

```ts
import { ICozoDb, CozoResult, DataStoreCozo, EventLogCozo, MessageStoreCozo, CozoClosableAdapter  } from 'dwn-cozo-store';
import { CozoDb } from 'cozo-node';

const cozo = new CozoClosableAdapter(null, null,{}, new CozoDb());
const dataStore = new DataStoreCozo(cozo);
const eventLog = new EventLogCozo(cozo);
const messageStore = new MessageStoreCozo(cozo);


```

Project heavily inspired by [DWN SQL store](https://github.com/TBD54566975/dwn-sql-store) and use a lot of code borrowed from there.


## How to run tests

```bash
npm run test
```
## Cozo ERD diagram 

Se more in [docs](/docs/store-erd.md)

[![](https://mermaid.ink/img/pako:eNrtVs1uozAQfhXL57YPwDHtdhVpK1VLj0iRY08Sq2CzY7NqGnj3Dj8pAZtqD7ltOSAzf9_M2PPhE5dWAU844IMWexRFZhg9Snixcd4ibBz8qcBIYKde1T7OozZ75sU2BzaKTVVsAZm0lfGAvbw5q-EvGL_J7f5qEQtwTuzhqnl-ZnkZRhvP1oqFccEI4wPxkNe9VqMq7VW6BdwJCYGmAH-woYOTByhEIG73ZxJ_TSn225bqd4jZwz0CvVUEuUv3RdPCi6KMgj1aLIQP63G_KKbzK-Eg9bQMLMpqm2t3iOCKiirGQIwgLap1aE8bg8fJNlwU97wIk3cJhnmh9VbaPBrtx1upEVyoAydRl15bE-hoeGhz1Ytd0qyOS5rHSBtKwEI7R0jud3uynY-0RPi2NsDF6p6FP8Q6rEsNJmyKtJTOWwypFEgOMcWY58-2mrNJMyeS-UDpfx-o4LRvj1R3J14A2yDsAFs6cNfEXRjwAX7CRxNYxSJcMAdNl9lj1dVL5RBZq6feoJNFhqSzefhszTf5fJPP_0o-48-8ru_u6jp2B0nYeRkQ1uAUuwvNvaajPzgu3E--RLy9rU8LPJaw8eMrvmvaIDN0cp7zylQ_OI0du3TgN7ygTgtaJbzjtYx7ogbIeEJLJfA145lpyI7myqZHI3myE7mDG16V7ZkeLpeDtPkADV9Vfg?type=png)](https://mermaid.live/edit#pako:eNrtVs1uozAQfhXL57YPwDHtdhVpK1VLj0iRY08Sq2CzY7NqGnj3Dj8pAZtqD7ltOSAzf9_M2PPhE5dWAU844IMWexRFZhg9Snixcd4ibBz8qcBIYKde1T7OozZ75sU2BzaKTVVsAZm0lfGAvbw5q-EvGL_J7f5qEQtwTuzhqnl-ZnkZRhvP1oqFccEI4wPxkNe9VqMq7VW6BdwJCYGmAH-woYOTByhEIG73ZxJ_TSn225bqd4jZwz0CvVUEuUv3RdPCi6KMgj1aLIQP63G_KKbzK-Eg9bQMLMpqm2t3iOCKiirGQIwgLap1aE8bg8fJNlwU97wIk3cJhnmh9VbaPBrtx1upEVyoAydRl15bE-hoeGhz1Ytd0qyOS5rHSBtKwEI7R0jud3uynY-0RPi2NsDF6p6FP8Q6rEsNJmyKtJTOWwypFEgOMcWY58-2mrNJMyeS-UDpfx-o4LRvj1R3J14A2yDsAFs6cNfEXRjwAX7CRxNYxSJcMAdNl9lj1dVL5RBZq6feoJNFhqSzefhszTf5fJPP_0o-48-8ru_u6jp2B0nYeRkQ1uAUuwvNvaajPzgu3E--RLy9rU8LPJaw8eMrvmvaIDN0cp7zylQ_OI0du3TgN7ygTgtaJbzjtYx7ogbIeEJLJfA145lpyI7myqZHI3myE7mDG16V7ZkeLpeDtPkADV9Vfg)

