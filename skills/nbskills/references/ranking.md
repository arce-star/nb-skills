# Ranking model

nbskills ranks for usefulness, not popularity alone.

## Default score

The default score is 100 points:

- Relevance: 40
- Quality: 20
- Trust/security: 15
- Popularity: 10
- Freshness: 10
- Compatibility: 5

A candidate that is extremely popular but weakly relevant should lose to a precise, well-maintained match.

## Relevance

Relevance measures overlap between the user's intent and the candidate's name, source, and available description. Agents should improve search quality by expanding vague requests into task-oriented phrases before invoking the CLI.

Examples:

- "make my site faster" -> `react performance`, `nextjs performance`, or the detected framework.
- "review PRs" -> `pull request review`, then add `security` only if the user actually wants security review.

## Quality

The static quality heuristic rewards a valid manifest, a substantive description, clear workflow/instruction sections, examples, failure handling, and useful bundled resources.

It is intentionally conservative. A high score means the skill is structured well, not that its domain advice is correct.

## Trust/security

The trust component is derived from the static security audit. High-risk patterns reduce the score. The audit is advisory and should never be represented as a formal security certification.

## Popularity

Install count is log-scaled so that popularity helps establish social proof without dominating task fit.

GitHub stars may be displayed as context but are not currently a direct score component because repository-level stars can represent many skills or unrelated project value.

## Freshness

Recent repository activity receives more credit. Freshness matters most for fast-changing domains such as framework tooling, APIs, and deployment platforms.

## Compatibility

Compatibility rewards explicit, understandable runtime requirements. Lack of compatibility metadata is not an automatic failure because many valid skills are instruction-only.

## Tie-breaking

When two candidates score similarly, prefer in this order:

1. better task fit;
2. lower security risk;
3. clearer and smaller scope;
4. more recent maintenance;
5. stronger ecosystem adoption.
