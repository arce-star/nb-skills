# Discovery sources

nb-skills uses a provider adapter layer. Structured registries are queried independently, normalized to a common result shape, then merged with round-robin provider diversity and GitHub-identity deduplication.

## Default providers

### skills.sh

Endpoint used by the public skills ecosystem:

`GET https://skills.sh/api/search?q=<query>&limit=<n>`

As of October 2026, this endpoint is used by the public `skills` CLI but is not documented as a stable public API contract. nb-skills therefore treats it as experimental and isolates failures.

Typical normalized fields:

- skill name;
- GitHub `owner/repo` source;
- install count;
- description when available.

### SkillsMP

Documented REST endpoint:

`GET https://skillsmp.com/api/v1/skills/search?q=<query>&page=1&limit=<n>&sortBy=stars`

Anonymous keyword search is currently limited to 50 requests/day and 10 requests/minute. `SKILLSMP_API_KEY` raises the documented limit to 500 requests/day and 30 requests/minute.

SkillsMP results can expose the original GitHub URL. nb-skills converts those URLs into `owner/repo@skill` identities so the existing static auditor can inspect the upstream source.

Environment variables:

- `SKILLSMP_API_KEY` — optional bearer token;
- `SKILLSMP_API_URL` — override the default base URL.

### ClawHub

Documented public search endpoint:

`GET https://clawhub.ai/api/v1/search?q=<query>&nonSuspiciousOnly=true`

ClawHub explicitly permits third-party catalogs to reuse public read APIs subject to rate limits. Its search supports registry-native semantic/vector retrieval and returns owner, slug, summary, relevance score, and update metadata.

A ClawHub search result does not always include an upstream GitHub repository. When no GitHub source is available, nb-skills marks the candidate as `registryOnly`, does not fabricate a static audit, and prints the registry-native installation command:

```bash
openclaw skills install @owner/slug
```

Environment variable:

- `CLAWHUB_API_URL` — override the default base URL.

## Provider selection

Default:

```text
skills.sh,skillsmp,clawhub
```

Override per command:

```bash
nb-skills search "react performance" --providers skills.sh,skillsmp
```

Or globally:

```bash
NBSKILLS_PROVIDERS=skills.sh,clawhub nb-skills search "react performance"
```

One provider failing, timing out, or returning HTTP 429 does not discard successful results from the other providers. Provider status is included in JSON output.

## Deduplication

GitHub-backed results use this canonical identity:

```text
owner/repo@skill
```

If multiple registries point to the same identity, nb-skills merges them and preserves all discovery sources in `providers`. Popularity and freshness metadata are merged conservatively instead of double-counting the same skill.

Registry-only entries use a provider-specific identity and are not falsely merged into GitHub skills.

## GitHub fallback

If all configured structured providers fail or return no usable candidates, nb-skills searches GitHub repositories for the task terms plus Agent Skills context. This is a last-resort fallback with lower skill-level precision because repository search is not a skill registry.

Set `GITHUB_TOKEN` or `GH_TOKEN` for better GitHub API rate limits and metadata enrichment.

## Search limitations

Do not assume:

- every installable skill is indexed by every registry;
- registry popularity implies correctness;
- repository stars belong to one specific skill;
- a registry security flag replaces source inspection;
- a valid `SKILL.md` is trustworthy;
- registry-only results have passed the built-in GitHub static auditor.

Discovery is the first stage. Inspection, audit, ranking, and installation remain separate decisions.
