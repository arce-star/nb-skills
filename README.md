# nb-skills

<p align="center">
  <strong>Stop hunting for Agent Skills by hand.</strong><br/>
  Find, inspect, audit, rank, compare, and install the right skill for the job.
</p>

<p align="center">
  <a href="https://github.com/arce-star/nb-skills/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/arce-star/nb-skills/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node 20+" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="zero runtime dependencies" src="https://img.shields.io/badge/runtime%20dependencies-0-success">
</p>

<p align="center">
  <img src="assets/demo.svg" alt="nb-skills terminal demo" width="920">
</p>

## One command, a ranked skill stack

Point `nb-skills` at a repository:

```bash
nb-skills stack .
```

It detects the project, turns the stack into search intents, inspects candidate `SKILL.md` files, runs static security checks, ranks the candidates, and returns a small install-ready shortlist.

```text
Skill stack for: ./my-next-app

Next.js detected
  → owner/repo@react-performance — 94/100 · risk low
    npx skills add owner/repo@react-performance

Playwright detected
  → owner/repo@browser-testing — 91/100 · risk low
    npx skills add owner/repo@browser-testing

GitHub Actions detected
  → owner/repo@ci-workflows — 88/100 · risk low
    npx skills add owner/repo@ci-workflows
```

## Why nb-skills?

Finding a skill is easy. Deciding **which one fits, whether it is maintained, and whether you should trust it enough to install** is the hard part.

| Capability | Basic finder | nb-skills |
| --- | ---: | ---: |
| Search skills | Yes | Yes |
| Understand task intent | Manual | Yes |
| Inspect `SKILL.md` | Manual | Yes |
| Static security audit | No | Yes |
| Quality + relevance ranking | No | Yes |
| Compare alternatives | Manual | Yes |
| Detect skills for a codebase | No | Yes |
| Produce a ranked skill stack | No | Yes |
| Install through `skills` CLI | Yes | Yes |

## Quick start

### Install as an Agent Skill

```bash
npx skills add arce-star/nb-skills --skill nb-skills
```

Then ask your agent:

```text
Find the best skill for reviewing React performance.
Audit this skill before I install it.
Compare these candidates and pick one.
Find the best skill stack for this repository.
```

### Use the CLI

```bash
git clone https://github.com/arce-star/nb-skills.git
cd nb-skills
npm install

node skills/nb-skills/scripts/nb-skills.mjs recommend "review pull requests for security"
node skills/nb-skills/scripts/nb-skills.mjs audit owner/repo@skill
node skills/nb-skills/scripts/nb-skills.mjs stack .
```

After npm publication, the intended interface is simply:

```bash
npx nb-skills stack .
```

## Commands

```text
nb-skills search <query>                 Search candidate skills
nb-skills recommend <query>              Search + inspect + audit + rank
nb-skills audit <owner/repo@skill>       Static security and quality audit
nb-skills compare <skill> <skill> ...    Compare audited candidates
nb-skills project [path]                  Detect project → search intents
nb-skills stack [path]                    Detect → search → audit → rank winners
nb-skills install <owner/repo@skill>      Delegate installation to skills CLI
nb-skills doctor                          Check local runtime
```

## The ranking model

A recommendation is scored out of 100:

- **Relevance — 40**
- **Quality — 20**
- **Trust / security — 15**
- **Popularity — 10**
- **Freshness — 10**
- **Compatibility — 5**

Popularity is deliberately not the objective: a huge skill that poorly matches your task should lose to a smaller, better-fit skill.

## Security before install

```bash
nb-skills audit owner/repo@skill
```

The static auditor looks for destructive shell commands, `curl | bash`, secret and SSH credential access, encoded payloads, process execution, network access, and prompt-injection-like instructions.

> A clean audit is **not** a security certification. It is a transparent heuristic designed to surface risks before installation.

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

`v0.2.0` adds repository-aware skill-stack discovery. The ranking and audit rules are intentionally transparent so they can be challenged and improved.

Planned directions:

- deeper multi-source discovery;
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
