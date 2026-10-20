import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFrontmatter,
  parseSkillRef,
  relevanceScore,
  scoreCandidate,
  popularityScore,
} from '../skills/nb-skills/scripts/core.mjs';

test('parseFrontmatter reads folded description', () => {
  const input = `---\nname: demo\ndescription: >\n  Find useful things\n  for agents.\n---\n# Demo\n`;
  const parsed = parseFrontmatter(input);
  assert.equal(parsed.data.name, 'demo');
  assert.equal(parsed.data.description, 'Find useful things for agents.');
  assert.match(parsed.body, /# Demo/);
});

test('parseSkillRef supports owner/repo@skill', () => {
  assert.deepEqual(parseSkillRef('acme/tools@reviewer'), {
    original: 'acme/tools@reviewer',
    owner: 'acme',
    repo: 'tools',
    skill: 'reviewer',
    ref: null,
    skillPath: null,
  });
});

test('relevance dominates popularity in the default score', () => {
  const exact = scoreCandidate({
    query: 'react performance',
    candidate: { name: 'react-performance', source: 'small/repo', installs: 50 },
  });
  const popularWrong = scoreCandidate({
    query: 'react performance',
    candidate: { name: 'database-migrations', source: 'huge/repo', installs: 10_000_000 },
  });
  assert.ok(exact.total > popularWrong.total);
});

test('popularity score is logarithmic and capped', () => {
  assert.ok(popularityScore(100_000) < 10);
  assert.equal(popularityScore(1_000_000_000), 10);
});
