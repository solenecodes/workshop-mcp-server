import { mkdir, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import initSqlJs from 'sql.js';
import { z } from 'zod';
import { createDemoData } from '../data/demoData.js';

export const customerRecord = z.object({
  customerId: z.string(), customerName: z.string(), dateOfBirth: z.string(), address: z.string(),
});
export const policyRecord = z.object({
  policyId: z.string(), customerId: z.string(), coverage: z.string(), coverageLimit: z.number(),
});
export const claimRecord = z.object({
  claimId: z.string(), customerId: z.string(), policyId: z.string(), amount: z.number(),
  currency: z.literal('EUR'), status: z.enum(['open', 'escalated']),
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
      database.run(`CREATE TABLE customers (customerId TEXT PRIMARY KEY, customerName TEXT NOT NULL, dateOfBirth TEXT NOT NULL, address TEXT NOT NULL);
        CREATE TABLE policies (policyId TEXT PRIMARY KEY, customerId TEXT NOT NULL REFERENCES customers, coverage TEXT NOT NULL, coverageLimit REAL NOT NULL);
        CREATE TABLE claims (claimId TEXT PRIMARY KEY, customerId TEXT NOT NULL REFERENCES customers, policyId TEXT NOT NULL REFERENCES policies, amount REAL NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, documents TEXT NOT NULL);
        PRAGMA user_version = 1;`);
      const data = createDemoData();
      for (const claim of data.claims.values()) {
        database.run('INSERT INTO customers VALUES (?, ?, ?, ?)', [claim.policyholderId, claim.customerName, claim.dateOfBirth, claim.address]);
      }
      for (const policy of data.policies.values()) {
        database.run('INSERT INTO policies VALUES (?, ?, ?, ?)', [policy.policyId, policy.policyholderId, policy.coverage, policy.limit]);
      }
      for (const claim of data.claims.values()) {
        database.run('INSERT INTO claims VALUES (?, ?, ?, ?, ?, ?, ?)', [claim.claimId, claim.policyholderId, claim.policyId, claim.claimAmount, claim.currency, claim.status, JSON.stringify(claim.documents)]);
      }
      if (databasePath) {
        const published = new SQL.Database(await persistInitialDatabase(databasePath, database.export()));
        database.close();
        database = published;
      }
    }
    if (database.exec('PRAGMA user_version')[0]?.values[0]?.[0] !== 1 ||
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
      customers: () => query('SELECT * FROM customers ORDER BY customerId', [], customerRecord),
      customer: (id: string) => query('SELECT * FROM customers WHERE customerId = ?', [id], customerRecord)[0],
      policies: () => query('SELECT * FROM policies ORDER BY policyId', [], policyRecord),
      policy: (id: string) => query('SELECT * FROM policies WHERE policyId = ?', [id], policyRecord)[0],
      claims: () => query('SELECT * FROM claims ORDER BY claimId', [], claimRecord),
      claim: (id: string) => query('SELECT * FROM claims WHERE claimId = ?', [id], claimRecord)[0],
      documents: (id: string) => {
        const row = query('SELECT documents FROM claims WHERE claimId = ?', [id], z.object({ documents: z.string() }))[0];
        return row ? z.array(z.string()).parse(JSON.parse(row.documents)) : undefined;
      },
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
