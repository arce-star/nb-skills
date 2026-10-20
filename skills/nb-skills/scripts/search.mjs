import { githubRepoSearch, repoMetadata } from './github.mjs';
import { DEFAULT_PROVIDERS, mergeProviderResults, parseProviderList, searchProvider } from './providers.mjs';

export async function searchSkills(query, { limit = 10, owner = null, enrich = true, providers = null } = {}) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Search query cannot be empty.');
  const bounded = Math.max(1, Math.min(Number(limit) || 10, 20));
  const selected = parseProviderList(providers || process.env.NBSKILLS_PROVIDERS || DEFAULT_PROVIDERS.join(','));

  const settled = await Promise.allSettled(selected.map(async (provider) => ({
    provider,
    skills: await searchProvider(provider, q, { limit: Math.max(bounded, 10), owner }),
  })));

  const successes = [];
  const providerStatus = {};
  settled.forEach((result, index) => {
    const provider = selected[index];
    if (result.status === 'fulfilled') {
      successes.push(result.value);
      providerStatus[provider] = { ok: true, count: result.value.skills.length };
    } else {
      providerStatus[provider] = { ok: false, error: result.reason?.message || String(result.reason) };
    }
  });

  let skills = mergeProviderResults(successes, bounded);
  let backend = `multi-source (${successes.map((x) => x.provider).join(', ') || 'none'})`;
  if (!skills.length) {
    backend = 'GitHub repository fallback';
    skills = (await githubRepoSearch(q, bounded)).map((skill) => ({
      ...skill,
      provider: skill.provider || 'github',
      providers: skill.providers || ['github'],
      displayRef: skill.displayRef || (skill.source && skill.name ? `${skill.source}@${skill.name}` : skill.source || skill.name),
      auditRef: skill.auditRef || (skill.source && skill.name ? `${skill.source}@${skill.name}` : null),
      installCommand: skill.installCommand || (skill.source && skill.name ? `npx skills add ${skill.source}@${skill.name}` : null),
      fallback: true,
    }));
    providerStatus.github = { ok: true, count: skills.length, fallback: true };
  }

  if (owner) skills = skills.filter((skill) => ownerMatches(skill, owner));
  skills = skills.slice(0, bounded);

  if (enrich) {
    const cache = new Map();
    for (const skill of skills) {
      if (!skill.source || !skill.source.includes('/')) continue;
      if (!cache.has(skill.source)) {
        const [repoOwner, repo] = skill.source.split('/');
        try { cache.set(skill.source, await repoMetadata(repoOwner, repo)); }
        catch { cache.set(skill.source, null); }
      }
      const meta = cache.get(skill.source);
      if (meta) {
        skill.stars = Math.max(Number(skill.stars) || 0, Number(meta.stargazers_count) || 0);
        skill.pushed_at = newestDate(skill.pushed_at, meta.pushed_at);
        skill.repo_description = meta.description || '';
      }
    }
  }

  return { query: q, backend, providers: selected, providerStatus, skills };
}

function ownerMatches(skill, owner) {
  const expected = String(owner).replace(/^@/, '').toLowerCase();
  const actual = skill.source ? skill.source.split('/')[0] : skill.owner;
  return String(actual || '').replace(/^@/, '').toLowerCase() === expected;
}

function newestDate(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}
