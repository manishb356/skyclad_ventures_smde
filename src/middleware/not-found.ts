import type { NextFunction, Request, Response } from "express";
import { AppError } from "../types/errors.js";

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    new AppError(404, "INTERNAL_ERROR", "The requested route was not found."),
  );
}
