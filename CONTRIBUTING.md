# Contributing

Use Node 24 and Python 3.12. Follow README setup, work on a branch, and keep secrets out of Git. Run backend/frontend type checks, unit/integration tests, Python tests and the relevant end-to-end workflows before proposing a change. Preserve API contracts, server-side authorization and synthetic-data labeling.

Model changes require explicit operator review: record seed, dataset provenance, feature definitions, held-out metrics and limitations. Never train during an inference request. Financial formulas and state transitions need meaningful boundary tests. A new feature must include functional loading, error and empty states rather than simulated results.
