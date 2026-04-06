import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { extractionRepo, jobRepo, sessionRepo } from "../db/client.js";
import { sha256FromBuffer } from "../lib/hash.js";
import { AppError } from "../types/errors.js";
import { extractDocument } from "../services/extraction.service.js";

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_BYTES,
  },
});

function ensureSession(sessionId?: string): string {
  if (!sessionId) {
    const createdId = randomUUID();
    sessionRepo.create(createdId);
    return createdId;
  }

  const existing = sessionRepo.findById(sessionId);
  if (!existing) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Session ID does not exist.");
  }

  return sessionId;
}

function toExtractionResponse(record: ReturnType<typeof extractionRepo.upsert>) {
  return {
    id: record.id,
    sessionId: record.sessionId,
    fileName: record.fileName,
    documentType: record.documentType,
    documentName: record.documentName,
    applicableRole: record.applicableRole,
    category: record.category,
    confidence: record.confidence,
    holderName: record.holderName,
    dateOfBirth: record.dateOfBirth,
    sirbNumber: record.sirbNumber,
    passportNumber: record.passportNumber,
    fields: JSON.parse(record.fieldsJson),
    validity: JSON.parse(record.validityJson),
    compliance: JSON.parse(record.complianceJson),
    medicalData: JSON.parse(record.medicalDataJson),
    flags: JSON.parse(record.flagsJson),
    isExpired: Boolean(record.isExpired),
    processingTimeMs: record.processingTimeMs,
    summary: record.summary,
    createdAt: record.createdAt,
  };
}

export const extractRouter = Router();

extractRouter.post(
  "/extract",
  upload.single("document"),
  async (req, res, next): Promise<void> => {
    try {
      const mode = req.query.mode === "async" ? "async" : "sync";
      const sessionIdInput =
        typeof req.body.sessionId === "string" && req.body.sessionId.trim()
          ? req.body.sessionId.trim()
          : undefined;
      const file = req.file;

      if (!file) {
        throw new AppError(400, "UNSUPPORTED_FORMAT", "No document uploaded.");
      }

      if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
        throw new AppError(
          400,
          "UNSUPPORTED_FORMAT",
          "Only JPEG, PNG, and PDF files are accepted.",
        );
      }

      const sessionId = ensureSession(sessionIdInput);
      const fileHash = sha256FromBuffer(file.buffer);

      const deduped = extractionRepo.findBySessionAndHash(sessionId, fileHash);
      if (deduped) {
        res.setHeader("X-Deduplicated", "true");
        res.status(200).json(toExtractionResponse(deduped));
        return;
      }

      if (mode === "async") {
        const job = jobRepo.create({
          id: randomUUID(),
          sessionId,
          fileName: file.originalname,
          fileHash,
          mimeType: file.mimetype,
        });

        res.status(202).json({
          jobId: job.id,
          sessionId,
          status: job.status,
          pollUrl: `/api/jobs/${job.id}`,
          estimatedWaitMs: 6000,
        });
        return;
      }

      const startedAt = Date.now();
      const normalized = await extractDocument({
        fileName: file.originalname,
        mimeType: file.mimetype,
        contentBase64: file.buffer.toString("base64"),
      });

      const extraction = extractionRepo.upsert({
        id: randomUUID(),
        sessionId,
        fileName: file.originalname,
        fileHash,
        mimeType: file.mimetype,
        documentType: normalized.documentType,
        documentName: normalized.documentName,
        category: normalized.category,
        applicableRole: normalized.applicableRole,
        confidence: normalized.confidence,
        holderName: normalized.holderName,
        dateOfBirth: normalized.dateOfBirth,
        sirbNumber: normalized.sirbNumber,
        passportNumber: normalized.passportNumber,
        fieldsJson: JSON.stringify(normalized.fields),
        validityJson: JSON.stringify(normalized.validity),
        complianceJson: JSON.stringify(normalized.compliance),
        medicalDataJson: JSON.stringify(normalized.medicalData),
        flagsJson: JSON.stringify(normalized.flags),
        isExpired: normalized.isExpired ? 1 : 0,
        summary: normalized.summary,
        rawLlmResponse: normalized.rawLlmResponse,
        processingTimeMs: Date.now() - startedAt,
        status: "COMPLETE",
      });

      res.status(200).json(toExtractionResponse(extraction));
    } catch (error) {
      next(error);
    }
  },
);
