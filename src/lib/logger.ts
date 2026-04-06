import pino from "pino";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: ["req.headers.authorization", "headers.authorization", "*.apiKey"],
    remove: true,
  },
});

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const header = req.headers["x-request-id"];
    const requestId = typeof header === "string" ? header : randomUUID();
    res.setHeader("x-request-id", requestId);
    return requestId;
  },
});
