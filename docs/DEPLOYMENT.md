# Deployment

## Local Docker

Run `node scripts/init-demo.mjs`, `docker compose up --build -d`, then `docker compose exec backend node dist/seed.js`. The first ML image build trains a reproducible synthetic model. Later starts load the artifact; no request triggers training. Health checks gate backend startup on Mongo and ML availability, and frontend startup on backend readiness.

Services communicate on private Compose networks. Only nginx is published at `127.0.0.1:3001`. MongoDB data lives in a named volume. Credentials come from ignored root `.env`; native backend processes load `backend/.env`. Never copy host `.env`, Python venvs or node_modules into images. Container `.dockerignore` rules matter because service builds use different context roots.

Use `docker compose logs --tail=100`, `docker compose ps`, and a local request to the frontend/API health endpoint to diagnose readiness. A running container alone is insufficient evidence.

## Cloud approach

Use a container host supporting long-lived services (for example a small Linux VM or managed container platform), a private authenticated managed MongoDB deployment, and an HTTPS reverse proxy/load balancer. A static-only host can serve the built SPA only if `/api/v1` is proxied to Express. FastAPI requires a Python process and model artifacts; static hosting or arbitrary short-lived serverless endpoints are not substitutes.

1. Build and test images in CI. Review dataset provenance, model card and exact dependency audit findings.
2. Store signing secret, database credentials, optional internal ML key and seed password in the host's secret manager. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, and `CORS_ORIGIN` to the exact HTTPS frontend origin.
3. Put Express and FastAPI behind private networking; never expose MongoDB publicly. Add authentication to the database; the isolated unauthenticated local image is not a production template.
4. Terminate TLS and forward `/api/v1` to Express. Configure proxy trust narrowly if using trusted forwarding headers for rate limiting; do not blindly trust all clients.
5. Train offline, preserve artifact metadata and SHA, then deploy a reviewed artifact. Do not auto-retrain from a public endpoint. Tune CPU and BLAS threads for the host.
6. Verify health, login, persisted CRUD, inference/explanation, review permissions, uploads and all export formats through the actual production origin.
7. Test MongoDB backups and restoration, log retention and dependency alerts. A replica set plus transaction/outbox changes is required before claiming cross-document atomicity.

## Windows

Docker Desktop must run Linux containers. README contains exact PowerShell commands for a native frontend/backend/Python setup using a loopback Mongo container. Native Python requires Python 3.12; Node 24 is validated. No WSL-specific command is required. Avoid re-running `docker run --name finrisk-dev-db` if that container already exists; use `docker start finrisk-dev-db` instead.

## Not claimed

No public deployment, DNS setup, production TLS, cloud secret provisioning, production database validation or Windows execution is performed merely by saving these instructions. See `TESTING.md` for evidence from the current Linux environment.

## Cloud build proxy adapter

In this onboarding environment the Docker daemon's build network does not inherit the task's proxy DNS/trust configuration. The optional command below derives proxy hostname mappings from existing environment settings and mounts the trusted system CA bundle as an ephemeral BuildKit secret:

```bash
node scripts/cloud-container-build.mjs
```

It writes only an ignored `.runtime/cloud-build.override.json` containing host mappings and the CA path. Proxy credential values are neither printed nor written to that file. Package checksum and TLS verification remain enabled; CA contents are not copied into the final image. This adapter was tested successfully; it is unnecessary on a normal Docker Desktop network.
