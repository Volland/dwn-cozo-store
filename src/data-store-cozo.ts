import { AssociateResult, Cid, DataStore, DataStream, GetResult, PutResult } from '@tbd54566975/dwn-sdk-js';
import { ICozoDb, CozoResult } from './types.js';
import { Readable } from 'readable-stream';

export class DataStoreCozo implements DataStore {
  #db: ICozoDb;
  #relationNames = {
    dataStore           : 'data_store',
    dataStoreReferences : 'data_store_references',
    dataStoreSequence   : 'data_store_sequence',

  };
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
    if (!existingRelations.includes(this.#relationNames.dataStoreSequence)) {
      await this.runOperation(`
          :create data_store_sequence {
             table: String
             =>
             counter: Int
          }`);
      await this.runQuery(`?[table,counter] <-[['data_store', 1]] :put data_store_sequence{table => counter} `);
      await this.runQuery(`?[table,counter] <-[['data_store_references', 1]] :put data_store_sequence{table => counter} `);
    }
    if (!existingRelations.includes(this.#relationNames.dataStore)) {
      await this.runOperation(`
            :create data_store {
               id: Int
               =>
               tenant: String,
               dataCid: String,
               data: Bytes
            }`);
    }
    if (!existingRelations.includes(this.#relationNames.dataStoreReferences)) {
      await this.runOperation(`
            :create data_store_references {
               id: Int
               =>
               tenant: String,
               dataCid: String,
               messageCid: String
            }`);
    }

  }

  close(): Promise<void> {
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
  async put(tenant: string, messageCid: string, dataCid: string, dataStream: Readable): Promise<PutResult> {
    const data = await DataStream.toBytes(dataStream);
    const id = await this.getSequence(this.#relationNames.dataStore);
    const resultDataStore = await this.runQuery(`?[id, tenant, dataCid, data] <-[[$id, $tenant,$dataCid, $data]] :put data_store {id,tenant, dataCid, data }`, {
      id,
      tenant,
      dataCid,
      data
    });
    if (!DataStoreCozo.isSuccessful(resultDataStore)) {
      throw new Error(`Failed to put data: ${dataCid}`);
    }
    const resultDataStoreReferences = await this.runQuery(`?[id, tenant, dataCid, messageCid] <-[[$id, $tenant,$dataCid, $messageCid]] :put data_store_references {id,tenant, dataCid, messageCid }`, {
      id,
      tenant,
      dataCid,
      messageCid
    });
    if (!DataStoreCozo.isSuccessful(resultDataStoreReferences)) {
      throw new Error(`Failed to put data: ${dataCid}`);
    }
    return {
      dataCid  : await Cid.computeDagPbCidFromBytes(data),
      dataSize : data.length
    };

  }
  async get(tenant: string, messageCid: string, dataCid: string): Promise<GetResult | undefined> {
    console.debug('get', tenant, messageCid, dataCid);
    const hasReferenceResult = await this.runQuery(`?[id] := *data_store_references[id,$tenant, $dataCid, $messageCid] :limit 1`, {
      tenant,
      dataCid,
      messageCid
    });
    const hasResult = !DataStoreCozo.isEmpty(hasReferenceResult);
    if (!hasResult) {
      return undefined;
    }
    const result = await this.runQuery(`?[dataCid,data] := *data_store[id,tenant, dataCid, data],tenant=$tenant,dataCid=$dataCid :limit 1`, {
      tenant,
      dataCid,
    });
    if (DataStoreCozo.isEmpty(result)) {
      return undefined;
    }
    const [_dataCid, data] = result.rows[0];
    const resultData = {
      dataCid    : _dataCid,
      dataSize   : data.length,
      dataStream : new Readable({
        read() {
          this.push(data);
          this.push(null);
        }
      }),
    };
    return resultData ;

  }
  async associate(tenant: string, messageCid: string, dataCid: string): Promise<AssociateResult | undefined> {
    const hasDataResult = await this.runQuery(`?[id, length] := *data_store[id,tenant, dataCid, data],tenant=$tenant,dataCid=$dataCid,length=length(data) :limit 1`, {
      tenant,
      dataCid,
    });
    const hasdataRecord = !DataStoreCozo.isEmpty(hasDataResult);
    if (!hasdataRecord) {
      return undefined;
    }
    const hasReferenceResult = await this.runQuery(`?[id] := *data_store_references[id,$tenant, $dataCid, $messageCid] :limit 1`, {
      tenant,
      dataCid,
      messageCid
    });
    const hasReferenceRecord = !DataStoreCozo.isEmpty(hasReferenceResult);
    if (!hasReferenceRecord) {
      await this.runQuery(`?[id, tenant, dataCid, messageCid] <-[[$id, $tenant,$dataCid, $messageCid]] :put data_store_references {id => tenant, dataCid, messageCid }`, {
        id: await this.getSequence(this.#relationNames.dataStoreReferences),
        tenant,
        dataCid,
        messageCid
      });
    }
    return {
      dataCid  : dataCid,
      dataSize : hasDataResult.rows[0][1]
    };



  }
  async delete(tenant: string, messageCid: string, dataCid: string): Promise<void> {
    const deleteReference = await this.runQuery(`?[id] := *data_store_references[id,$tenant, $dataCid, $messageCid] :rm data_store_references {id}`, {
      tenant,
      dataCid,
      messageCid
    });
    if (!DataStoreCozo.isSuccessful(deleteReference)) {
      throw new Error(`Failed to delete data: ${dataCid}`);
    }

    const hasReferenceResult  = await this.runQuery(`?[id] := *data_store_references[id,$tenant, $dataCid, _] :limit 1`,
      {
        tenant,
        dataCid,
      });
    const wasLastReference = DataStoreCozo.isEmpty(hasReferenceResult);

    if(wasLastReference) {
      const deleteDataResult = await this.runQuery(`?[id] := *data_store[id,tenant, dataCid, _],tenant=$tenant,dataCid=$dataCid :rm data_store {id}`, {
        tenant,
        dataCid,
      });
      if (!DataStoreCozo.isSuccessful(deleteDataResult)) {
        throw new Error(`Failed to delete data: ${dataCid}`);
      }
    }
  }
  async clear(): Promise<void> {
    const deleteReference = await this.runQuery(`?[id] := *data_store_references[id,_, _, _] :rm data_store_references {id}`);
    if (!DataStoreCozo.isSuccessful(deleteReference)) {
      throw new Error(`Failed to delete data`);
    }
    const deleteDataResult = await this.runQuery(`?[id] := *data_store[id,_, _, _] :rm data_store {id}`);

    if (!DataStoreCozo.isSuccessful(deleteDataResult)) {
      throw new Error(`Failed to delete data`);
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
    if (!DataStoreCozo.isSuccessful(data)) {
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
  private async getSequence(table: string): Promise<number> {
    const data = await this.runQuery(
      `{?[table,counter, prev] := *data_store_sequence[table, prev],table=$table,counter=prev+1 :put data_store_sequence{table => counter}} 
            {?[counter] := *data_store_sequence[$table,counter]}`,
      {table});
    return data.rows[0][0];
  }

}