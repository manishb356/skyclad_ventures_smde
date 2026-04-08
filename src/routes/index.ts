import { Router } from "express";
import { db } from "../db/client.js";
import { getQueueWorkerState } from "../queue/worker.js";
import { createLlmClient } from "../services/llm-client.service.js";
import { extractRouter } from "./extract.js";
import { jobsRouter } from "./jobs.js";
import { sessionsRouter } from "./sessions.js";

export const apiRouter = Router();

apiRouter.use(extractRouter);
apiRouter.use(jobsRouter);
apiRouter.use(sessionsRouter);

apiRouter.get("/health", async (_req, res) => {
  const dbHealthy = (() => {
    try {
      db.prepare("SELECT 1 as ok").get();
      return true;
    } catch {
      return false;
    }
  })();

  const llmHealthy = await createLlmClient().healthCheck();
  const queueState = getQueueWorkerState();
  const queueHealthy = queueState.isRunning;
  const status = dbHealthy && llmHealthy && queueHealthy ? "OK" : "DEGRADED";

  res.json({
    status,
    version: "1.0.0",
    uptime: Math.round(process.uptime()),
    dependencies: {
      database: dbHealthy ? "OK" : "ERROR",
      llmProvider: llmHealthy ? "OK" : "ERROR",
      queue: queueHealthy ? "OK" : "ERROR",
    },
    timestamp: new Date().toISOString(),
  });
});
