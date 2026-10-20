import { githubRepoSearch, repoMetadata } from './github.mjs';

const SEARCH_BASE = process.env.SKILLS_API_URL || 'https://skills.sh';

export async function searchSkills(query, { limit = 10, owner = null, enrich = true } = {}) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Search query cannot be empty.');
  const bounded = Math.max(1, Math.min(Number(limit) || 10, 20));

  let skills = [];
  let backend = 'skills.sh experimental API';
  try {
    const params = new URLSearchParams({ q, limit: String(Math.max(bounded, 10)) });
    if (owner) params.set('owner', owner);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${SEARCH_BASE}/api/search?${params}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'nbskills/0.1' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      skills = (data.skills || []).map((skill) => ({
        id: skill.id,
        name: skill.name,
        source: skill.source || inferSource(skill.id),
        installs: Number(skill.installs) || 0,
        description: skill.description || '',
        slug: skill.id,
      }));
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    backend = 'GitHub repository fallback';
    skills = await githubRepoSearch(q, bounded);
    skills.forEach((skill) => { skill.searchWarning = `skills.sh search unavailable: ${error.message}`; });
  }

  if (owner) skills = skills.filter((skill) => skill.source?.toLowerCase().startsWith(`${owner.toLowerCase()}/`));
  skills = skills.slice(0, bounded);

  if (enrich) {
    const cache = new Map();
    for (const skill of skills) {
      if (!skill.source || !skill.source.includes('/')) continue;
      if (!cache.has(skill.source)) {
        const [repoOwner, repo] = skill.source.split('/');
        try {
          cache.set(skill.source, await repoMetadata(repoOwner, repo));
        } catch {
          cache.set(skill.source, null);
        }
      }
      const meta = cache.get(skill.source);
      if (meta) {
        skill.stars = meta.stargazers_count || 0;
        skill.pushed_at = meta.pushed_at;
        skill.repo_description = meta.description || '';
      }
    }
  }

  return { query: q, backend, skills };
}

function inferSource(id = '') {
  const parts = String(id).split('/').filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
}
