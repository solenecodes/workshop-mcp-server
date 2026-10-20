import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createParkingLot } from '../src/sandbox/parking-lot.js';
import { createSandboxApp } from '../src/sandbox/server.js';
import { createSources, startInternalApi } from '../src/sandbox/sources.js';

test('parking lot serializes concurrent writers and survives new store instances', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'parking-lot-'));
  try {
    const path = join(directory, 'board.json');
    const stores = [createParkingLot(path), createParkingLot(path)];
    await Promise.all(Array.from({ length: 12 }, (_, index) => stores[index % 2]!.change((notes) => {
      notes.push({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        question: `Question ${index}`, color: 'yellow', archived: false, createdAt: new Date().toISOString(),
      });
    })));
    assert.equal((await createParkingLot(path).read()).length, 12);
    const before = await readFile(path, 'utf8');
    await assert.rejects(stores[0]!.change(() => { throw new Error('Failed update'); }), /Failed update/);
    assert.equal(await readFile(path, 'utf8'), before);
    await writeFile(path, 'damaged data');
    await assert.rejects(createParkingLot(path).read(), SyntaxError);
    await assert.rejects(createParkingLot(path).change(() => {}), SyntaxError);
    assert.equal(await readFile(path, 'utf8'), 'damaged data');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('shared HTTP board adds, recolors, archives, restores and deletes with exact-origin CORS', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'parking-lot-http-'));
  const internal = await startInternalApi();
  const sources = await createSources(internal.url);
  let server: Server | undefined;
  try {
    const origin = 'http://127.0.0.1:4173';
    const path = join(directory, 'board.json');
    const app = createSandboxApp({ sources, consoleOrigin: origin, parkingLot: createParkingLot(path), log: () => {} });
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/parking-lot`;
    const send = (method: string, body?: unknown, suffix = '', requestOrigin = origin) => fetch(url + suffix, {
      method, headers: { Origin: requestOrigin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const preflight = await fetch(url, { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type',
    } });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-methods')!, /PATCH/);
    assert.equal((await send('GET', undefined, '', 'https://unapproved.example')).status, 403);
    assert.equal((await send('POST', { question: '  ' })).status, 400);
    assert.equal((await send('POST', { question: 'x'.repeat(501) })).status, 400);
    const created = await send('POST', { question: '  <img src=x onerror=alert(1)>  ' });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('access-control-allow-origin'), origin);
    const { notes } = await created.json();
    const id = notes[0].id;
    assert.equal(notes[0].question, '<img src=x onerror=alert(1)>');
    assert.equal((await (await send('GET')).json()).notes.length, 1, 'another client sees the question');
    assert.equal((await send('PATCH', { color: 'red' }, `/${id}`)).status, 400);
    assert.equal((await send('PATCH', { question: 'change text' }, `/${id}`)).status, 400);
    const recolored = await (await send('PATCH', { color: 'pink' }, `/${id}`)).json();
    assert.equal(recolored.notes[0].color, 'pink');
    const archived = await (await send('PATCH', { archived: true }, `/${id}`)).json();
    assert.equal(archived.notes[0].archived, true);
    assert.equal((await createParkingLot(path).read())[0]!.archived, true);
    const restored = await (await send('PATCH', { archived: false }, `/${id}`)).json();
    assert.equal(restored.notes[0].archived, false);
    assert.equal((await send('DELETE', {}, '/not-an-id')).status, 400);
    assert.equal((await (await send('DELETE', {}, `/${id}`)).json()).notes.length, 0);
    assert.equal((await send('PATCH', { archived: true }, `/${id}`)).status, 404);
    assert.equal((await send('DELETE', {}, `/${id}`)).status, 404);
    assert.equal((await send('POST', undefined)).status, 415);
    assert.equal((await send('POST', { question: 'x', extra: 'not allowed' })).status, 400);
    assert.equal((await send('GET', undefined, '', origin)).headers.get('cache-control'), 'no-store');
    await t.test('20 simultaneous participants see all questions and do not overwrite each other', async () => {
      const questions = Array.from({ length: 20 }, (_, index) => `Participant ${index + 1}`);
      const created = await Promise.all(questions.map((question) => send('POST', { question })));
      assert.ok(created.every((response) => response.status === 201));
      const snapshots = await Promise.all(Array.from({ length: 20 }, async () => (await (await send('GET')).json()).notes));
      const expected = await createParkingLot(path).read();
      assert.equal(expected.length, 20);
      assert.equal(new Set(expected.map((note) => note.id)).size, 20);
      assert.deepEqual(expected.map((note) => note.question).sort(), [...questions].sort());
      for (const snapshot of snapshots) assert.deepEqual(snapshot, expected);
      const recolored = await Promise.all(expected.map((note) => send('PATCH', { color: 'purple' }, `/${note.id}`)));
      assert.ok(recolored.every((response) => response.status === 200));
      const archived = await Promise.all(expected.map((note) => send('PATCH', { archived: true }, `/${note.id}`)));
      assert.ok(archived.every((response) => response.status === 200));
      const saved = await createParkingLot(path).read();
      assert.equal(saved.length, 20);
      assert.ok(saved.every((note) => note.color === 'purple' && note.archived));
      const deleted = await Promise.all(expected.map((note) => send('DELETE', {}, `/${note.id}`)));
      assert.ok(deleted.every((response) => response.status === 200));
      assert.deepEqual(await createParkingLot(path).read(), []);
    });
  } finally {
    server?.closeAllConnections();
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    sources.close();
    await internal.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('parking lot reports shared write capacity and never silently replaces corrupt storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'parking-lot-capacity-'));
  const internal = await startInternalApi();
  const sources = await createSources(internal.url);
  let server: Server | undefined;
  try {
    const path = join(directory, 'board.json');
    await writeFile(path, '{broken');
    const app = createSandboxApp({ sources, parkingLot: createParkingLot(path), log: () => {} });
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/parking-lot`;
    assert.equal((await fetch(url)).status, 500);
    assert.equal(await readFile(path, 'utf8'), '{broken');
    for (let i = 0; i < 120; i++) {
      assert.equal((await fetch(url, { method: 'POST' })).status, 415);
    }
    const limited = await fetch(url, { method: 'POST' });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
  } finally {
    server?.closeAllConnections();
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    sources.close();
    await internal.close();
    await rm(directory, { recursive: true, force: true });
  }
});
