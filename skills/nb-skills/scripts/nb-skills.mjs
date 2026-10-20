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
  nb-skills search <query> [--limit N] [--owner OWNER] [--providers LIST] [--json]
  nb-skills recommend <query> [--limit N] [--providers LIST] [--json]
  nb-skills audit <owner/repo@skill> [--json]
  nb-skills compare <owner/repo@skill> <owner/repo@skill> [...] [--json]
  nb-skills project [path] [--json]
  nb-skills stack [path] [--per-query N] [--providers LIST] [--json]
  nb-skills install <owner/repo[@skill]> [--agent NAME] [--global] [--yes]
  nb-skills doctor

Providers:
  skills.sh, skillsmp, clawhub (default: all)

Examples:
  nb-skills search "react performance"
  nb-skills search "react performance" --providers skills.sh,skillsmp
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

function selectedProviders(args) {
  const value = option(args, '--providers', null);
  return value && value !== true ? value : null;
}

function skillRef(skill) {
  return skill.displayRef || (skill.source && skill.name ? `${skill.source}@${skill.name}` : skill.name || skill.id || 'unknown');
}

function installCommand(skill) {
  return skill.installCommand || (skill.source && skill.name ? `npx skills add ${skill.source}@${skill.name}` : null);
}

function providerText(skill) {
  const providers = skill.providers?.length ? skill.providers : [skill.provider].filter(Boolean);
  return providers.length ? providers.join(', ') : 'unknown';
}

async function runSearch(args) {
  const query = positional(args, ['--limit', '--owner', '--providers']).join(' ');
  const limit = Number(option(args, '--limit', 8));
  const owner = option(args, '--owner', null);
  const providers = selectedProviders(args);
  const json = args.includes('--json');
  const result = await searchSkills(query, { limit, owner, enrich: true, providers });
  if (json) return printJson(result);
  console.log(`Search: ${result.query}`);
  console.log(`Backend: ${result.backend}`);
  console.log(`Providers: ${result.providers.join(', ')}\n`);
  if (!result.skills.length) return console.log('No matching skills found.');
  result.skills.forEach((skill, i) => {
    const stats = [];
    if ((Number(skill.installs) || 0) > 0) stats.push(`${formatInstalls(skill.installs)} installs`);
    if (Number.isFinite(skill.stars)) stats.push(`${skill.stars} stars`);
    console.log(`${i + 1}. ${skillRef(skill)}`);
    console.log(`   via ${providerText(skill)}${stats.length ? ` · ${stats.join(' · ')}` : ''}`);
    if (skill.description) console.log(`   ${skill.description.slice(0, 160)}`);
    const install = installCommand(skill);
    if (install) console.log(`   Install: ${install}`);
    if (!skill.auditRef) console.log('   Audit: registry metadata only; no GitHub source available to the built-in static auditor');
  });

  const failed = Object.entries(result.providerStatus || {}).filter(([, status]) => !status.ok);
  if (failed.length) console.log(`\nProvider warnings: ${failed.map(([name, status]) => `${name}: ${status.error}`).join(' | ')}`);
}

async function rankQuery(query, limit = 5, providers = null) {
  const result = await searchSkills(query, { limit, enrich: true, providers });
  const ranked = [];
  for (const candidate of result.skills) {
    let audit = null;
    if (candidate.auditRef) {
      try { audit = (await auditRemote(candidate.auditRef)).audit; } catch {}
    }
    const score = scoreCandidate({
      query,
      candidate: { ...candidate, description: candidate.repo_description || candidate.description },
      audit,
      repo: { pushed_at: candidate.pushed_at },
    });
    ranked.push({ ...candidate, score, audit, auditAvailable: Boolean(candidate.auditRef) });
  }
  ranked.sort((a, b) => b.score.total - a.score.total);
  return { backend: result.backend, providers: result.providers, providerStatus: result.providerStatus, ranked };
}

async function runRecommend(args) {
  const query = positional(args, ['--limit', '--providers']).join(' ');
  const limit = Math.max(1, Math.min(Number(option(args, '--limit', 5)), 8));
  const providers = selectedProviders(args);
  const result = await rankQuery(query, limit, providers);
  if (args.includes('--json')) return printJson({ query, ...result, results: result.ranked });
  console.log(`Best skills for: ${query}`);
  console.log(`Providers: ${result.providers.join(', ')}\n`);
  result.ranked.forEach((item, i) => {
    console.log(`${i + 1}. ${skillRef(item)} — ${item.score.total}/100`);
    console.log(`   relevance ${item.score.relevance}/40 · quality ${item.score.quality}/20 · trust ${item.score.trust}/15 · popularity ${item.score.popularity}/10 · freshness ${item.score.freshness}/10 · compatibility ${item.score.compatibility}/5`);
    console.log(`   discovered via ${providerText(item)}`);
    if (item.audit) console.log(`   risk ${item.audit.risk} · security ${item.audit.securityScore}/100 · ${item.audit.findings.length} finding(s)`);
    else if (!item.auditRef) console.log('   audit unavailable: registry result has no GitHub source');
    else console.log('   audit unavailable: GitHub source could not be inspected');
    const install = installCommand(item);
    if (install) console.log(`   ${install}`);
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
  const root = positional(args, ['--per-query', '--providers'])[0] || '.';
  const perQuery = Math.max(1, Math.min(Number(option(args, '--per-query', 3)), 5));
  const providers = selectedProviders(args);
  const project = detectProject(root);
  const recommendations = [];
  for (const intent of project.queries.slice(0, 6)) {
    const result = await rankQuery(intent.query, perQuery, providers);
    recommendations.push({ intent, backend: result.backend, providers: result.providers, winner: result.ranked[0] || null, alternatives: result.ranked.slice(1, 3) });
  }
  const output = { project, recommendations };
  if (args.includes('--json')) return printJson(output);
  console.log(`Skill stack for: ${project.root}\n`);
  for (const item of recommendations) {
    console.log(item.intent.reason);
    if (!item.winner) { console.log(`  No candidate found for: ${item.intent.query}\n`); continue; }
    const w = item.winner;
    const risk = w.audit ? ` · risk ${w.audit.risk}` : w.auditRef ? ' · audit unavailable' : ' · registry-only';
    console.log(`  → ${skillRef(w)} — ${w.score.total}/100${risk}`);
    console.log(`    via ${providerText(w)}`);
    const install = installCommand(w);
    if (install) console.log(`    ${install}`);
    if (item.alternatives.length) console.log(`    alternatives: ${item.alternatives.map(skillRef).join(', ')}`);
    console.log('');
  }
}

function runInstall(args) {
  const source = positional(args, ['--agent'])[0];
  if (!source) throw new Error('install requires a GitHub owner/repo or owner/repo@skill reference. For ClawHub registry-only results, use the install command printed by search/recommend.');
  if (/^@[^/]+\//.test(source)) throw new Error(`ClawHub references are installed with: openclaw skills install ${source}`);
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
  printJson({
    node: process.version,
    npx: npx.status === 0 ? npx.stdout.trim() : 'not found',
    githubToken: Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN),
    skillsmpApiKey: Boolean(process.env.SKILLSMP_API_KEY),
    providers: process.env.NBSKILLS_PROVIDERS || 'skills.sh,skillsmp,clawhub',
    skillsApi: process.env.SKILLS_API_URL || 'https://skills.sh',
    skillsmpApi: process.env.SKILLSMP_API_URL || 'https://skillsmp.com',
    clawhubApi: process.env.CLAWHUB_API_URL || 'https://clawhub.ai',
  });
}

function printJson(value) { console.log(JSON.stringify(value, null, 2)); }
