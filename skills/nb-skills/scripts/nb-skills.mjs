#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { auditRemote } from './audit.mjs';
import { detectProject, formatInstalls, scoreCandidate } from './core.mjs';
import { searchSkills } from './search.mjs';

const args = process.argv.slice(2);
const command = args.shift();

const HELP = `
nb-skills — find, rank, audit, compare, and install Agent Skills

Usage:
  nb-skills search <query> [--limit N] [--owner OWNER] [--json]
  nb-skills recommend <query> [--limit N] [--json]
  nb-skills audit <owner/repo@skill> [--json]
  nb-skills compare <owner/repo@skill> <owner/repo@skill> [...] [--json]
  nb-skills project [path] [--json]
  nb-skills stack [path] [--per-query N] [--json]
  nb-skills install <owner/repo[@skill]> [--agent NAME] [--global] [--yes]
  nb-skills doctor

Examples:
  nb-skills search "react performance"
  nb-skills recommend "review pull requests for security"
  nb-skills audit vercel-labs/agent-skills@web-design-guidelines
  nb-skills project .
  nb-skills stack .
`;

try {
  if (!command || ['help', '--help', '-h'].includes(command)) console.log(HELP.trim());
  else if (command === 'search') await runSearch(args);
  else if (command === 'recommend') await runRecommend(args);
  else if (command === 'audit') await runAudit(args);
  else if (command === 'compare') await runCompare(args);
  else if (command === 'project') runProject(args);
  else if (command === 'stack') await runStack(args);
  else if (command === 'install') runInstall(args);
  else if (command === 'doctor') runDoctor();
  else throw new Error(`Unknown command: ${command}\n\n${HELP.trim()}`);
} catch (error) {
  console.error(`nb-skills: ${error.message}`);
  process.exitCode = 1;
}

function option(args, name, fallback = null) {
  const idx = args.findIndex((x) => x === name || x.startsWith(`${name}=`));
  if (idx < 0) return fallback;
  if (args[idx].includes('=')) return args[idx].split('=').slice(1).join('=');
  return args[idx + 1] && !args[idx + 1].startsWith('-') ? args[idx + 1] : true;
}

function positional(args, valueFlags = []) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (valueFlags.includes(arg)) { i++; continue; }
    if (valueFlags.some((flag) => arg.startsWith(`${flag}=`))) continue;
    if (arg.startsWith('-')) continue;
    out.push(arg);
  }
  return out;
}

async function runSearch(args) {
  const query = positional(args, ['--limit', '--owner']).join(' ');
  const limit = Number(option(args, '--limit', 8));
  const owner = option(args, '--owner', null);
  const json = args.includes('--json');
  const result = await searchSkills(query, { limit, owner, enrich: true });
  if (json) return printJson(result);
  console.log(`Search: ${result.query}`);
  console.log(`Backend: ${result.backend}\n`);
  if (!result.skills.length) return console.log('No matching skills found.');
  result.skills.forEach((skill, i) => {
    const stats = [`${formatInstalls(skill.installs)} installs`];
    if (Number.isFinite(skill.stars)) stats.push(`${skill.stars} stars`);
    console.log(`${i + 1}. ${skill.source}@${skill.name}`);
    console.log(`   ${stats.join(' · ')}`);
    console.log(`   Install: npx skills add ${skill.source}@${skill.name}`);
  });
}

async function rankQuery(query, limit = 5) {
  const result = await searchSkills(query, { limit, enrich: true });
  const ranked = [];
  for (const candidate of result.skills) {
    let audit = null;
    try { audit = (await auditRemote(`${candidate.source}@${candidate.name}`)).audit; } catch {}
    const score = scoreCandidate({
      query,
      candidate: { ...candidate, description: candidate.repo_description || candidate.description },
      audit,
      repo: { pushed_at: candidate.pushed_at },
    });
    ranked.push({ ...candidate, score, audit });
  }
  ranked.sort((a, b) => b.score.total - a.score.total);
  return { backend: result.backend, ranked };
}

async function runRecommend(args) {
  const query = positional(args, ['--limit']).join(' ');
  const limit = Math.max(1, Math.min(Number(option(args, '--limit', 5)), 8));
  const { backend, ranked } = await rankQuery(query, limit);
  if (args.includes('--json')) return printJson({ query, backend, results: ranked });
  console.log(`Best skills for: ${query}\n`);
  ranked.forEach((item, i) => {
    console.log(`${i + 1}. ${item.source}@${item.name} — ${item.score.total}/100`);
    console.log(`   relevance ${item.score.relevance}/40 · quality ${item.score.quality}/20 · trust ${item.score.trust}/15 · popularity ${item.score.popularity}/10 · freshness ${item.score.freshness}/10 · compatibility ${item.score.compatibility}/5`);
    if (item.audit) console.log(`   risk ${item.audit.risk} · security ${item.audit.securityScore}/100 · ${item.audit.findings.length} finding(s)`);
    console.log(`   npx skills add ${item.source}@${item.name}`);
  });
}

