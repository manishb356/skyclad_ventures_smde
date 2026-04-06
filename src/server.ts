import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";
import "./db/client.js";
import { startQueueWorker, stopQueueWorker } from "./queue/worker.js";

const app = createApp();

app.listen(env.PORT, () => {
  startQueueWorker();
  logger.info({ port: env.PORT }, "SMDE service listening");
});

process.on("SIGINT", () => {
  stopQueueWorker();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopQueueWorker();
  process.exit(0);
});
