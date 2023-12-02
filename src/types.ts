export interface ICozoDbQuery {
    run(query: string, params?: Record<string, any>): Promise<CozoResult>;
}
export interface ICozoDb extends ICozoDbQuery {
    close?(): void;
    importRelations?(data: object): Promise<any>;
    exportRelations?(relations: string[]): Promise<any>;
}
export interface CozoResult {
    headers: string[]
    rows: any[][]
    ok?: boolean
  }
