# Changelog

## 0.3.0 — 2026-10-20

- add a provider adapter layer for multi-source Agent Skill discovery;
- search skills.sh, SkillsMP, and ClawHub in parallel by default;
- normalize and deduplicate GitHub-backed skills across registries while preserving provider provenance;
- isolate provider failures so one registry outage or rate limit does not break discovery;
- add `--providers` and `NBSKILLS_PROVIDERS` controls;
- preserve honest trust semantics for registry-only ClawHub results that do not expose a GitHub source;
- keep GitHub repository search as a last-resort fallback when structured registries return no usable results.

## 0.2.0 — 2026-10-20

- add `nb-skills stack .` for repository-aware end-to-end skill recommendations;
- detect project intents, search candidates, audit them, rank them, and select winners in one command;
- redesign the README around a 10-second product demo and clear value proposition;
- add terminal demo asset and updated quick-start flow.

## 0.1.0 — 2026-10-20

Initial public MVP:

- Agent Skill under `skills/nb-skills/`;
- skills.sh discovery with GitHub fallback;
- relevance/quality/trust/popularity/freshness/compatibility ranking;
- static security audit;
- skill comparison;
- project-aware search intent detection;
- installation delegation to the upstream `skills` CLI;
- JSON output for automation;
- CI and unit tests.
