import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { Router } from 'express';
import { z } from 'zod';

const color = z.enum(['yellow', 'pink', 'blue', 'green', 'purple']);
const note = z.object({
  id: z.uuid(), question: z.string().trim().min(1).max(500),
  color, archived: z.boolean(), createdAt: z.iso.datetime(),
}).strict();
const board = z.array(note).max(500);
const createNote = z.object({ question: note.shape.question }).strict();
const updateNote = z.object({ color: color.optional(), archived: z.boolean().optional() })
  .strict().refine((value) => Object.keys(value).length > 0);

export function createParkingLot(path: string) {
  async function read() {
    try { return board.parse(JSON.parse(await readFile(path, 'utf8'))); }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
  }
  async function change(update: (notes: z.infer<typeof board>) => void) {
    await mkdir(dirname(path), { recursive: true });
    const lock = `${path}.lock`;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await mkdir(lock); }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
        await setTimeout(20);
        continue;
      }
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        const notes = await read();
        update(notes);
        await writeFile(temporary, JSON.stringify(board.parse(notes)), { flag: 'wx', mode: 0o600 });
        await rename(temporary, path);
        return notes;
      } finally {
        try { await unlink(temporary); }
        catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        } finally { await rmdir(lock); }
      }
    }
    throw new Error('Parking lot storage is locked. Retry shortly; inspect a stale lock before removing it.');
  }
  return { read, change };
}

export function parkingLotRouter(store: ReturnType<typeof createParkingLot>) {
  const router = Router();
  let windowStart = Date.now();
  let writes = 0;
  router.use((req, res, next) => {
    if (req.method !== 'GET') {
      if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); writes = 0; }
      if (++writes > 120) {
        res.setHeader('Retry-After', '60');
        res.status(429).json({ message: 'Shared parking lot write limit reached. Retry in one minute.' });
        return;
      }
      if (!req.is('application/json')) {
        res.status(415).json({ message: 'Send application/json.' });
        return;
      }
    }
    next();
  });
  router.get('/', async (_req, res) => { res.json({ notes: await store.read() }); });
  router.post('/', async (req, res) => {
    const parsed = createNote.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Enter a question of 1-500 characters.' }); return; }
    let full = false;
    const notes = await store.change((notes) => {
      if (notes.length >= 500) { full = true; return; }
      notes.push({ id: randomUUID(), question: parsed.data.question, color: 'yellow', archived: false, createdAt: new Date().toISOString() });
    });
    if (full) { res.status(409).json({ message: 'The board is full (500 notes). Delete notes to make room.' }); return; }
    res.status(201).json({ notes });
  });
  router.patch('/:id', async (req, res) => {
    const parsed = updateNote.safeParse(req.body);
    if (!z.uuid().safeParse(req.params.id).success || !parsed.success) {
      res.status(400).json({ message: 'Use a valid note ID and a color or archive state.' }); return;
    }
    let found = false;
    const notes = await store.change((notes) => {
      const existing = notes.find((note) => note.id === req.params.id);
      if (existing) { found = true; Object.assign(existing, parsed.data); }
    });
    if (!found) { res.status(404).json({ message: 'This note no longer exists. Refresh the board.' }); return; }
    res.json({ notes });
  });
  router.delete('/:id', async (req, res) => {
    if (!z.uuid().safeParse(req.params.id).success) {
      res.status(400).json({ message: 'Use a valid note ID.' }); return;
    }
    let found = false;
    const notes = await store.change((notes) => {
      const index = notes.findIndex((note) => note.id === req.params.id);
      if (index !== -1) { found = true; notes.splice(index, 1); }
    });
    if (!found) { res.status(404).json({ message: 'This note no longer exists. Refresh the board.' }); return; }
    res.json({ notes });
  });
  router.use((_req, res) => {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    res.status(405).json({ message: 'Use GET, POST, PATCH or DELETE for the parking lot.' });
  });
  return router;
}
