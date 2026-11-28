export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1Env {
  vjemmadb?: D1Database;
  DB?: D1Database;
  VJEMMADB?: D1Database;
  d1?: D1Database;
  APP_URL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  VITE_R2_UPLOAD_WORKER_URL?: string;
}

export interface PagesFunctionContext {
  request: Request;
  env: D1Env;
  params?: Record<string, string | string[]>;
}