async function runAudit(args) {
  const source = positional(args)[0];
  if (!source) throw new Error('audit requires owner/repo@skill.');
  const result = await auditRemote(source);
  if (args.includes('--json')) return printJson(result);
  const { skill, audit } = result;
  console.log(`${skill.owner}/${skill.repo} — ${skill.path}`);
  console.log(`Security: ${audit.securityScore}/100 (${audit.risk} risk)`);
  console.log(`Quality: ${audit.qualityScore}/100`);
  console.log(`Files scanned: ${audit.filesScanned}`);
  if (!audit.findings.length) console.log('Findings: none detected by static heuristics.');
  else for (const finding of audit.findings) console.log(`- [${finding.severity}] ${finding.rule} in ${finding.path}: ${finding.message}`);
  console.log(`\n${audit.note}`);
}

async function runCompare(args) {
  const refs = positional(args);
  if (refs.length < 2) throw new Error('compare requires at least two owner/repo@skill references.');
  const rows = [];
  for (const ref of refs.slice(0, 6)) {
    try {
      const { skill, audit } = await auditRemote(ref);
      rows.push({ ref, path: skill.path, security: audit.securityScore, quality: audit.qualityScore, risk: audit.risk, findings: audit.findings.length });
    } catch (error) { rows.push({ ref, error: error.message }); }
  }
  if (args.includes('--json')) return printJson(rows);
  console.log('Skill comparison\n');
  for (const row of rows) console.log(row.error ? `${row.ref}: ERROR — ${row.error}` : `${row.ref}: security ${row.security}/100 · quality ${row.quality}/100 · risk ${row.risk} · findings ${row.findings}`);
}

function runProject(args) {
  const root = positional(args)[0] || '.';
  const result = detectProject(root);
  if (args.includes('--json')) return printJson(result);
  console.log(`Project: ${result.root}\n`);
  console.log('Suggested skill searches:');
  result.queries.forEach((item, i) => console.log(`${i + 1}. ${item.query} — ${item.reason}`));
  console.log('\nRun: nb-skills stack .');
}

async function runStack(args) {
  const root = positional(args, ['--per-query'])[0] || '.';
  const perQuery = Math.max(1, Math.min(Number(option(args, '--per-query', 3)), 5));
  const project = detectProject(root);
  const recommendations = [];
  for (const intent of project.queries.slice(0, 6)) {
    const { backend, ranked } = await rankQuery(intent.query, perQuery);
    recommendations.push({ intent, backend, winner: ranked[0] || null, alternatives: ranked.slice(1, 3) });
  }
  const output = { project, recommendations };
  if (args.includes('--json')) return printJson(output);
  console.log(`Skill stack for: ${project.root}\n`);
  for (const item of recommendations) {
    console.log(item.intent.reason);
    if (!item.winner) { console.log(`  No candidate found for: ${item.intent.query}\n`); continue; }
    const w = item.winner;
    const risk = w.audit ? ` · risk ${w.audit.risk}` : '';
    console.log(`  → ${w.source}@${w.name} — ${w.score.total}/100${risk}`);
    console.log(`    npx skills add ${w.source}@${w.name}`);
    if (item.alternatives.length) console.log(`    alternatives: ${item.alternatives.map((x) => `${x.source}@${x.name}`).join(', ')}`);
    console.log('');
  }
}

function runInstall(args) {
  const source = positional(args, ['--agent'])[0];
  if (!source) throw new Error('install requires owner/repo or owner/repo@skill.');
  const pass = ['-y', 'skills', 'add', source];
  const agent = option(args, '--agent', null);
  if (agent && agent !== true) pass.push('--agent', agent);
  if (args.includes('--global') || args.includes('-g')) pass.push('--global');
  if (args.includes('--yes') || args.includes('-y')) pass.push('--yes');
  const child = spawnSync('npx', pass, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`skills installer exited with code ${child.status}`);
}

function runDoctor() {
  const npx = spawnSync('npx', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  printJson({ node: process.version, npx: npx.status === 0 ? npx.stdout.trim() : 'not found', githubToken: Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN), skillsApi: process.env.SKILLS_API_URL || 'https://skills.sh' });
}

function printJson(value) { console.log(JSON.stringify(value, null, 2)); }
