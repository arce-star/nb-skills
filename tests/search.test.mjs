import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSkills } from '../skills/nb-skills/scripts/search.mjs';
import { mergeProviderResults, parseProviderList } from '../skills/nb-skills/scripts/providers.mjs';

test('parseProviderList normalizes aliases', () => {
  assert.deepEqual(parseProviderList('skills,SkillsMP,clawhub.ai'), ['skills.sh', 'skillsmp', 'clawhub']);
});

test('multi-source search normalizes and deduplicates GitHub-backed results', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('skills.sh/api/search')) return new Response(JSON.stringify({ skills: [{ id: 'acme/skills/react-review', name: 'react-review', source: 'acme/skills', installs: 1234 }] }), { status: 200 });
    if (s.includes('skillsmp.com/api/v1/skills/search')) return new Response(JSON.stringify({ success: true, data: { skills: [{ id: 'x', name: 'react-review', description: 'Review React code', githubUrl: 'https://github.com/acme/skills/tree/main/skills/react-review', stars: 50, updatedAt: 1760000000 }] } }), { status: 200 });
    if (s.includes('clawhub.ai/api/v1/search')) return new Response(JSON.stringify({ results: [{ slug: 'react-audit', ownerHandle: 'demo', summary: 'React audit workflow', score: 0.9, updatedAt: 1760000000000 }] }), { status: 200 });
    throw new Error(`Unexpected URL ${s}`);
  };
  try {
    const result = await searchSkills('react review', { limit: 5, enrich: false });
    assert.match(result.backend, /multi-source/);
    assert.equal(result.skills.length, 2);
    const gh = result.skills.find((x) => x.source === 'acme/skills');
    assert.deepEqual(gh.providers, ['skills.sh', 'skillsmp']);
    assert.equal(gh.stars, 50);
    assert.equal(gh.auditRef, 'acme/skills@react-review');
    const claw = result.skills.find((x) => x.provider === 'clawhub');
    assert.equal(claw.auditRef, null);
    assert.equal(claw.installCommand, 'openclaw skills install @demo/react-audit');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('provider failure is isolated and reported', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('skillsmp.com')) return new Response('limited', { status: 429, headers: { 'retry-after': '30' } });
    if (s.includes('skills.sh')) return new Response(JSON.stringify({ skills: [{ id: 'a/b/c', name: 'c', source: 'a/b' }] }), { status: 200 });
    if (s.includes('clawhub.ai')) return new Response(JSON.stringify({ results: [] }), { status: 200 });
    throw new Error(`Unexpected ${s}`);
  };
  try {
    const result = await searchSkills('c', { limit: 2, enrich: false });
    assert.equal(result.skills[0].source, 'a/b');
    assert.equal(result.providerStatus.skillsmp.ok, false);
    assert.match(result.providerStatus.skillsmp.error, /429/);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('falls back to GitHub when structured providers all fail or return nothing', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('skills.sh') || s.includes('skillsmp.com') || s.includes('clawhub.ai')) return new Response('bad', { status: 503 });
    if (s.includes('api.github.com/search/repositories')) {
      return new Response(JSON.stringify({
        items: [{ name: 'agent-skills', full_name: 'acme/agent-skills', description: 'Useful', stargazers_count: 42, pushed_at: '2026-10-01T00:00:00Z' }],
      }), { status: 200 });
    }
    throw new Error(`Unexpected ${s}`);
  };
  try {
    const result = await searchSkills('react', { limit: 1, enrich: false });
    assert.equal(result.backend, 'GitHub repository fallback');
    assert.equal(result.skills[0].source, 'acme/agent-skills');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('round-robin merge prevents one provider from monopolizing results', () => {
  const rows = mergeProviderResults([
    { provider: 'a', skills: [{ id: 'a1', name: 'a1', provider: 'a' }, { id: 'a2', name: 'a2', provider: 'a' }] },
    { provider: 'b', skills: [{ id: 'b1', name: 'b1', provider: 'b' }, { id: 'b2', name: 'b2', provider: 'b' }] },
  ], 3);
  assert.deepEqual(rows.map((x) => x.name), ['a1', 'b1', 'a2']);
});
