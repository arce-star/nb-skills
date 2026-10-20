# Contributing to nb-skills

Thanks for improving nb-skills.

## Development

Requirements: Node.js 20 or newer.

```bash
npm test
npm run validate
npm run check
```

The project intentionally has no runtime npm dependencies in v0.1.0.

## Pull requests

Keep changes focused. For ranking or audit rule changes, include tests that show both the intended match and at least one likely false-positive case.

Do not add a discovery source that requires sending user code, repository contents, or secrets to a third party without documenting that behavior clearly.

## Security rules

Audit rules should be explainable. Prefer a visible heuristic with known limitations over an opaque score that users cannot reason about.
