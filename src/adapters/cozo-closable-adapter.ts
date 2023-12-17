import { CozoDb } from 'cozo-node';
import { ICozoDb, CozoResult } from '../types.js';

export class CozoClosableAdapter implements ICozoDb {
  private db: CozoDb;
  private engine?: string;
  private path?: string;
  private options?: object;
  private isClosed = false;
  private isClosable = true;
  private construct(engine?: string, path?: string, options?: object) {
    if (engine && path && options && Object.keys(options).length > 0) {
      this.db = new CozoDb(engine, path, options);
    } else if (engine && path) {
      this.db = new CozoDb(engine, path);
    } else if (engine) {
      this.db = new CozoDb(engine);
    } else {
      this.db = new CozoDb();
    }
    this.isClosable = engine !== 'mem';
    this.isClosed = false;
  }

  constructor(engine?: string, path?: string, options?: object, db?: CozoDb) {
    this.engine = engine;
    this.path = path;
    this.options = options;

    if(db) {
      this.isClosable = false;
      this.db = db;
    }
    else {
      this.construct(engine, path, options);
    }
  }

  close(): void {
    if(!this.isClosable) {
      return;
    }
    this.isClosed = true;
    if(this.isClosable) {
      return this.db.close();
    }
  }
  shutdown(): void {
    return this.db.close();
  }
  open(): ICozoDb {
    if (this.isClosable && !this.isClosed) {
      return this;
    }
    if (this.isClosed) {
      this.construct(this.engine, this.path, this.options);
      return this;
    }
    return this;
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(query: string, params?: Record<string, any>): Promise<CozoResult> {
    return this.db.run(query, params) as Promise<CozoResult>;
  }
}