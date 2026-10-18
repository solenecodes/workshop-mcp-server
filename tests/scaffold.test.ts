import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('both workshop servers have explicit entry points', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts['start:insecure'], /src\/insecure\/server.ts/);
  assert.match(pkg.scripts['start:secure'], /src\/secure\/server.ts/);
});
