import { CozoDb } from 'cozo-node';
import { ICozoDb, CozoResult } from '../src/types.ts';

export class TestCozo implements ICozoDb {
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
