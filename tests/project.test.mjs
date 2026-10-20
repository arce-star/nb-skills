import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectProject } from '../skills/nbskills/scripts/core.mjs';

test('detectProject finds Next.js, TypeScript and Playwright', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nbskills-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    dependencies: { next: '^15', react: '^19' },
    devDependencies: { typescript: '^5', '@playwright/test': '^1' },
  }));
  const result = detectProject(dir);
  const queries = result.queries.map((x) => x.query);
  assert.ok(queries.includes('nextjs react performance'));
  assert.ok(queries.includes('playwright testing'));
  assert.ok(queries.includes('typescript'));
});
