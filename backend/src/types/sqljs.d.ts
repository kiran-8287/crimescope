declare module "sql.js" {
  export class Database {
    constructor(buffer?: Buffer | Uint8Array);
    execute(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[];
    close(): void;
  }
  export default Database;
}
