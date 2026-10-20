import fs from 'node:fs';
import path from 'node:path';

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function tokenize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export function parseFrontmatter(markdown = '') {
  const text = String(markdown).replace(/^\uFEFF/, '');
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return { data: {}, body: text, raw: '' };
  }
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: text, raw: '' };

  const data = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = null;
  let block = [];

  const flush = () => {
    if (!currentKey) return;
    data[currentKey] = block.join(' ').replace(/\s+/g, ' ').trim();
    currentKey = null;
    block = [];
  };

  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      flush();
      const [, key, rawValue] = keyMatch;
      if (rawValue === '>' || rawValue === '|') {
        currentKey = key;
        block = [];
      } else {
        data[key] = rawValue.replace(/^['"]|['"]$/g, '').trim();
      }
      continue;
    }
    if (currentKey && /^\s+/.test(line)) block.push(line.trim());
  }
  flush();

  return {
    data,
    body: text.slice(match[0].length),
    raw: match[1],
  };
}

export function parseSkillRef(input) {
  const original = String(input || '').trim();
  if (!original) throw new Error('A skill source is required.');

  let value = original.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  value = value.replace(/^github\.com\//i, '');

  if (value.includes('/tree/')) {
    const [repoPart, treePart] = value.split('/tree/', 2);
    const repoBits = repoPart.split('/').filter(Boolean);
    const treeBits = treePart.split('/').filter(Boolean);
    if (repoBits.length < 2 || treeBits.length < 1) throw new Error(`Invalid GitHub skill URL: ${original}`);
    const [owner, repo] = repoBits;
    const ref = treeBits.shift();
    const skillPath = treeBits.join('/');
    const skill = skillPath.split('/').filter(Boolean).at(-1) || null;
    return { original, owner, repo, skill, ref, skillPath: skillPath || null };
  }

  let source = value;
  let skill = null;
  const at = source.lastIndexOf('@');
  if (at > source.indexOf('/')) {
    skill = source.slice(at + 1) || null;
    source = source.slice(0, at);
  }

  const parts = source.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error(`Expected owner/repo or owner/repo@skill, got: ${original}`);
  return {
    original,
    owner: parts[0],
    repo: parts[1],
    skill,
    ref: null,
    skillPath: null,
  };
}

export function daysSince(dateString, now = Date.now()) {
  if (!dateString) return null;
  const time = Date.parse(dateString);
  if (!Number.isFinite(time)) return null;
  return Math.max(0, (now - time) / 86_400_000);
}

export function popularityScore(installs = 0) {
  const n = Math.max(0, Number(installs) || 0);
  return clamp((Math.log10(n + 1) / 6) * 10, 0, 10);
}

export function freshnessScore(pushedAt) {
  const days = daysSince(pushedAt);
  if (days == null) return 5;
  if (days <= 14) return 10;
  if (days <= 60) return 9;
  if (days <= 180) return 7.5;
  if (days <= 365) return 6;
  if (days <= 730) return 4;
  return 2;
}

export function relevanceScore(query, candidate) {
  const q = [...new Set(tokenize(query))];
  if (q.length === 0) return 20;
  const name = tokenize(candidate.name || '').join(' ');
  const source = tokenize(candidate.source || '').join(' ');
  const desc = tokenize(candidate.description || '').join(' ');
  let hits = 0;
  let weighted = 0;
  for (const term of q) {
    let local = 0;
    if (name.includes(term)) local = Math.max(local, 1);
    if (source.includes(term)) local = Math.max(local, 0.55);
    if (desc.includes(term)) local = Math.max(local, 0.8);
    if (local > 0) hits += 1;
    weighted += local;
  }
  const coverage = hits / q.length;
  const affinity = weighted / q.length;
  return clamp((coverage * 0.65 + affinity * 0.35) * 40, 0, 40);
}

export function scoreCandidate({ query = '', candidate, audit = null, repo = null }) {
  const relevance = relevanceScore(query, candidate);
  const popularity = popularityScore(candidate.installs);
  const freshness = freshnessScore(repo?.pushed_at);
  const trust = audit ? clamp(audit.securityScore * 0.15, 0, 15) : 10;
  const quality = audit ? clamp(audit.qualityScore * 0.2, 0, 20) : 12;
  const compatibility = audit?.compatibilityScore ?? 4;
  const total = relevance + quality + trust + popularity + freshness + compatibility;
  return {
    total: Math.round(clamp(total, 0, 100)),
    relevance: round1(relevance),
    quality: round1(quality),
    trust: round1(trust),
    popularity: round1(popularity),
    freshness: round1(freshness),
    compatibility: round1(compatibility),
  };
}

export function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

export function formatInstalls(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${round1(n / 1_000_000)}M`;
  if (n >= 1_000) return `${round1(n / 1_000)}K`;
  return String(n);
}

export function detectProject(root = process.cwd()) {
  const absolute = path.resolve(root);
  const found = [];
  const add = (query, reason) => {
    if (!found.some((item) => item.query === query)) found.push({ query, reason });
  };

  const exists = (file) => fs.existsSync(path.join(absolute, file));
  const read = (file) => {
    try { return fs.readFileSync(path.join(absolute, file), 'utf8'); } catch { return ''; }
  };

  if (exists('package.json')) {
    try {
      const pkg = JSON.parse(read('package.json'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const names = Object.keys(deps);
      if (names.some((x) => /next/i.test(x))) add('nextjs react performance', 'Next.js detected');
      else if (names.some((x) => /react/i.test(x))) add('react frontend best practices', 'React detected');
      if (names.some((x) => /playwright/i.test(x))) add('playwright testing', 'Playwright detected');
      if (names.some((x) => /vitest|jest/i.test(x))) add('javascript testing', 'JavaScript test framework detected');
      if (names.some((x) => /prisma|drizzle|postgres|pg$/i.test(x))) add('database postgres', 'Database dependency detected');
      if (names.some((x) => /typescript/i.test(x))) add('typescript', 'TypeScript detected');
    } catch {
      add('javascript development', 'package.json detected');
    }
  }

  if (exists('pyproject.toml') || exists('requirements.txt')) {
    const py = `${read('pyproject.toml')}\n${read('requirements.txt')}`;
    if (/fastapi/i.test(py)) add('fastapi python api', 'FastAPI detected');
    if (/django/i.test(py)) add('django python', 'Django detected');
    if (/pytorch|torch/i.test(py)) add('pytorch machine learning', 'PyTorch detected');
    add('python best practices', 'Python project detected');
  }

  if (exists('Dockerfile') || exists('docker-compose.yml') || exists('compose.yml')) add('docker devops', 'Docker detected');
  if (exists('Cargo.toml')) add('rust', 'Rust project detected');
  if (exists('go.mod')) add('golang', 'Go project detected');
  if (exists('terraform.tf') || fs.readdirSync(absolute, { withFileTypes: true }).some((d) => d.isFile() && d.name.endsWith('.tf'))) add('terraform cloud infrastructure', 'Terraform detected');
  if (exists('.github/workflows')) add('github actions ci', 'GitHub Actions detected');

  if (found.length === 0) add('software engineering', 'No known project markers detected');
  return { root: absolute, queries: found };
}
