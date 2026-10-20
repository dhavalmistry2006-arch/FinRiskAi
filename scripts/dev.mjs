import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import net from "node:net";
const windows = process.platform === "win32";
const npm = windows ? "npm.cmd" : "npm";
const python = resolve(
  "ml-service",
  ".venv",
  windows ? "Scripts/python.exe" : "bin/python",
);
if (!existsSync(python)) {
  console.error(
    "Create ml-service/.venv, install requirements and train the model first. See README.",
  );
  process.exit(1);
}
for (const port of [8000, 5000, 3001]) {
  const busy = await new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
  if (busy) {
    console.error(
      `Port ${port} is already in use. Stop the previous development services before starting a second stack.`,
    );
    process.exit(1);
  }
}
function start(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: windows,
    detached: !windows,
  });
}
const processes = [
  start(
    python,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    "ml-service",
  ),
  start(npm, ["run", "dev"], "backend"),
  start(npm, ["run", "dev"], "frontend"),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const p of processes) {
    try {
      if (windows)
        spawn("taskkill", ["/pid", String(p.pid), "/t", "/f"], {
          stdio: "ignore",
        });
      else if (p.pid) process.kill(-p.pid, "SIGTERM");
    } catch {}
  }
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
processes.forEach((p) => {
  p.on("error", (e) => {
    console.error(e);
    stop(1);
  });
  p.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
});
