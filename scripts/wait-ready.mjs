const url = process.argv[2];
if (!url) throw new Error("Pass a health URL");
let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
if (!ready) {
  console.error(`Service not ready: ${url}`);
  process.exit(1);
}
console.log(`Ready: ${url}`);
