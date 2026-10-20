# Verification evidence

Executed on 20 October 2026 in the attached Linux cloud environment. Native toolchain: Node 24.19.0, npm 11.9.0, Python 3.12.14, MongoDB 7. Docker images also built and executed using their declared Node/Python bases. Browser automation used system Chromium through Playwright 1.61.0.

## Executed checks

| Check                                 | Result                          | Evidence and scope                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend production build             | Passed                          | TypeScript compilation and Vite production assets; routes split into lazy bundles                                                                                                                                                                                                                                                       |
| Backend build                         | Passed                          | TypeScript compilation to executable ESM                                                                                                                                                                                                                                                                                                |
| `npm run lint`                        | Passed                          | Both projects run TypeScript static checks; this command does not claim a separate ESLint rule suite                                                                                                                                                                                                                                    |
| Backend integration suite             | **12 passed, 0 failed/skipped** | Actual isolated MongoDB test database plus running FastAPI; auth, four roles, CRUD, submission, genuine inference, SHAP-bearing persisted outputs, concurrent assessment locking, reasoned decisions, invalidation, scenarios, analytics, preview/mapping/upload, CSV partial failure, XLSX parsing, alerts, exports, policy and logout |
| Frontend suite                        | **8 passed, 0 failed/skipped**  | Form schema/submit behavior, invalid input, financial math and CSV parsing                                                                                                                                                                                                                                                              |
| Python suite                          | **28 passed, 0 failed/skipped** | EMI including zero/tiny interest, ratios, invalid schemas, model loading/checksum, prediction bounds, genuine SHAP additivity, partial batch errors, service auth, unavailable model, reference distribution and PSI checks                                                                                                             |
| Native cross-service/browser suite    | **9 passed**                    | Actual API persistence, scenario/export, role restrictions/logout, batch/alerts; browser all navigation, theme and 1366×768 / 1440×900 / 390×844 viewports, create→submit→assess→explain→PDF, scenario sliders→save and CSV preview→process→download                                                                                    |
| Container cross-service/browser suite | **9 passed**                    | Same workflows through nginx/Express/FastAPI/MongoDB rather than Vite; test-only loopback port 3002 keeps native port 3001 available                                                                                                                                                                                                    |
| Accessibility within browser suite    | Passed                          | axe WCAG A/AA automated checks on login and light/dark Command Center, including SVG names and text contrast; this is not a manual accessibility certification                                                                                                                                                                          |
| Compose startup                       | Passed                          | All four built images start and report healthy; database is internal, only frontend published                                                                                                                                                                                                                                           |
| Outage/restart recovery               | Passed                          | ML stopped deliberately: reassessment returned503, no fabricated probability, prior assessment preserved. MongoDB, ML, backend and frontend restarted; record identifier, saved assessment, probability and authenticated access retained                                                                                               |
| npm audits                            | Zero known findings             | Root tooling, complete backend dependency tree, complete frontend dependency tree at time of execution                                                                                                                                                                                                                                  |
| Python lock audit                     | No known vulnerabilities        | `pip-audit 2.10.1` against the complete pinned dependency closure                                                                                                                                                                                                                                                                       |
| Configuration repeatability           | Passed                          | Initializer preserves existing credentials and configuration; seeding skips existing demonstration identifiers; native `npm run dev` orchestration stopped/restarted successfully                                                                                                                                                       |
| Screenshots                           | Captured                        | Five actual connected pages/themes in `docs/screenshots/`; calibration figure generated from held-out synthetic evaluation                                                                                                                                                                                                              |

There are **57 unique suite checks** (12 + 8 + 28 + 9); the 9 cross-service checks were additionally repeated against containers. The recovery script adds a separate operational smoke check. No zero-test run is counted as validation.

## Commands

From the repository root with seeded native services running:

```bash
npm run build
npm run lint
npm test
(cd ml-service && .venv/bin/python -m pytest -q)
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm run audit:dependencies
npm audit
ml-service/.venv/bin/python -m pip_audit --cache-dir /workspace/.cache/pip-audit -r ml-service/requirements.lock.txt
```

For ordinary local container validation after seeding, with a Playwright browser installed:

```bash
npm run test:e2e
node scripts/verify-container-recovery.mjs docker-compose.yml
```

The recovery command stops and restarts the specified local demonstration services. Never target production. In cloud testing, `E2E_BASE_URL=http://localhost:3002` and a temporary Compose port/CORS override were used to keep the native stack running independently.

## Issues found and corrected

Initial build/startup failed because the repository had no source. During implementation, integration tests and review caught template-only startup, mismatched exposure fields, missing scenario identities, incorrect DTI wording, lifecycle/role controls, cookie security in local containers, model readiness semantics, non-root Docker file permissions, ambiguous navigation names, insufficient text contrast and unlabeled chart sectors. Corrected cases were rerun. The final evidence above describes completed passing runs, not the earlier failures.

Initial proxy browser download was blocked; the existing system Chromium was used. Docker build containers needed the platform's DNS mapping and trusted CA bundle. `node scripts/cloud-container-build.mjs` provides an optional adapter using a BuildKit secret, preserving TLS verification and excluding credential values from committed configuration. Ordinary laptop builds use `docker compose build`.

## Remaining limits and unexecuted claims

- Windows PowerShell and public cloud commands are documented but were **not executed on Windows or a public deployment**. The GitHub Actions workflow was added and its constituent commands tested locally; no remote Actions run is claimed.
- Model evaluation is strictly synthetic: 2,400 generated records, seeded 60/20/20 splits and three compared candidates. Selected Logistic Regression held-out ROC-AUC **0.8228**, PR-AUC **0.7045**, Brier **0.1395**. These are not real borrower default accuracy claims.
- UCI provenance research was attempted but its metadata endpoint was proxy-blocked. No external dataset was imported or falsely declared license-verified. The model uses the documented generated dataset only.
- Current model/API financial inputs support INR only. No FX conversion, official credit bureau connection or validated real-world fairness claim exists.
- Standalone MongoDB provides per-document atomicity plus assessment locking/recovery. Cross-document transactions, a distributed worker queue and tamper-proof audit storage are not implemented. See architecture and security notes.
- Public production TLS, managed MongoDB authentication, external penetration testing, regulatory validation, multi-tenant isolation, MFA/SSO, scheduled reports and real-world model validation remain outside this research implementation.
- Some upstream Python libraries emit deprecation warnings. All 28 tests executed and passed; warnings are not mislabeled as test failures or suppressed by changing assertions.
- Changes are committed locally on `revamp/finrisk-ai-v2`. No push, public deployment or fresh-task restoration is claimed by these tests.
