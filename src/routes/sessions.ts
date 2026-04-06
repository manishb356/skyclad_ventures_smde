import { Router } from "express";
import { extractionRepo, jobRepo, sessionRepo, validationRepo } from "../db/client.js";
import { buildSessionReport } from "../services/report.service.js";
import { validateSessionDocuments } from "../services/validation.service.js";
import { AppError } from "../types/errors.js";

function ensureSessionExists(sessionId: string): void {
  const session = sessionRepo.findById(sessionId);
  if (!session) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Session ID does not exist.");
  }
}

function parseArray(value: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

function inferDetectedRole(
  values: Array<string | null>,
): "DECK" | "ENGINE" | "BOTH" | "N/A" {
  const roles = new Set(values.filter((v): v is string => Boolean(v)));
  if (roles.has("BOTH")) return "BOTH";
  if (roles.has("DECK") && roles.has("ENGINE")) return "BOTH";
  if (roles.has("DECK")) return "DECK";
  if (roles.has("ENGINE")) return "ENGINE";
  return "N/A";
}

function deriveOverallHealth(
  docs: Array<{ isExpired: boolean; flags: Array<Record<string, unknown>> }>,
): "OK" | "WARN" | "CRITICAL" {
  const hasCriticalFlag = docs.some((doc) =>
    doc.flags.some((flag) => String(flag.severity).toUpperCase() === "CRITICAL"),
  );
  if (hasCriticalFlag || docs.some((doc) => doc.isExpired)) {
    return "CRITICAL";
  }

  const hasWarnFlag = docs.some((doc) =>
    doc.flags.some((flag) => {
      const severity = String(flag.severity).toUpperCase();
      return severity === "HIGH" || severity === "MEDIUM";
    }),
  );
  return hasWarnFlag ? "WARN" : "OK";
}

export const sessionsRouter = Router();

sessionsRouter.get("/sessions/:sessionId", (req, res, next) => {
  try {
    const { sessionId } = req.params;
    ensureSessionExists(sessionId);
    const extractions = extractionRepo.listBySession(sessionId);
    const pendingJobs = jobRepo.listPendingBySession(sessionId);

    const documents = extractions.map((item) => {
      const flags = parseArray(item.flagsJson);
      const criticalFlagCount = flags.filter(
        (flag) => String(flag.severity).toUpperCase() === "CRITICAL",
      ).length;
      return {
        id: item.id,
        fileName: item.fileName,
        documentType: item.documentType,
        applicableRole: item.applicableRole,
        holderName: item.holderName,
        confidence: item.confidence,
        isExpired: Boolean(item.isExpired),
        flagCount: flags.length,
        criticalFlagCount,
        createdAt: item.createdAt,
      };
    });

    const role = inferDetectedRole(extractions.map((item) => item.applicableRole));
    const overallHealth = deriveOverallHealth(
      extractions.map((item) => ({
        isExpired: Boolean(item.isExpired),
        flags: parseArray(item.flagsJson),
      })),
    );

    res.status(200).json({
      sessionId,
      documentCount: documents.length,
      detectedRole: role,
      overallHealth,
      documents,
      pendingJobs: pendingJobs.map((job) => ({
        jobId: job.id,
        status: job.status,
        fileName: job.fileName,
        queuedAt: job.queuedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.post("/sessions/:sessionId/validate", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    ensureSessionExists(sessionId);
    const extractions = extractionRepo.listBySession(sessionId);
    if (extractions.length < 2) {
      throw new AppError(
        400,
        "INSUFFICIENT_DOCUMENTS",
        "At least two documents are required for session validation.",
      );
    }

    const records = extractions.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      documentType: item.documentType,
      documentName: item.documentName,
      category: item.category,
      applicableRole: item.applicableRole,
      confidence: item.confidence,
      holderName: item.holderName,
      dateOfBirth: item.dateOfBirth,
      sirbNumber: item.sirbNumber,
      passportNumber: item.passportNumber,
      fields: parseArray(item.fieldsJson),
      validity: JSON.parse(item.validityJson),
      medicalData: JSON.parse(item.medicalDataJson),
      flags: parseArray(item.flagsJson),
      summary: item.summary,
    }));

    const result = await validateSessionDocuments(sessionId, records);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

sessionsRouter.get("/sessions/:sessionId/report", (req, res, next) => {
  try {
    const { sessionId } = req.params;
    ensureSessionExists(sessionId);

    const extractions = extractionRepo.listBySession(sessionId);
    const pendingJobs = jobRepo.listPendingBySession(sessionId);
    const latestValidation = validationRepo.findLatestBySession(sessionId);

    const report = buildSessionReport({
      sessionId,
      extractions,
      pendingJobs,
      latestValidation,
    });
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
});
