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
As far as few cozo implementations differ a bit. I create a small interface that make library abstract from cozo build 
You need to implement this interface for your cozo build and pass it to the store. 

In memory example:
```ts
import { CozoDb } from 'cozo-node';
import { ICozoDb, CozoResult } from '../src/types.js';

export class InMemoryCozo implements ICozoDb {
  private db: CozoDb;

  constructor(db?: CozoDb) {
    this.db = db || new CozoDb('mem');
  }

  close(): void {
    return this.db.close();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(query: string, params?: Record<string, any>): Promise<CozoResult> {
    return this.db.run(query, params) as Promise<CozoResult>;
  }
}

  const cozo = new InMemoryCozo();
  const dataStore = new DataStoreCozo(cozo);
  const eventLog = new EventLogCozo(cozo);
  const messageStore = new MessageStoreCozo(cozo);


```

Sqlite example:
Project heavily inspired by [DWN SQL store](https://github.com/TBD54566975/dwn-sql-store) and use a lot of code borrowed from there.

## Store Entity Relation Diagram

```mermaid
erDiagram
    data_store_sequence {
        string table 
        number counter
    }
      event_log_sequence {
        string table 
        number counter
    }
      message_store_sequence {
        string table 
        number counter
    }
    event_log {
        int Id 
        string tenant
        string messageCid
    }
    data_store {
        int id 
        string tenant
        string dataCid
        bytes data
    }
    data_store_references {
        int id 
        string tenant
        string dataCid
        string messageCid
    }
    message_store {
        id id
        String tenant
        String messageCid
        Bytes encodedMessageBytes
        String encodedData
        String interface
        String method
        String schema
        String dataCid
        Int   dataSize
        String dateCreated
        String messageTimestamp
        String dataFormat
        String isLatestBaseState
        String published
        String author
        String recordId
        String entryId 
        String datePublished
        String latest
        String protocol
        String dateExpires
        String description
        String grantedTo
        String grantedBy
        String grantedFor
        String permissionsRequestId
        String attester
        String protocolPath
        String recipient
        String contextId
        String parentId
        String permissionsGrantId
    }
    event_log ||..|| event_log_sequence : sequence
    data_store ||..|| data_store_sequence : sequence
    message_store ||..|| message_store_sequence : sequence
    data_store ||--|{ data_store_references : references
    data_store_references }|--|| message_store : messageCid
    message_store }|--|| event_log : messageCid
```
