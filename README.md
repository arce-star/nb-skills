# nb-skills

> Find the skill. Read the skill. Audit the skill. Then install it.

**nb-skills** is a meta-skill and CLI for discovering, evaluating, comparing, auditing, and installing Agent Skills.

Instead of returning a pile of keyword matches, nb-skills tries to answer the useful question:

> **Which skill is the best fit for this task, and should I trust it enough to install it?**

## Why nb-skills?

`npx skills find` is already good at basic discovery. nb-skills is designed for the step after that:

| Capability | Basic finder | nb-skills |
| --- | ---: | ---: |
| Search skills | Yes | Yes |
| Intent-oriented queries | Manual | Yes |
| Inspect `SKILL.md` | Manual | Yes |
| Static security audit | No | Yes |
| Quality scoring | No | Yes |
| Relevance ranking | Basic | Yes |
| Compare alternatives | Manual | Yes |
| Project-aware discovery | No | Yes |
| Install through `skills` CLI | Yes | Yes |

## Quick start

### Install as an Agent Skill

```bash
npx skills add arce-star/nb-skills --skill nb-skills
```

Then ask your agent things like:

```text
Find the best skill for reviewing React performance.
Audit this skill before I install it.
What skills would help this repository?
Compare these three skills and pick one.
```

### Use the CLI

Clone the repository and run directly with Node.js 20+:

```bash
node skills/nb-skills/scripts/nb-skills.mjs search "react performance"
node skills/nb-skills/scripts/nb-skills.mjs recommend "review pull requests for security"
node skills/nb-skills/scripts/nb-skills.mjs audit vercel-labs/agent-skills@web-design-guidelines
```

After npm publication, the intended interface is:

```bash
npx nb-skills search "react performance"
```

## Commands

### Search

```bash
nb-skills search "typescript testing"
nb-skills search "react" --owner vercel
nb-skills search "database" --json
```

### Recommend

Search, inspect available candidates, and rank them:

```bash
nb-skills recommend "review pull requests for security"
```

The 100-point score weights:

- relevance — 40
- quality — 20
- trust/security — 15
- popularity — 10
- freshness — 10
- compatibility — 5

### Audit

```bash
nb-skills audit owner/repo@skill
```

The static auditor looks for signals such as destructive shell commands, `curl | bash`, secret access, SSH credential access, encoded payloads, process execution, network access, and prompt-injection language.

**Audit results are heuristic, not a security certification.**

### Compare

```bash
nb-skills compare owner/repo@skill-a other/repo@skill-b
```

### Project-aware discovery

```bash
cd your-project
nb-skills project .
```

nb-skills detects common project markers such as React, Next.js, TypeScript, Playwright, Python, FastAPI, PyTorch, Docker, Rust, Go, Terraform, and GitHub Actions, then suggests targeted skill searches.

### Install

```bash
nb-skills install owner/repo@skill
```

Installation delegates to the `skills` CLI rather than inventing another installer.

## How it works

```text
User task
   ↓
Intent / project detection
   ↓
Skill discovery
   ↓
SKILL.md inspection
   ↓
Static audit
   ↓
Relevance + quality + trust ranking
   ↓
Shortlist / compare
   ↓
User-approved install
```

## Discovery backends

nb-skills first uses the same skills.sh search endpoint used by the public `skills` CLI. That endpoint is currently an undocumented interface, so nb-skills treats it as experimental and falls back to GitHub repository search when necessary.

Set `GITHUB_TOKEN` or `GH_TOKEN` for better GitHub API rate limits. Tokens are never required by nb-skills itself for public repositories.

## Repository layout

```text
nb-skills/
├── README.md
├── package.json
├── skills/
│   └── nb-skills/
│       ├── SKILL.md
│       ├── scripts/
│       │   ├── nb-skills.mjs
│       │   ├── search.mjs
│       │   ├── audit.mjs
│       │   ├── github.mjs
│       │   ├── core.mjs
│       │   └── validate.mjs
│       └── references/
│           ├── ranking.md
│           ├── security.md
│           └── sources.md
└── tests/
```

The installable skill lives under `skills/nb-skills/` rather than at repository root, so skill installers can copy the skill itself without treating the whole development repository as skill payload.

## Design principles

1. **Relevance beats stars.** Popularity is useful evidence, not the objective.
2. **Inspect before recommending.** Descriptions are advertising; `SKILL.md` is the product.
3. **Audit before installing.** Agent instructions and bundled scripts are part of the supply chain.
4. **Graceful degradation.** Search backends fail; the tool should still be useful.
5. **Small shortlists.** Three reasoned recommendations are usually better than fifty links.
6. **No silent installs.** Discovery and installation are separate decisions.

## Status

`v0.1.0` is an MVP. The ranking and audit rules are intentionally transparent so they can be challenged and improved.

Planned directions:

- deeper multi-source discovery;
- repository-level skill stack recommendations;
- richer compatibility detection;
- transitive script/reference inspection;
- cached search and audit results;
- a machine-readable registry adapter interface;
- GitHub Action for auditing skill changes in pull requests.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

> Note: the `install` command delegates to the upstream `skills` CLI and therefore inherits whatever Node.js runtime requirement the current `skills` release has. Search, ranking, project detection, and static audit are implemented by nb-skills itself.
