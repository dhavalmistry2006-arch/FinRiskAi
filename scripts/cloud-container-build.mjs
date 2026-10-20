// Optional cloud/proxy build adapter. Normal laptop builds use docker compose build.
import { lookup } from "node:dns/promises";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
const proxies = [process.env.HTTP_PROXY, process.env.HTTPS_PROXY].filter(
  Boolean,
);
if (!proxies.length)
  throw new Error("No cloud proxy configured. Use docker compose build.");
const hosts = [...new Set(proxies.map((value) => new URL(value).hostname))];
const mappings = await Promise.all(
  hosts.map(
    async (host) => `${host}:${(await lookup(host, { family: 4 })).address}`,
  ),
);
const ca = process.env.SSL_CERT_FILE || "/etc/ssl/certs/ca-certificates.crt";
if (!existsSync(ca))
  throw new Error(
    "A trusted system CA bundle is required; TLS verification must remain enabled.",
  );
mkdirSync(".runtime", { recursive: true });
const override = resolve(".runtime/cloud-build.override.json");
writeFileSync(
  override,
  JSON.stringify(
    {
      services: Object.fromEntries(
        ["backend", "frontend", "ml-service"].map((service) => [
          service,
          {
            build: {
              network: "host",
              extra_hosts: mappings,
              args: ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"],
              secrets: ["build_ca"],
            },
          },
        ]),
      ),
      secrets: { build_ca: { file: ca } },
    },
    null,
    2,
  ),
);
const dockerConfig = process.env.DOCKER_CONFIG || resolve(".runtime/docker");
mkdirSync(dockerConfig, { recursive: true });
const child = spawn(
  "docker",
  [
    "compose",
    "-f",
    "docker-compose.yml",
    "-f",
    override,
    "build",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, DOCKER_CONFIG: dockerConfig } },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
