# AGENTS.md

## Project purpose

nb-skills is a meta-skill and CLI for finding, evaluating, auditing, comparing, and installing Agent Skills.

## Development rules

- Keep the installable skill self-contained under `skills/nb-skills/`.
- Do not move `SKILL.md` to the repository root.
- Keep runtime dependencies at zero unless a dependency clearly improves reliability enough to justify the supply-chain cost.
- Ranking changes need tests.
- Security audit rules need tests for intended detections and likely false positives.
- Do not represent heuristic audit results as security certification.
- Search providers must fail gracefully.

## Checks

Run before committing:

```bash
npm run check
```
