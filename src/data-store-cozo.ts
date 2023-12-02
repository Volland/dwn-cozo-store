import { AssociateResult, DataStore, GetResult, PutResult } from "@tbd54566975/dwn-sdk-js";

export class DataStoreCozo implements DataStore {
    #db: ICozoDb;

    constructor(cozodb: ICozoDb  { 
        this.cozodb = cozodb;
    }
    open(): Promise<void> {
       if (this.#db) {
           return
       }


    }
    close(): Promise<void> {
        return this.cozodb.close()
    }
    put(tenant: string, messageCid: string, dataCid: string, dataStream: Readable): Promise<PutResult> {
        throw new Error("Method not implemented.")
    }
    get(tenant: string, messageCid: string, dataCid: string): Promise<GetResult | undefined> {
        throw new Error("Method not implemented.")
    }
    associate(tenant: string, messageCid: string, dataCid: string): Promise<AssociateResult | undefined> {
        throw new Error("Method not implemented.")
    }
    delete(tenant: string, messageCid: string, dataCid: string): Promise<void> {
        throw new Error("Method not implemented.")
    }
    clear(): Promise<void> {
        throw new Error("Method not implemented.")
    }
     private async runQuery(query: string, params?: Record<string, any>, print: boolean = false, maxRetries: number = 3) {
        let retries = 0
    
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const executeQuery = async (): Promise<any> => {
          try {
            const data = await this.db.run(query, params)
            if (print) {
              console.debug('COZO QUERY: ', query, params)
              console.debug('COZO RESULT', data)
            }
    
            if (data?.ok === false) console.error('COZO ERROR', query, params, data)
    
            if (data.headers === undefined && data.rows === undefined) return { headers: [], rows: [] }
    
            return data
          } catch (err) {
            console.error('COZO ERROR')
            console.error('Failed to run query: ', query, params)
            console.error(err)
    
            if (retries < maxRetries) {
              // eslint-disable-next-line no-plusplus
              retries++
              console.debug(`Retrying query (${retries}/${maxRetries}): `, query)
              return executeQuery()
            }
            throw err
          }
        }
    
        return executeQuery()
      }
    
      private async getRelations(): Promise<string[]> {
        const data = await this.runQuery('::relations')
    
        // TODO: Fix for Expo Cozo
        if (data.headers === undefined || data.rows === undefined) {
          data.headers = []
          data.rows = []
        }
    
        return data.rows.map((row: string[]) => row[0])
      }
    
      private static isSuccessful(data: CozoResult): boolean {
        return data.headers[0] === 'status' && data.rows[0][0] === 'OK'
      }
    
      private static isEmpty(data: CozoResult): boolean {
        return data.rows.length === 0
      }
    
}