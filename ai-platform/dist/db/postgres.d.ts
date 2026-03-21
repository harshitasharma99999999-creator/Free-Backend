import { Pool } from 'pg';
export declare function getPool(): Pool;
export declare function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
export declare function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null>;
