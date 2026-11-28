import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement, D1Result } from '../functions/_shared/d1Types';

export function createNodeSqliteD1Adapter(dbFilePath: string): D1Database {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new DatabaseSync(dbFilePath);
  sqlite.exec('PRAGMA journal_mode = WAL;');

  const buildStatement = (query: string, boundValues: unknown[] = []): D1PreparedStatement => {
    const cleanParams = boundValues.map((v) =>
      v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v
    ) as (string | number | bigint | Uint8Array | null)[];

    return {
      bind(...values: unknown[]) {
        return buildStatement(query, values);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(query);
        const row = stmt.get(...cleanParams) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) {
          return (row[colName] as T) ?? null;
        }
        return { ...row } as T;
      },
      async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(query);
        const info = stmt.run(...cleanParams);
        return {
          success: true,
          results: [],
          meta: {
            changes: Number(info.changes || 0),
            last_row_id: Number(info.lastInsertRowid || 0),
            duration: 0,
          },
        };
      },
      async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(query);
        const rows = stmt.all(...cleanParams) as Record<string, unknown>[];
        return {
          success: true,
          results: rows.map((r) => ({ ...r }) as T),
          meta: { duration: 0 },
        };
      },
    };
  };

  return {
    prepare(query: string) {
      return buildStatement(query);
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  };
}
