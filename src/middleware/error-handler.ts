import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../types/errors.js";

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return new AppError(413, "FILE_TOO_LARGE", "File exceeds 10MB.");
  }

  if (error instanceof Error) {
    return new AppError(500, "INTERNAL_ERROR", error.message);
  }

  return new AppError(500, "INTERNAL_ERROR", "Unexpected server error.");
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError = toAppError(error);

  req.log?.error({ err: error }, "request failed");

  if (appError.code === "RATE_LIMITED" && appError.retryAfterMs) {
    res.setHeader("Retry-After", Math.ceil(appError.retryAfterMs / 1000));
  }

  res.status(appError.statusCode).json({
    error: appError.code,
    message: appError.message || "Unexpected server error.",
    extractionId: appError.extractionId,
    retryAfterMs: appError.retryAfterMs,
    ...(env.NODE_ENV === "development" && {
      requestId: req.id,
    }),
  });
}
