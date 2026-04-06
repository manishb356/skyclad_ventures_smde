import { Router } from "express";
import { extractionRepo, jobRepo } from "../db/client.js";
import { AppError } from "../types/errors.js";

export const jobsRouter = Router();

jobsRouter.get("/jobs/:jobId", (req, res, next) => {
  try {
    const job = jobRepo.findById(req.params.jobId);
    if (!job) {
      throw new AppError(404, "JOB_NOT_FOUND", "Job ID does not exist.");
    }

    if (job.status === "QUEUED" || job.status === "PROCESSING") {
      const queuePosition = job.status === "QUEUED" ? jobRepo.countQueuedAhead(job.id) : 0;
      res.status(200).json({
        jobId: job.id,
        status: job.status,
        queuePosition,
        startedAt: job.startedAt,
        estimatedCompleteMs: job.status === "QUEUED" ? 6000 : 3200,
      });
      return;
    }

    if (job.status === "FAILED") {
      res.status(200).json({
        jobId: job.id,
        status: "FAILED",
        error: job.errorCode ?? "INTERNAL_ERROR",
        message: job.errorMessage ?? "Asynchronous extraction failed.",
        failedAt: job.completedAt,
        retryable: Boolean(job.retryable),
      });
      return;
    }

    const extraction =
      job.extractionId !== null ? extractionRepo.findById(job.extractionId) : null;

    res.status(200).json({
      jobId: job.id,
      status: "COMPLETE",
      extractionId: job.extractionId,
      result: extraction
        ? {
            id: extraction.id,
            sessionId: extraction.sessionId,
            fileName: extraction.fileName,
            documentType: extraction.documentType,
            documentName: extraction.documentName,
            applicableRole: extraction.applicableRole,
            category: extraction.category,
            confidence: extraction.confidence,
            holderName: extraction.holderName,
            dateOfBirth: extraction.dateOfBirth,
            sirbNumber: extraction.sirbNumber,
            passportNumber: extraction.passportNumber,
            fields: JSON.parse(extraction.fieldsJson),
            validity: JSON.parse(extraction.validityJson),
            compliance: JSON.parse(extraction.complianceJson),
            medicalData: JSON.parse(extraction.medicalDataJson),
            flags: JSON.parse(extraction.flagsJson),
            isExpired: Boolean(extraction.isExpired),
            processingTimeMs: extraction.processingTimeMs,
            summary: extraction.summary,
            createdAt: extraction.createdAt,
          }
        : null,
      completedAt: job.completedAt,
    });
  } catch (error) {
    next(error);
  }
});
