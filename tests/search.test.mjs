import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSkills } from '../skills/nb-skills/scripts/search.mjs';

test('searchSkills normalizes skills.sh results', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /skills\.sh\/api\/search/);
    return new Response(JSON.stringify({
      skills: [{
        id: 'acme/skills/react-review',
        name: 'react-review',
        installs: 1234,
        source: 'acme/skills',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await searchSkills('react review', { limit: 3, enrich: false });
    assert.equal(result.backend, 'skills.sh experimental API');
    assert.equal(result.skills[0].source, 'acme/skills');
    assert.equal(result.skills[0].name, 'react-review');
    assert.equal(result.skills[0].installs, 1234);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('searchSkills falls back to GitHub repository search', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (String(url).includes('skills.sh')) return new Response('nope', { status: 503 });
    if (String(url).includes('api.github.com/search/repositories')) {
      return new Response(JSON.stringify({
        items: [{
          name: 'agent-skills',
          full_name: 'acme/agent-skills',
          description: 'Useful skills',
          stargazers_count: 42,
          pushed_at: '2026-10-01T00:00:00Z',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  try {
    const result = await searchSkills('react', { limit: 1, enrich: false });
    assert.equal(result.backend, 'GitHub repository fallback');
    assert.equal(result.skills[0].source, 'acme/agent-skills');
    assert.ok(calls >= 2);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
