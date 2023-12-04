import { DwnInterfaceName, DwnMethodName, Filter, GenericMessage, MessageSort, MessageStore, MessageStoreOptions, Pagination, executeUnlessAborted } from '@tbd54566975/dwn-sdk-js';
import { CozoResult, ICozoDb } from './types.ts';
import { quote, sanitizeRecords, sanitizedValue } from './utils/sanitize.ts';
import { sha256 } from 'multiformats/hashes/sha2';
import * as block from 'multiformats/block';
import * as cbor from '@ipld/dag-cbor';

export class MessageStoreCozo implements MessageStore {
  #db: ICozoDb;
  db: any;
  constructor(cozodb: ICozoDb)  {
    this.#db = cozodb;
  }
  #Indexes = {
    'interface'            : 'String?',
    'method'               : 'String?',
    'schema'               : 'String?',
    'dataCid'              : 'String?',
    'dataSize'             : 'Int?',
    'dateCreated'          : 'String?',
    'messageTimestamp'     : 'String?',
    'dataFormat'           : 'String?',
    'isLatestBaseState'    : 'String?',
    'published'            : 'String?',
    'author'               : 'String?',
    'recordId'             : 'String?',
    'entryId'              : 'String?',
    'datePublished'        : 'String?',
    'latest'               : 'String?',
    'protocol'             : 'String?',
    'dateExpires'          : 'String?',
    'description'          : 'String?',
    'grantedTo'            : 'String?',
    'grantedBy'            : 'String?',
    'grantedFor'           : 'String?',
    'permissionsRequestId' : 'String?',
    'attester'             : 'String?',
    'protocolPath'         : 'String?',
    'recipient'            : 'String?',
    'contextId'            : 'String?',
    'parentId'             : 'String?',
    'permissionsGrantId'   : 'String?'
  };
  #columns = {
    id                  : 'Int',
    tenant              : 'String',
    messageCid          : 'String',
    encodedMessageBytes : 'Bytes',
    encodedData         : 'String?',
    ...this.#Indexes
  };
  #columnNames = Object.keys(this.#columns);

  async open(): Promise<void> {
    const existingRelations = await this.getRelations();
    if (!existingRelations.includes('message_store_sequence')) {
      await this.runOperation(`
          :create message_store_sequence {
             table: String
             =>
             counter: Int
          }`);
      await this.runQuery(`?[table,counter] <-[['message_store', 1]] :put message_store_sequence{table => counter} `);
    }
    if (!existingRelations.includes('message_store')) {
      //TODO: add dynamic indexes
      await this.runOperation(`
            :create message_store {
               id: Int
               =>
               tenant: String
               messageCid: String
               encodedMessageBytes: Bytes
               encodedData: String?
               interface: String?
               method: String?
               schema: String?
               dataCid: String?
               dataSize: Int?
               dateCreated: String?
               messageTimestamp: String?
               dataFormat: String?
               isLatestBaseState: String?
               published: String?
               author: String?
               recordId: String?
               entryId: String?
               datePublished: String?
               latest: String?
               protocol: String?
               dateExpires: String?
               description: String?
               grantedTo: String?
               grantedBy: String?
               grantedFor: String?
               permissionsRequestId: String?
               attester: String?
               protocolPath: String?
               recipient: String?
               contextId: String?
               parentId: String?
               permissionsGrantId: String?
            }`);
    }
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.#db.close();
    return Promise.resolve();
  }
  async put(tenant: string, message: GenericMessage, indexes: { [key: string]: string | boolean; }, options?: MessageStoreOptions | undefined): Promise<void> {
    options?.signal?.throwIfAborted();

    // gets the encoded data and removes it from the message
    // we remove it from the message as it would cause the `encodedMessageBytes` to be greater than the
    // maximum bytes allowed by SQL
    const getEncodedData = (message: GenericMessage): { message: GenericMessage, encodedData: string|null} => {
      let encodedData: string|null = null;
      if (message.descriptor.interface === DwnInterfaceName.Records && message.descriptor.method === DwnMethodName.Write) {
        const data = (message as any).encodedData as string|undefined;
        if(data) {
          delete (message as any).encodedData;
          encodedData = data;
        }
      }
      return { message, encodedData };
    };

    const { message: messageToProcess, encodedData} = getEncodedData(message);

    const encodedMessageBlock = await executeUnlessAborted(
      block.encode({ value: messageToProcess, codec: cbor, hasher: sha256}),
      options?.signal
    );

    const messageCid = encodedMessageBlock.cid.toString();
    const encodedMessageBytes = Buffer.from(encodedMessageBlock.bytes);
    const sanitated = sanitizeRecords(indexes, this.#Indexes);

    const names = Object.keys(sanitated).sort();



    await executeUnlessAborted(
      this.runQuery(
        `?[id, tenant, messageCid, encodedMessageBytes, encodedData, ${names.join(',')} ] <- [[$id, $tenant, $messageCid, $encodedMessageBytes, $encodedData, ${names.map(n => '$'+ n).join(',')}]] :put message_store{id => tenant, messageCid, encodedMessageBytes, encodedData, ${names.join(',')}}`,
        {
          tenant,
          messageCid,
          encodedMessageBytes,
          encodedData,
          ...sanitated
        })
      ,
      options?.signal
    );
  }
  async get(tenant: string, cid: string, options?: MessageStoreOptions | undefined): Promise<GenericMessage | undefined> {
    options?.signal?.throwIfAborted();
    const result = await executeUnlessAborted(
      this.runQuery(`?[encodedMessageBytes, encodedData] := *message_store{tenant, messageCid, encodedMessageBytes,encodedData},tenant=$tenant,messageCid=$cid :limit 1`, {
        tenant,
        cid,
      }),
      options?.signal
    );
    if (MessageStoreCozo.isEmpty(result)) {
      return undefined;
    }

    const [encodedMessageBytes, encodedData] = result.rows[0];
    return this.parseEncodedMessage(encodedMessageBytes, encodedData, options);
  }

  async query(tenant: string, filters: Filter[], messageSort?: MessageSort | undefined, pagination?: Pagination | undefined, options?: MessageStoreOptions | undefined): Promise<{ messages: GenericMessage[]; cursor?: string | undefined; }> {
    options?.signal?.throwIfAborted();
    const columnsFromSort = Object.keys(messageSort || {}).filter(k => !!this.#columns[k]);

    const columnsToSelect = ['encodedMessageBytes', 'encodedData', 'tenant','messageCid',].concat(columnsFromSort);
    const columnsToFilter = columnsToSelect.slice(0);
    const conditions = [` tenant = ${quote(tenant)}`];
    const filterConditions: string[] = [];
    const orderBy = `${this.getOrderBy(messageSort)}, messageCid`;
    if (pagination?.cursor) {
      //TODO: check direction of pagination
      conditions.push(` messageCid > ${quote(pagination.cursor)} `);
    }
    if(messageSort?.datePublished !== undefined) {
      conditions.push(` published='true' `);
    }
    filters.forEach((filter) => {
      const andConditions: string[] = [];
      Object.entries(filter).forEach(([column, value]) => {
        if(!this.#columns[column]) return;
        columnsToFilter.push(column);
        if (Array.isArray(value)) { // OneOfFilter
          andConditions.push(`${column} in [${value.map(v => quote(`${v}`, true)).join(',')}]`);
        } else if (typeof value === 'object') { // RangeFilter
          if (value.gt) {
            andConditions.push(`${column} '>' ${sanitizedValue(value.gt)}`);
          }
          if (value.gte) {
            andConditions.push(`${column} '>=' ${sanitizedValue(value.gt)}`);
          }
          if (value.lt) {
            andConditions.push(`${column} '<' ${sanitizedValue(value.gt)}`);
          }
          if (value.lte) {
            andConditions.push(`${column} '<=' ${sanitizedValue(value.gt)}`);
          }
        } else { // EqualFilter
          andConditions.push(`${column} '=' ${sanitizedValue(value.gt)}`);
        }
      });
      filterConditions.push( ` and(${andConditions.join(',')}) `);
    });
    const hasFilter = filterConditions.length > 0;
    const result = await executeUnlessAborted(
      this.runQuery(`?[${columnsToSelect.join(',')}] := *message_store{${columnsToFilter.join(',')}},
            ${conditions.join(',')}
            ${hasFilter ? `,or(${filterConditions.join(',')})` : ''}
             :order ${orderBy}
             ${pagination?.limit ? `:limit ${pagination.limit}` : ''}`
      ),
      options?.signal
    );

    if (MessageStoreCozo.isEmpty(result)) {
      return { messages: [], cursor: undefined };
    }

    // extracts the full encoded message from the stored blob for each result item.
    const messages: Promise<GenericMessage>[] = result.rows.map(([encodedMessageBytes, encodedData]) => this.parseEncodedMessage(encodedMessageBytes, encodedData, options));

    // returns the pruned the messages, since we have and additional record from above, and a potential messageCid cursor
    return this.getPaginationResults(messages,  pagination?.limit);


  }
  delete(tenant: string, cid: string, options?: MessageStoreOptions | undefined): Promise<void> {
    throw new Error('Method not implemented.');
  }
  clear(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  // private part
  // cozo utils
  private async runQuery(query: string, params?: Record<string, any>, print: boolean = false, maxRetries: number = 3) {
    let retries = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executeQuery = async (): Promise<any> => {
      try {
        const data = await this.db.run(query, params);
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
      `{?[table,counter, prev] := *message_store_sequence[table, prev],table='message_store',counter=prev+1 :put message_store_sequence{table => counter}} 
       {?[counter] := *message_store_sequence['message_store',counter]}`
    );
    return data.rows[0][0];
  }
  // Logic
  private async parseEncodedMessage(
    encodedMessageBytes: Uint8Array,
    encodedData: string | null | undefined,
    options?: MessageStoreOptions
  ): Promise<GenericMessage> {
    options?.signal?.throwIfAborted();

    const decodedBlock = await block.decode({
      bytes  : encodedMessageBytes,
      codec  : cbor,
      hasher : sha256
    });

    const message = decodedBlock.value as GenericMessage;
    // If encodedData is stored within the MessageStore we include it in the response.
    // We store encodedData when the data is below a certain threshold.
    // https://github.com/TBD54566975/dwn-sdk-js/pull/456
    if (message !== undefined && encodedData !== undefined && encodedData !== null) {
      (message as any).encodedData = encodedData;
    }
    return message;
  }
  private getOrderBy(
    messageSort?: MessageSort
  ): string {
    if(messageSort?.dateCreated !== undefined)  {
      return messageSort.dateCreated > 0 ? '': '-' + 'dateCreated';
    } else if(messageSort?.datePublished !== undefined) {
      return messageSort.datePublished > 0 ? '': '-' + 'datePublished';
    } else if (messageSort?.messageTimestamp !== undefined) {
      return messageSort.messageTimestamp > 0 ? '': '-' + 'messageTimestamp';
    } else {
      return  '-messageTimestamp';
    }
  }
  private async getPaginationResults(
    messages: Promise<GenericMessage>[], limit?: number
  ): Promise<{ messages: GenericMessage[], cursor?: string }>{
    if (limit !== undefined && messages.length > limit) {
      messages = messages.slice(0, limit);
      const lastMessage = messages.at(-1);
      return {
        messages : await Promise.all(messages),
        cursor   : lastMessage ? await Message.getCid(await lastMessage) : undefined
      };
    }

    return { messages: await Promise.all(messages) };
  }
}