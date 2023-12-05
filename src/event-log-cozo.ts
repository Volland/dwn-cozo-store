import { Event, EventLog, GetEventsOptions } from '@tbd54566975/dwn-sdk-js';
import { CozoResult, ICozoDb } from './types.js';

export class EventLogCozo implements EventLog {
  #db: ICozoDb;
  constructor(cozodb: ICozoDb)  {
    this.#db = cozodb;
  }
  async open(): Promise<void> {
    const existingRelations = await this.getRelations();
    if (!existingRelations.includes('event_log_sequence')) {
      await this.runOperation(`
          :create event_log_sequence {
             table: String
             =>
             counter: Int
          }`);
      await this.runQuery(`?[table,counter] <-[['event_log', 1]] :put event_log_sequence{table => counter} `);
    }
    if (!existingRelations.includes('event_log')) {
      await this.runOperation(`
            :create event_log {
               id: Int
               =>
               tenant: String,
               messageCid: String
            }`);
    }
  }
  async close(): Promise<void> {
    if (this.#db.close) {
        console.debug('Closing Cozo DB');
     // this.#db.close();
    }
  }
  async append(tenant: string, messageCid: string): Promise<string> {
    const id = await this.getSequence();
    const result = await this.runQuery(`?[id, tenant, messageCid] <-[[$id, $tenant, $messageCid]] :put event_log{id  => tenant, messageCid}`, {
      tenant,
      messageCid,
      id,

    });
    if (!EventLogCozo.isSuccessful(result)) {
      throw new Error(`Failed to append event: ${messageCid}`);
    }

    return `${id}`;
  }
  async getEvents(tenant: string, options?: GetEventsOptions | undefined): Promise<Event[]> {
    let data;
    if (options && options.gt && !Number.isNaN(Number.parseInt(options.gt)) ) {
      data = await this.runQuery(`?[id,messageCid] := *event_log[id,$tenant,messageCid],id>$gt`, {
        tenant,
        gt: Number.parseInt(options.gt),
      });
    }
    data = await this.runQuery(`?[id,messageCid] := *event_log[id,$tenant,messageCid]`, {
      tenant,
    });
    if (EventLogCozo.isEmpty(data)) {
      return [];
    }
    return data.rows.map(([id , messageCid]) => ({
      watermark  : id.toString(),
      messageCid : messageCid
    }));
  }
  async  deleteEventsByCid(tenant: string, cids: string[]): Promise<number> {
    if (cids && cids.length === 0) {
      return 0;
    }

    const deleteLogCountResult = await this.runQuery(`?[count(id)] := *event_log[id,$tenant,messageCid], messageCid in ['${cids.join(',')}']`, {tenant});
    const deleteLog = await this.runQuery(`?[id] := *event_log[id,$tenant,messageCid], messageCid in ['${cids.join(',')}'] :rm event_log {id}`, {tenant});

    if (!EventLogCozo.isSuccessful(deleteLog)) {
      throw new Error(`Failed to delete events`);
    }
    return deleteLogCountResult.rows[0][0];

  }
  async clear(): Promise<void> {
    const deleteLog = await this.runQuery(`?[id] := *event_log[id,_, _] :rm event_log {id}`);
    if (!EventLogCozo.isSuccessful(deleteLog)) {
      throw new Error(`Failed to clear event log`);
    }
    return Promise.resolve();
  }
  private async runQuery(query: string, params?: Record<string, any>, print: boolean = false, maxRetries: number = 3) {
    let retries = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executeQuery = async (): Promise<any> => {
      try {
        const data = await this.#db.run(query, params);
        if (print) {
          console.debug('COZO QUERY: ', query, params);
          console.debug('COZO RESULT', data);
        }

        if (data?.ok === false) console.error('COZO ERROR', query, params, data);

        if (data.headers === undefined && data.rows === undefined) return { headers: [], rows: [] };

        return data;
      } catch (err) {
        console.error('COZO ERROR');
        console.error('Failed to run query: ', query, params);
        console.error(err);

        if (retries < maxRetries) {
          // eslint-disable-next-line no-plusplus
          retries++;
          console.debug(`Retrying query (${retries}/${maxRetries}): `, query);
          return executeQuery();
        }
        throw err;
      }
    };

    return executeQuery();
  }
  private async runOperation(query: string, params?: Record<string, any>) {
    const data = await this.runQuery(query, params);
    if (!EventLogCozo.isSuccessful(data)) {
      throw new Error(`Failed to run operation: ${query}`);
    }
  }

  private async getRelations(): Promise<string[]> {
    const data = await this.runQuery('::relations');

    // TODO: Fix for Expo Cozo
    if (data.headers === undefined || data.rows === undefined) {
      data.headers = [];
      data.rows = [];
    }

    return data.rows.map((row: string[]) => row[0]);
  }

  private static isSuccessful(data: CozoResult): boolean {
    return data.headers[0] === 'status' && data.rows[0][0] === 'OK';
  }

  private static isEmpty(data: CozoResult): boolean {
    return data.rows.length === 0;
  }
  private async getSequence(): Promise<number> {
    const data = await this.runQuery(
      `{?[table,counter, prev] := *event_log_sequence[table, prev],table='event_log',counter=prev+1 :put event_log_sequence{table => counter}} 
            {?[counter] := *event_log_sequence['event_log',counter]}`
    );
    return data.rows[0][0];
  }
}