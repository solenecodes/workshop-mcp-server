import { mkdir, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import initSqlJs from 'sql.js';
import { z } from 'zod';
import { createContosoTickets } from '../data/contosoTickets.js';

export const ticketRecord = z.object({
  id: z.string(), title: z.string(), severity: z.enum(['low', 'medium', 'high']),
  status: z.enum(['open', 'in-progress', 'resolved']), service: z.string(),
});

export async function createBackendStore(databasePath?: string) {
  const SQL = await initSqlJs();
  let existing: Uint8Array | undefined;
  if (databasePath) {
    try { existing = await readFile(databasePath); }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  let database = existing ? new SQL.Database(existing) : new SQL.Database();
  try {
    if (!existing) {
      database.run(`CREATE TABLE tickets (id TEXT PRIMARY KEY, title TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, service TEXT NOT NULL);
        PRAGMA user_version = 4;`);
      for (const ticket of createContosoTickets()) {
        database.run('INSERT INTO tickets VALUES (?, ?, ?, ?, ?)', [ticket.id, ticket.title, ticket.severity, ticket.status, ticket.service]);
      }
      if (databasePath) {
        const published = new SQL.Database(await persistInitialDatabase(databasePath, database.export()));
        database.close();
        database = published;
      }
    }
    if (database.exec('PRAGMA user_version')[0]?.values[0]?.[0] !== 4 ||
        database.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok') {
      throw new Error('Unsupported or damaged workshop database. No replacement database was created.');
    }
    database.run('PRAGMA query_only = ON');
    function query<T>(sql: string, bindings: string[], schema: z.ZodType<T>): T[] {
      const statement = database.prepare(sql);
      try {
        statement.bind(bindings);
        const rows: unknown[] = [];
        while (statement.step()) rows.push(statement.getAsObject());
        return z.array(schema).parse(rows);
      } finally { statement.free(); }
    }
    return {
      persistent: Boolean(databasePath),
      tickets: () => query('SELECT * FROM tickets ORDER BY id', [], ticketRecord),
      ticket: (id: string) => query('SELECT * FROM tickets WHERE id = ?', [id], ticketRecord)[0],
      close: () => database.close(),
    };
  } catch (error) {
    database.close();
    throw error;
  }
}

export type BackendStore = Awaited<ReturnType<typeof createBackendStore>>;

async function persistInitialDatabase(path: string, contents: Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  const lock = `${path}.initializing`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await mkdir(lock); }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      await setTimeout(50);
      continue;
    }
    try {
      try { return await readFile(path); }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, contents, { flag: 'wx', mode: 0o600 });
        await rename(temporary, path);
        return contents;
      } finally {
        try { await unlink(temporary); }
        catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        }
      }
    } finally { await rmdir(lock); }
  }
  throw new Error('Database initialization is locked. Inspect the initializing directory; no stored data was replaced.');
}
