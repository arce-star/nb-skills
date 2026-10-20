import { parseSkillRef } from './core.mjs';

const API = 'https://api.github.com';

function headers() {
  const out = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'nb-skills/0.1',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) out.Authorization = `Bearer ${token}`;
  return out;
}

export async function fetchJson(url, { timeout = 12_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { headers: headers(), signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status} for ${url}${text ? `: ${text.slice(0, 180)}` : ''}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function repoMetadata(owner, repo) {
  return fetchJson(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

export async function githubRepoSearch(query, limit = 10) {
  const q = encodeURIComponent(`${query} agent skills in:name,description,readme`);
  const data = await fetchJson(`${API}/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Math.min(20, limit)}`);
  return (data.items || []).map((item) => ({
    name: item.name,
    source: item.full_name,
    description: item.description || '',
    installs: 0,
    stars: item.stargazers_count || 0,
    pushed_at: item.pushed_at,
    fallback: true,
  }));
}

export async function getContent(owner, repo, filePath, ref = null) {
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return fetchJson(`${API}/repos/${owner}/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}${suffix}`);
}

export async function getTextFile(owner, repo, filePath, ref = null) {
  const item = await getContent(owner, repo, filePath, ref);
  if (Array.isArray(item) || item.type !== 'file') throw new Error(`${filePath} is not a file`);
  if (item.encoding === 'base64' && item.content) return Buffer.from(item.content.replace(/\n/g, ''), 'base64').toString('utf8');
  if (item.download_url) {
    const res = await fetch(item.download_url, { headers: { 'User-Agent': 'nb-skills/0.1' } });
    if (!res.ok) throw new Error(`Unable to download ${filePath}: HTTP ${res.status}`);
    return await res.text();
  }
  throw new Error(`No readable content for ${filePath}`);
}

export async function locateSkill(input) {
  const parsed = parseSkillRef(input);
  const meta = await repoMetadata(parsed.owner, parsed.repo);
  const ref = parsed.ref || meta.default_branch;

  if (parsed.skillPath) {
    const path = parsed.skillPath.endsWith('SKILL.md') ? parsed.skillPath : `${parsed.skillPath}/SKILL.md`;
    const text = await getTextFile(parsed.owner, parsed.repo, path, ref);
    return { ...parsed, ref, repoMeta: meta, path, root: path.replace(/\/?SKILL\.md$/i, ''), text };
  }

  const candidates = [];
  if (parsed.skill) {
    candidates.push(
      `skills/${parsed.skill}/SKILL.md`,
      `.agents/skills/${parsed.skill}/SKILL.md`,
      `.claude/skills/${parsed.skill}/SKILL.md`,
      `${parsed.skill}/SKILL.md`,
    );
  } else {
    candidates.push('SKILL.md');
  }

  let lastError = null;
  for (const filePath of candidates) {
    try {
      const text = await getTextFile(parsed.owner, parsed.repo, filePath, ref);
      return {
        ...parsed,
        ref,
        repoMeta: meta,
        path: filePath,
        root: filePath.replace(/\/?SKILL\.md$/i, ''),
        text,
      };
    } catch (error) {
      lastError = error;
      if (error.status && error.status !== 404) throw error;
    }
  }

  throw new Error(`Could not locate SKILL.md for ${input}${lastError ? ` (${lastError.message})` : ''}`);
}

export async function listSkillFiles(skill, { maxFiles = 30 } = {}) {
  const root = skill.root;
  const dirs = root ? [`${root}/scripts`, `${root}/references`] : ['scripts', 'references'];
  const files = [];

  for (const dir of dirs) {
    if (files.length >= maxFiles) break;
    try {
      const items = await getContent(skill.owner, skill.repo, dir, skill.ref);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (files.length >= maxFiles) break;
        if (item.type !== 'file') continue;
        if (!/\.(?:sh|bash|zsh|js|mjs|cjs|ts|py|ps1|md|txt|json|ya?ml)$/i.test(item.name)) continue;
        try {
          const text = await getTextFile(skill.owner, skill.repo, item.path, skill.ref);
          files.push({ path: item.path, text: text.slice(0, 250_000) });
        } catch {
          // A partial audit is still useful; unreadable files are reported separately by callers if needed.
        }
      }
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  return files;
}
