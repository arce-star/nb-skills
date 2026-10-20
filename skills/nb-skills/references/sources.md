# Discovery sources

## skills.sh

The primary discovery backend mirrors the endpoint used by the `skills` CLI:

`GET https://skills.sh/api/search?q=<query>&limit=<n>`

As of October 2026, this endpoint is used by the public `npx skills find` implementation but is not documented as a stable public API contract. nb-skills therefore treats it as experimental and must degrade gracefully if it changes or becomes unavailable.

Expected fields include:

- `id`
- `name`
- `source`
- `installs`

## GitHub fallback

If the skills.sh search endpoint fails, nb-skills searches GitHub repositories for the task terms plus Agent Skills context. This fallback has lower recall because repository search is not equivalent to a skill-level index.

GitHub unauthenticated API limits are low. Set `GITHUB_TOKEN` or `GH_TOKEN` when making many requests.

## Source normalization

Use `owner/repo@skill` as the preferred human-readable identity when a concrete skill is known. This maps cleanly to the ecosystem installer:

```bash
npx skills add owner/repo@skill
```

## Search limitations

Do not assume:

- every installable skill is indexed by skills.sh;
- install count implies correctness;
- repository stars belong to one specific skill;
- a live detail page means search indexing is complete;
- a valid `SKILL.md` is trustworthy.

Discovery is the first stage. Inspection and ranking are separate stages.
