# Recovery audit — FinRisk AI 2.0

Baseline: `dd3964aaed6895831754df68d21ff41074dc6e39`, audited 20 October 2026.

The requested branch is `revamp/finrisk-ai-v2`. The remote main ref was checked with the existing GitHub HTTPS authentication. Both available commits contain documentation and configuration only. Neither contains frontend source, backend source, tests, model artifacts, or a database schema to recover. There were no local modifications before work began.

## Findings

- **Documentation disagreed with the checkout.** README advertised an Express API, MongoDB persistence, React pages, and tests that did not exist. Its linked backend documentation and screenshots were absent.
- **Build and development startup failed.** Both stopped at TanStack Start's missing `src/router` entry. Existing lint and TypeScript checks only examined configuration files and were not evidence of application readiness.
- **No business logic could be reused.** React, TypeScript, Vite, Tailwind, Radix, Zod, React Hook Form, Recharts, TanStack Query and Lucide choices are useful. The empty TanStack Start/Cloudflare server scaffold is replaced by an explicit Vite SPA plus Express and FastAPI services.
- **Dependency compatibility.** README's Node 14/18 guidance is incompatible with the installed Vite 7 toolchain; development is validated on Node 24, Python 3.12. Component dependencies are installed from explicit manifests and lockfiles. Vulnerability check results are recorded separately rather than claimed from dependency installation.
- **Configuration exposure.** A tracked `.env` contained only a localhost frontend API URL; no credential value was detected in that file. It is removed from the index and ignored. Historical commits still contain it. Rotate any credentials if future private review identifies historical secrets; removing a tracked file does not erase history.
- **Infrastructure was incomplete.** Compose referenced an absent backend and exposed MongoDB to the host. The replacement uses internal service networking and a persistent volume, with MongoDB not published by default.
- **Authentication, validation, integration and deployment readiness did not exist.** These are new implementation work, not recovered capabilities.

## Scope and responsibility

This is an educational, synthetic-data credit-risk research system. Model estimates do not independently validate real borrower default probabilities or authorize lending decisions. Human reviewer decisions and reasons are stored separately from model assessments. Model provenance, evaluation and limitations are documented in the model card. No paid LLM or external personal-data sharing is required.
