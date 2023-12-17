import { EventLog, Filter, GetEventsOptions } from '@tbd54566975/dwn-sdk-js';
import { CozoResult, ICozoDb } from './types.js';
import { quote, sanitizeRecords, sanitizedValue, wrapStrings } from './utils/sanitize.js';

export class EventLogCozo implements EventLog {
  #db: ICozoDb;
  #Indexers =  {
    interface            : 'String?',
    method               : 'String?',
    schema               : 'String?',
    dataCid              : 'String?',
    dataSize             : 'Int?',
    dateCreated          : 'String?',
    messageTimestamp     : 'String?',
    dataFormat           : 'String?',
    isLatestBaseState    : 'String?',
    published            : 'String?',
    author               : 'String?',
    recordId             : 'String?',
    entryId              : 'String?',
    datePublished        : 'String?',
    latest               : 'String?',
    protocol             : 'String?',
    dateExpires          : 'String?',
    description          : 'String?',
    grantedTo            : 'String?',
    grantedBy            : 'String?',
    grantedFor           : 'String?',
    permissionsRequestId : 'String?',
    attester             : 'String?',
    protocolPath         : 'String?',
    recipient            : 'String?',
    contextId            : 'String?',
    parentId             : 'String?',
    permissionsGrantId   : 'String?',
  };
  #columns = {
    watermark            : 'Int',
    tenant               : 'String',
    messageCid           : 'String',
    interface            : 'String?',
    method               : 'String?',
    schema               : 'String?',
    dataCid              : 'String?',
    dataSize             : 'Int?',
    dateCreated          : 'String?',
    messageTimestamp     : 'String?',
    dataFormat           : 'String?',
    isLatestBaseState    : 'String?',
    published            : 'String?',
    author               : 'String?',
    recordId             : 'String?',
    entryId              : 'String?',
    datePublished        : 'String?',
    latest               : 'String?',
    protocol             : 'String?',
    dateExpires          : 'String?',
    description          : 'String?',
    grantedTo            : 'String?',
    grantedBy            : 'String?',
    grantedFor           : 'String?',
    permissionsRequestId : 'String?',
    attester             : 'String?',
    protocolPath         : 'String?',
    recipient            : 'String?',
    contextId            : 'String?',
    parentId             : 'String?',
    permissionsGrantId   : 'String?',
  };
  #indexColumnNames = Object.keys(this.#Indexers);
  #isClosed = false;

  constructor(cozodb: ICozoDb)  {
    this.#db = cozodb;
  }


  async open(): Promise<void> {
    if (this.#isClosed && this.#db.open) {
      this.#db = this.#db.open();
      this.#isClosed = false;
    }
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
              watermark: Int
               =>
               tenant: String,
               messageCid: String,
               interface: String?,
               method: String?,
               schema: String?,
               dataCid: String?,
               dataSize: Int?,
               dateCreated: String?,
               messageTimestamp: String?,
               dataFormat: String?,
               isLatestBaseState: String?,
               published: String?,
               author: String?,
               recordId: String?,
               entryId: String?,
               datePublished: String?,
               latest: String?,
               protocol: String?,
               dateExpires: String?,
               description: String?,
               grantedTo: String?,
               grantedBy: String?,
               grantedFor: String?,
               permissionsRequestId: String?,
               attester: String?,
               protocolPath: String?,
               recipient: String?,
               contextId: String?,
               parentId: String?,
               permissionsGrantId: String?
            }`);
    }
  }
  async close(): Promise<void> {
    if(this.#isClosed) {
      return Promise.resolve();
    }
    if (this.#db && this.#db.close) {
      console.debug('Closing Cozo DB');
      this.#db?.close();
    }
    this.#isClosed = true;
    return Promise.resolve();
  }
  async append(tenant: string, messageCid: string,  indexes: Record<string, string | boolean | number>): Promise<void> {
    const watermark = await this.getSequence();

    const sanitated = sanitizeRecords(indexes, this.#Indexers);
    this.#indexColumnNames.forEach((index) => {
      if (sanitated[index] === undefined) {
        sanitated[index] = null;
      }
    });
    const names = Object.keys(sanitated).sort();
    const result = await this.runQuery(`?[watermark, tenant, messageCid,${names.join(',')}] <-[[$watermark, $tenant, $messageCid, ${names.map(n => '$'+ n).join(',')}]] :put event_log{watermark  => tenant, messageCid,  ${names.join(',')} }`,
      {
        tenant,
        messageCid,
        watermark,
        ...sanitated
      });
    if (!EventLogCozo.isSuccessful(result)) {
      throw new Error(`Failed to append event: ${messageCid}`);
    }

    return;
  }
  async getEvents(tenant: string, options?: GetEventsOptions | undefined): Promise<string[]> {
    return this.queryEvents(tenant, [], options?.cursor);
  }
  async  queryEvents(tenant: string, filters: Filter[], cursor?: string): Promise<string[]> {

    const columnsToSelect = ['messageCid', 'watermark'];
    const columnsToFilter = columnsToSelect.slice(0);
    columnsToFilter.push('tenant');
    const conditions = [` tenant = ${quote(tenant)}`];
    const filterConditions: string[] = [];

    if (cursor) {
      const waterMarkResult = await this.runQuery(
        `?[watermark]:= *event_log{watermark, tenant, messageCid},tenant=$tenant,messageCid=$cursor :limit 1`,
        {
          cursor,
          tenant
        }
      );
      if (!EventLogCozo.isEmpty(waterMarkResult)) {
        const watermark = waterMarkResult.rows[0][0];
        conditions.push( `watermark > ${watermark}`);
      }

    }
    if (Object.keys(filters).length > 0) {
      filters.forEach((filter) => {
        const andConditions: string[] = [];
        Object.entries(filter).forEach(([column, value]) => {
          if(!this.#columns[column]) {
            return;
          }
          columnsToFilter.push(column);
          if (Array.isArray(value)) { // OneOfFilter
            andConditions.push(`${column} in [${value.map(v => quote(`${v}`, true)).join(',')}]`);
          } else if (typeof value === 'object') { // RangeFilter
            if (value.gt) {
              andConditions.push(`!is_null(${column}),${column} > ${wrapStrings(sanitizedValue(value.gt))}`);
            }
            if (value.gte) {
              andConditions.push(`!is_null(${column}), ${column} >= ${wrapStrings(sanitizedValue(value.gte))}`);
            }
            if (value.lt) {
              andConditions.push(`!is_null(${column}), ${column} < ${wrapStrings(sanitizedValue(value.lt))}`);
            }
            if (value.lte) {
              andConditions.push(`!is_null(${column}), ${column} <= ${wrapStrings(sanitizedValue(value.lte))}`);
            }
          } else { // EqualFilter
            andConditions.push(`!is_null(${column}), ${column} == ${wrapStrings(sanitizedValue(value))}`);
          }
        });
        filterConditions.push( ` and( ${andConditions.join(',')} ) `);
      });
    }
    const hasFilter = filterConditions.length > 0;
    const query = `?[${columnsToSelect.join(',')}] := *event_log{${columnsToFilter.join(',')}},
  ${conditions.join(',')}
  ${hasFilter ? `, (${filterConditions.join(' or ')} )` : ''}
  :order watermark
  `;
    const result = await this.runQuery(query);
    return result.rows.map(([id]) => id);

  }

  async  deleteEventsByCid(tenant: string, messageCids: string[]): Promise<void> {
    if (messageCids && messageCids.length === 0) {
      return;
    }

    const deleteLog = await this.runQuery(`?[watermark] := *event_log{watermark,tenant,messageCid},tenant=$tenant, messageCid in ['${messageCids.join('\',\'')}'] :rm event_log {watermark}`,
      {tenant});

    if (!EventLogCozo.isSuccessful(deleteLog)) {
      throw new Error(`Failed to delete events`);
    }
    return;

  }
  async clear(): Promise<void> {
    const deleteLog = await this.runQuery(`?[watermark] := *event_log{watermark} :rm event_log {watermark}`);
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