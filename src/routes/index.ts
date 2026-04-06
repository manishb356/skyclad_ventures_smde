import { Router } from "express";
import { extractRouter } from "./extract.js";
import { jobsRouter } from "./jobs.js";
import { sessionsRouter } from "./sessions.js";

export const apiRouter = Router();

apiRouter.use(extractRouter);
apiRouter.use(jobsRouter);
apiRouter.use(sessionsRouter);

apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    version: "1.0.0",
    uptime: Math.round(process.uptime()),
    dependencies: {
      database: "UNKNOWN",
      llmProvider: "UNKNOWN",
      queue: "UNKNOWN",
    },
    timestamp: new Date().toISOString(),
  });
});
