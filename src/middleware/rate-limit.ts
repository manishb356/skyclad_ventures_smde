import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError } from "../types/errors.js";

const WINDOW_MS = 60_000;

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function resolveIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  }
  return req.ip || "unknown";
}

export function extractRateLimit(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const ip = resolveIp(req);
  const now = Date.now();
  const existing = buckets.get(ip);

  if (!existing || now >= existing.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (existing.count >= env.RATE_LIMIT_PER_MINUTE) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many extraction requests. Please retry later.",
      { retryAfterMs: existing.resetAt - now },
    );
  }

  existing.count += 1;
  next();
}
