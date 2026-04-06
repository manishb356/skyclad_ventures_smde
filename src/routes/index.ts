import { Router } from "express";

export const apiRouter = Router();

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
