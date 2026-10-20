#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './core.mjs';

const root = path.resolve(process.argv[2] || '.');
const file = path.join(root, 'SKILL.md');
const errors = [];

if (!fs.existsSync(file)) errors.push('SKILL.md is missing.');
else {
  const text = fs.readFileSync(file, 'utf8');
  const { data } = parseFrontmatter(text);
  const dir = path.basename(root);
  if (!data.name) errors.push('frontmatter.name is required.');
  if (!data.description) errors.push('frontmatter.description is required.');
  if (data.name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name)) errors.push('name must be lowercase kebab-case.');
  if (data.name && data.name.length > 64) errors.push('name must be <= 64 characters.');
  if (data.name && data.name !== dir) errors.push(`name (${data.name}) must match directory (${dir}).`);
  if (data.description && data.description.length > 1024) errors.push('description must be <= 1024 characters.');
  if (text.split(/\r?\n/).length > 500) errors.push('SKILL.md should stay under 500 lines.');
}

if (errors.length) {
  console.error('nbskills validation failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('nbskills skill validation passed.');
