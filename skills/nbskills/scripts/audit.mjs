import { parseFrontmatter, clamp } from './core.mjs';
import { locateSkill, listSkillFiles } from './github.mjs';

const RULES = [
  { id: 'sudo', severity: 'high', weight: 18, re: /\bsudo\b/gi, message: 'Requests elevated privileges (sudo).' },
  { id: 'destructive-rm', severity: 'critical', weight: 30, re: /\brm\s+-rf\s+(?:\/|~|\$HOME|\*)/gi, message: 'Contains a potentially destructive rm -rf command.' },
  { id: 'pipe-shell', severity: 'high', weight: 20, re: /(?:curl|wget)[^\n|]{0,240}\|\s*(?:bash|sh|zsh|powershell|pwsh)\b/gi, message: 'Downloads remote content and pipes it directly into a shell.' },
  { id: 'secret-access', severity: 'medium', weight: 10, re: /(?:\.env\b|GITHUB_TOKEN|GH_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY)/gi, message: 'References common secret or credential locations.' },
  { id: 'ssh-access', severity: 'medium', weight: 10, re: /(?:~\/\.ssh|\.ssh\/|id_rsa|id_ed25519)/gi, message: 'References SSH credentials or SSH configuration.' },
  { id: 'credential-store', severity: 'high', weight: 16, re: /(?:keychain|credential manager|credentials\.json|auth token)/gi, message: 'References credential stores or authentication tokens.' },
  { id: 'network-download', severity: 'low', weight: 4, re: /\b(?:curl|wget|fetch\(|requests\.(?:get|post)|urllib)\b/gi, message: 'Performs or describes outbound network access.' },
  { id: 'shell-exec', severity: 'low', weight: 5, re: /(?:child_process|execSync|spawnSync|subprocess\.|os\.system|Invoke-Expression)/gi, message: 'Executes local processes or shell commands.' },
  { id: 'chmod-exec', severity: 'low', weight: 3, re: /\bchmod\s+\+x\b/gi, message: 'Marks a file executable.' },
  { id: 'base64-decode', severity: 'medium', weight: 8, re: /(?:base64\s+(?:-d|--decode)|Buffer\.from\([^)]*base64|b64decode)/gi, message: 'Decodes base64 content; review for hidden payloads.' },
  { id: 'prompt-injection', severity: 'medium', weight: 12, re: /(?:ignore (?:all|any|the) previous instructions|system prompt|developer message|reveal (?:your|the) prompt)/gi, message: 'Contains language associated with prompt-injection attempts.' },
];

export function auditTexts({ skillText, files = [], source = 'local' }) {
  const manifest = parseFrontmatter(skillText);
  const corpus = [{ path: 'SKILL.md', text: skillText }, ...files];
  const findings = [];

  for (const rule of RULES) {
    for (const file of corpus) {
      const re = new RegExp(rule.re.source, rule.re.flags);
      const matches = [...file.text.matchAll(re)].slice(0, 5);
      if (!matches.length) continue;
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        weight: rule.weight,
        path: file.path,
        count: matches.length,
        message: rule.message,
        samples: matches.map((m) => String(m[0]).slice(0, 100)),
      });
    }
  }

  const uniquePenalty = new Map();
  for (const finding of findings) {
    uniquePenalty.set(finding.rule, Math.max(uniquePenalty.get(finding.rule) || 0, finding.weight));
  }
  const penalty = [...uniquePenalty.values()].reduce((a, b) => a + b, 0);
  const securityScore = Math.round(clamp(100 - penalty, 0, 100));

  let qualityScore = 35;
  const data = manifest.data;
  if (data.name) qualityScore += 20;
  if (data.description && data.description.length >= 30) qualityScore += 20;
  if (/##?\s+(?:workflow|instructions|steps|how to use)/i.test(manifest.body)) qualityScore += 10;
  if (/##?\s+(?:examples?|usage)/i.test(manifest.body)) qualityScore += 5;
  if (/##?\s+(?:edge cases?|failure|fallback)/i.test(manifest.body)) qualityScore += 5;
  if (files.length > 0) qualityScore += 5;
  qualityScore = Math.round(clamp(qualityScore, 0, 100));

  let compatibilityScore = 4;
  const compat = String(data.compatibility || '').toLowerCase();
  if (!compat) compatibilityScore = 4;
  else if (/node|python|bash|network|git/.test(compat)) compatibilityScore = 5;

  const maxSeverity = findings.some((x) => x.severity === 'critical') ? 'critical'
    : findings.some((x) => x.severity === 'high') ? 'high'
      : findings.some((x) => x.severity === 'medium') ? 'medium'
        : findings.length ? 'low' : 'none';

  return {
    source,
    manifest: data,
    findings,
    securityScore,
    qualityScore,
    compatibilityScore,
    risk: maxSeverity,
    filesScanned: corpus.length,
    note: 'Static heuristic audit only; a low-risk result is not a guarantee of safety.',
  };
}

export async function auditRemote(input) {
  const skill = await locateSkill(input);
  const files = await listSkillFiles(skill);
  const audit = auditTexts({ skillText: skill.text, files, source: input });
  return { skill, audit };
}
