const USER_AGENT = 'nb-skills/0.3';
const SKILLS_SH_BASE = process.env.SKILLS_API_URL || 'https://skills.sh';
const SKILLSMP_BASE = process.env.SKILLSMP_API_URL || 'https://skillsmp.com';
const CLAWHUB_BASE = process.env.CLAWHUB_API_URL || 'https://clawhub.ai';

export const DEFAULT_PROVIDERS = ['skills.sh', 'skillsmp', 'clawhub'];

export function parseProviderList(value) {
  if (!value) return [...DEFAULT_PROVIDERS];
  const aliases = new Map([
    ['skills', 'skills.sh'], ['skills.sh', 'skills.sh'], ['skillssh', 'skills.sh'],
    ['skillsmp', 'skillsmp'], ['skillsmp.com', 'skillsmp'],
    ['clawhub', 'clawhub'], ['clawhub.ai', 'clawhub'],
  ]);
  const items = String(value).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const normalized = [];
  for (const item of items) {
    const name = aliases.get(item);
    if (!name) throw new Error(`Unknown discovery provider: ${item}`);
    if (!normalized.includes(name)) normalized.push(name);
  }
  if (!normalized.length) throw new Error('At least one discovery provider is required.');
  return normalized;
}

export async function searchProvider(name, query, { limit = 10, owner = null } = {}) {
  if (name === 'skills.sh') return searchSkillsSh(query, { limit, owner });
  if (name === 'skillsmp') return searchSkillsMP(query, { limit, owner });
  if (name === 'clawhub') return searchClawHub(query, { limit, owner });
  throw new Error(`Unknown discovery provider: ${name}`);
}

export async function searchSkillsSh(query, { limit = 10, owner = null } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(Math.max(limit, 10)) });
  if (owner) params.set('owner', owner);
  const data = await requestJson(`${SKILLS_SH_BASE}/api/search?${params}`, { timeout: 10_000 });
  return (data.skills || []).map((skill) => {
    const source = skill.source || inferSource(skill.id);
    const name = skill.name || inferSkillName(skill.id);
    return withGitHubIdentity({
      id: skill.id || `${source}/${name}`,
      name,
      source,
      description: skill.description || '',
      installs: Number(skill.installs) || 0,
      provider: 'skills.sh',
      providerScore: null,
      providerUrl: skill.url || null,
    });
  }).filter((skill) => ownerMatches(skill, owner));
}

export async function searchSkillsMP(query, { limit = 10, owner = null } = {}) {
  const params = new URLSearchParams({ q: query, page: '1', limit: String(Math.min(Math.max(limit, 10), 50)), sortBy: 'stars' });
  const headers = {};
  if (process.env.SKILLSMP_API_KEY) headers.Authorization = `Bearer ${process.env.SKILLSMP_API_KEY}`;
  const payload = await requestJson(`${SKILLSMP_BASE}/api/v1/skills/search?${params}`, { headers, timeout: 12_000 });
  const rows = payload?.data?.skills || payload?.skills || [];
  return rows.map((skill) => {
    const github = parseGitHubSkillUrl(skill.githubUrl || skill.github_url || skill.sourceUrl || '');
    const source = github?.source || normalizeRepo(skill.repository || skill.repo || '');
    const name = skill.name || github?.skill || inferSkillName(skill.id);
    return withGitHubIdentity({
      id: skill.id || `${source || 'skillsmp'}/${name}`,
      name,
      source,
      description: skill.description || '',
      installs: Number(skill.installs || skill.downloads) || 0,
      stars: numberOrNull(skill.stars),
      pushed_at: normalizeDate(skill.updatedAt || skill.updated_at),
      provider: 'skillsmp',
      providerScore: null,
      providerUrl: skill.skillUrl || skill.skill_url || null,
      githubUrl: skill.githubUrl || skill.github_url || null,
      skillPath: github?.path || null,
    });
  }).filter((skill) => skill.name && ownerMatches(skill, owner));
}

export async function searchClawHub(query, { limit = 10, owner = null } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(Math.min(Math.max(limit, 10), 100)), nonSuspiciousOnly: 'true' });
  const data = await requestJson(`${CLAWHUB_BASE}/api/v1/search?${params}`, { timeout: 12_000 });
  const rows = Array.isArray(data) ? data : (data.results || []);
  return rows.map((skill) => {
    const ownerHandle = skill.ownerHandle || skill.owner?.handle || '';
    const slug = skill.slug || skill.name || '';
    const registryRef = ownerHandle ? `@${ownerHandle}/${slug}` : slug;
    return {
      id: `clawhub:${registryRef}`,
      name: slug,
      source: null,
      owner: ownerHandle || null,
      description: skill.summary || skill.description || '',
      installs: Number(skill.downloads || skill.installs) || 0,
      stars: numberOrNull(skill.stars),
      pushed_at: normalizeDate(skill.updatedAt || skill.updated_at),
      provider: 'clawhub',
      providers: ['clawhub'],
      providerScore: numberOrNull(skill.score),
      providerUrl: ownerHandle && slug ? `${CLAWHUB_BASE}/${encodeURIComponent(ownerHandle)}/skills/${encodeURIComponent(slug)}` : null,
      registryRef,
      displayRef: registryRef,
      auditRef: null,
      installCommand: registryRef ? `openclaw skills install ${registryRef}` : null,
      registryOnly: true,
    };
  }).filter((skill) => skill.name && ownerMatches(skill, owner));
}

