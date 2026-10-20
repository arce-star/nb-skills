# Security model

nb-skills performs static heuristic review before recommending or installing an unfamiliar skill.

## Threat model

A skill can influence an agent through instructions and may bundle executable scripts. Relevant risks include:

- destructive shell commands;
- privilege escalation;
- remote code download and direct shell execution;
- credential, secret, or SSH-key access;
- broad filesystem writes;
- external network calls;
- hidden or encoded payloads;
- prompt-injection instructions that attempt to override higher-priority instructions.

## Severity guide

- Critical: behavior can directly cause destructive system changes.
- High: behavior can execute untrusted remote code or access privileged resources.
- Medium: behavior touches secrets, credentials, encoded payloads, or suspicious prompt instructions and requires context review.
- Low: ordinary network or process execution that may be legitimate but expands the skill's capability surface.

## Interpretation

`Security 100/100` means the current heuristic rules did not detect penalized patterns in the files that were scanned. It does not mean the skill has been proven safe.

A lower score does not necessarily mean a skill is malicious. For example, a deployment skill may legitimately use network access and shell commands. Explain the signal in context.

## Audit scope

The bundled auditor scans:

- the target `SKILL.md`;
- readable files directly under the skill's `scripts/` directory;
- readable files directly under the skill's `references/` directory.

The scanner intentionally caps scope and file size. Generated files, binaries, nested dependencies, external URLs, and runtime behavior may remain unexamined.

## Installation rule

Do not silently install a skill that has a high or critical finding. Show the relevant finding first and let the user decide whether to proceed.
