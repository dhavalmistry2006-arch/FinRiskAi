# Quick start

Follow [README.md](README.md). For the local container workflow:

```powershell
node scripts/init-demo.mjs
docker compose up --build -d
docker compose exec backend node dist/seed.js
```

Use your generated password from ignored `.env` with `admin@finrisk.demo`. The application is a synthetic-data research demonstrator. Read the model card before interpreting outputs.