export function mergeProviderResults(providerResults, limit = 10) {
  const ordered = [];
  const maxRows = Math.max(0, ...providerResults.map((entry) => entry.skills.length));
  for (let rank = 0; rank < maxRows; rank++) {
    for (const entry of providerResults) {
      if (entry.skills[rank]) ordered.push(entry.skills[rank]);
    }
  }

  const merged = new Map();
  for (const skill of ordered) {
    const key = canonicalKey(skill);
    if (!merged.has(key)) {
      merged.set(key, { ...skill, providers: [...new Set(skill.providers || [skill.provider].filter(Boolean))] });
      continue;
    }
    const prev = merged.get(key);
    const providers = [...new Set([...(prev.providers || []), ...(skill.providers || [skill.provider].filter(Boolean))])];
    merged.set(key, {
      ...prev,
      providers,
      installs: Math.max(Number(prev.installs) || 0, Number(skill.installs) || 0),
      stars: maxNullable(prev.stars, skill.stars),
      pushed_at: newestDate(prev.pushed_at, skill.pushed_at),
      description: longer(prev.description, skill.description),
      providerUrl: prev.providerUrl || skill.providerUrl,
      githubUrl: prev.githubUrl || skill.githubUrl,
      skillPath: prev.skillPath || skill.skillPath,
      providerScore: maxNullable(prev.providerScore, skill.providerScore),
    });
  }
  return [...merged.values()].slice(0, Math.max(1, Number(limit) || 10));
}

function withGitHubIdentity(skill) {
  const source = normalizeRepo(skill.source || '');
  const name = String(skill.name || '').trim();
  const auditRef = source && name ? `${source}@${name}` : null;
  return {
    ...skill,
    source: source || null,
    providers: [skill.provider],
    displayRef: auditRef || name,
    auditRef,
    installCommand: auditRef ? `npx skills add ${auditRef}` : null,
    registryOnly: !auditRef,
  };
}

function canonicalKey(skill) {
  if (skill.source && skill.name) return `github:${skill.source.toLowerCase()}@${skill.name.toLowerCase()}`;
  if (skill.registryRef) return `${skill.provider}:${skill.registryRef.toLowerCase()}`;
  return `${skill.provider}:${String(skill.id || skill.name).toLowerCase()}`;
}

function parseGitHubSkillUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const source = `${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
    let path = '';
    const treeIndex = parts.indexOf('tree');
    const blobIndex = parts.indexOf('blob');
    const marker = treeIndex >= 0 ? treeIndex : blobIndex;
    if (marker >= 0 && parts.length > marker + 2) path = parts.slice(marker + 2).join('/').replace(/\/SKILL\.md$/i, '');
    const skill = path ? path.split('/').filter(Boolean).at(-1) : null;
    return { source, path: path || null, skill };
  } catch {
    return null;
  }
}

async function requestJson(url, { headers = {}, timeout = 10_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const retryAfter = res.headers.get('retry-after');
      const text = await res.text().catch(() => '');
      const extra = retryAfter ? `; retry after ${retryAfter}s` : '';
      throw new Error(`HTTP ${res.status}${extra}${text ? `: ${text.slice(0, 120)}` : ''}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function ownerMatches(skill, owner) {
  if (!owner) return true;
  const expected = String(owner).replace(/^@/, '').toLowerCase();
  const actual = skill.source ? skill.source.split('/')[0] : skill.owner;
  return String(actual || '').replace(/^@/, '').toLowerCase() === expected;
}

function normalizeRepo(value) {
  const raw = String(value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  const parts = raw.split('/').filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
}

function inferSource(id = '') {
  const parts = String(id).split('/').filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
}

function inferSkillName(id = '') {
  return String(id).split('/').filter(Boolean).at(-1) || '';
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  const n = Number(value);
  if (Number.isFinite(n) && String(value).trim() !== '') {
    const ms = n < 10_000_000_000 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function maxNullable(a, b) {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(Number(a), Number(b));
}
function newestDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}
function longer(a = '', b = '') { return String(b).length > String(a).length ? b : a; }
