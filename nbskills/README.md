# nbskills

> Find the skill. Read the skill. Audit the skill. Then install it.

**nbskills** is a meta-skill and CLI for discovering, evaluating, comparing, auditing, and installing Agent Skills.

Instead of returning a pile of keyword matches, nbskills tries to answer the useful question:

> **Which skill is the best fit for this task, and should I trust it enough to install it?**

## Why nbskills?

`npx skills find` is already good at basic discovery. nbskills is designed for the step after that:

| Capability | Basic finder | nbskills |
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
npx skills add arce-star/nbskills --skill nbskills
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
node skills/nbskills/scripts/nbskills.mjs search "react performance"
node skills/nbskills/scripts/nbskills.mjs recommend "review pull requests for security"
node skills/nbskills/scripts/nbskills.mjs audit vercel-labs/agent-skills@web-design-guidelines
```

After npm publication, the intended interface is:

```bash
npx nbskills search "react performance"
```

## Commands

### Search

```bash
nbskills search "typescript testing"
nbskills search "react" --owner vercel
nbskills search "database" --json
```

### Recommend

Search, inspect available candidates, and rank them:

```bash
nbskills recommend "review pull requests for security"
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
nbskills audit owner/repo@skill
```

The static auditor looks for signals such as destructive shell commands, `curl | bash`, secret access, SSH credential access, encoded payloads, process execution, network access, and prompt-injection language.

**Audit results are heuristic, not a security certification.**

### Compare

```bash
nbskills compare owner/repo@skill-a other/repo@skill-b
```

### Project-aware discovery

```bash
cd your-project
nbskills project .
```

nbskills detects common project markers such as React, Next.js, TypeScript, Playwright, Python, FastAPI, PyTorch, Docker, Rust, Go, Terraform, and GitHub Actions, then suggests targeted skill searches.

### Install

```bash
nbskills install owner/repo@skill
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

nbskills first uses the same skills.sh search endpoint used by the public `skills` CLI. That endpoint is currently an undocumented interface, so nbskills treats it as experimental and falls back to GitHub repository search when necessary.

Set `GITHUB_TOKEN` or `GH_TOKEN` for better GitHub API rate limits. Tokens are never required by nbskills itself for public repositories.

## Repository layout

```text
nbskills/
├── README.md
├── package.json
├── skills/
│   └── nbskills/
│       ├── SKILL.md
│       ├── scripts/
│       │   ├── nbskills.mjs
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

The installable skill lives under `skills/nbskills/` rather than at repository root, so skill installers can copy the skill itself without treating the whole development repository as skill payload.

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

> Note: the `install` command delegates to the upstream `skills` CLI and therefore inherits whatever Node.js runtime requirement the current `skills` release has. Search, ranking, project detection, and static audit are implemented by nbskills itself.
