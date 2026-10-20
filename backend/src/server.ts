import { app, recoverBatchJobs } from "./app.js";
import { connect } from "./models.js";
import { recoverApplicationAssessments } from "./services.js";
import { config, jwtSecret, logger } from "./config.js";
jwtSecret();
await connect(config.mongo);
await recoverBatchJobs();
await recoverApplicationAssessments();
const server = app.listen(config.port, "0.0.0.0", () =>
  logger.info({ port: config.port }, "FinRisk API started"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      const mongoose = await import("mongoose");
      await mongoose.default.disconnect();
      process.exit(0);
    }),
  );
