---
name: nb-skills
description: >
  Discover, evaluate, compare, audit, and install Agent Skills. Use this skill when the user asks to find a skill for a task, discover new agent capabilities, compare alternatives, audit a skill before installation, or recommend skills for the current codebase.
license: MIT
compatibility: Requires Node.js 20+ for bundled scripts and network access for remote discovery. GitHub and SkillsMP tokens are optional but improve API rate limits.
---

# nb-skills

Use nb-skills as a meta-skill: it finds and evaluates other Agent Skills instead of solving their domain task itself.

## Core workflow

1. Understand the user's actual task, not just their literal keywords.
2. Expand the task into one to three concise search queries when useful.
3. Search multiple providers with `scripts/nb-skills.mjs search "<query>"`.
4. For GitHub-backed candidates, inspect and statically audit the strongest candidates with `scripts/nb-skills.mjs audit <owner/repo@skill>`.
5. Treat registry-only candidates as lower-confidence until their source can be inspected; never invent an audit result.
6. Rank candidates by task relevance first, then quality, trust, popularity, freshness, and compatibility.
7. Recommend a small shortlist, normally three candidates. Explain why the first choice wins and mention meaningful tradeoffs.
8. Install only when the user explicitly asks to install or clearly approves installation.

## Search

Run:

```bash
node scripts/nb-skills.mjs search "react performance"
```

For structured output:

```bash
node scripts/nb-skills.mjs search "react performance" --json
```

Default discovery queries skills.sh, SkillsMP, and ClawHub independently, normalizes their results, deduplicates GitHub-backed skills, and isolates provider failures. GitHub repository search is used only when structured providers produce no usable candidates.

Restrict providers when needed:

```bash
node scripts/nb-skills.mjs search "react performance" --providers skills.sh,skillsmp
```

Read [references/sources.md](references/sources.md) for provider contracts, rate-limit notes, and registry-only handling.

## Recommend

Use full recommendation mode when the user asks for the best skill rather than just a list:

```bash
node scripts/nb-skills.mjs recommend "review pull requests for security"
```

This mode attempts to inspect GitHub-backed top candidates before scoring them. If a candidate cannot be inspected, say that confidence is lower rather than inventing audit results. ClawHub registry-only candidates may still be surfaced, but must be labeled as not inspected by the built-in GitHub static auditor.

Read [references/ranking.md](references/ranking.md) when explaining scores or changing ranking behavior.

## Audit before installation

Run:

```bash
node scripts/nb-skills.mjs audit owner/repo@skill
```

The audit is heuristic static analysis. It can identify suspicious shell execution, destructive commands, secret access, prompt-injection language, remote downloads, and similar signals. It cannot prove that a skill is safe.

Read [references/security.md](references/security.md) for the threat model and interpretation rules.

## Compare alternatives

Run:

```bash
node scripts/nb-skills.mjs compare owner/repo@skill-a other/repo@skill-b
```

Do not choose solely by stars or install count. A lower-popularity skill can be the better recommendation when it matches the user's task more precisely or has a cleaner trust profile.

## Project-aware discovery

When the user asks what skills a repository needs, inspect the current codebase first:

```bash
node scripts/nb-skills.mjs project .
```

Resolve those intents automatically:

```bash
node scripts/nb-skills.mjs stack .
```

For a one-command repository recommendation, run `node scripts/nb-skills.mjs stack .`. It resolves detected intents into searched, audited, ranked winners. Prefer a small skill stack that covers distinct needs over many overlapping skills.

## Installation

For GitHub-backed skills, when installation is approved, prefer the ecosystem installer:

```bash
node scripts/nb-skills.mjs install owner/repo@skill
```

or directly:

```bash
npx skills add owner/repo@skill
```

For registry-only ClawHub results, use the registry-native command printed by nb-skills, for example:

```bash
openclaw skills install @owner/slug
```

Never silently install a candidate merely because it ranked first.

## Output style

For a normal recommendation, present:

- best candidate and score;
- discovery provider(s);
- one-line reason it matches the task;
- security/audit status if inspected;
- explicit "registry-only / audit unavailable" status when source inspection was not possible;
- one or two alternatives with the main tradeoff;
- install command only when useful.

Avoid dumping a long unranked search result list unless the user explicitly asks for exhaustive results.

## Failure handling

- If one provider fails, continue with successful providers and expose the provider warning.
- If all structured providers fail or return nothing, use the GitHub fallback and state that discovery precision may be lower.
- If a `SKILL.md` cannot be located, do not assign fabricated quality or security findings.
- If a registry result has no GitHub source, do not claim the built-in static audit covered it.
- If a repository is stale but uniquely relevant, surface both facts.
- If static audit flags high-risk behavior, explain the exact signal and recommend manual inspection before installation.
- If the user's request can be solved directly without another skill, do not force a skill recommendation.

## References

- [references/ranking.md](references/ranking.md) — scoring model and ranking principles.
- [references/security.md](references/security.md) — audit rules and threat model.
- [references/sources.md](references/sources.md) — discovery providers, rate limits, normalization, and fallbacks.
