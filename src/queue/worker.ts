import { randomUUID } from "node:crypto";
import { extractionRepo, jobRepo } from "../db/client.js";
import { env } from "../config/env.js";
import { extractDocument, LlmJsonParseError } from "../services/extraction.service.js";

interface WorkerState {
  isRunning: boolean;
  lastHeartbeatAt: string | null;
}

const workerState: WorkerState = {
  isRunning: false,
  lastHeartbeatAt: null,
};

let workerInterval: NodeJS.Timeout | null = null;

async function processNextJob(): Promise<void> {
  const job = jobRepo.claimNextQueued();
  workerState.lastHeartbeatAt = new Date().toISOString();
  if (!job) return;

  const startedAtMs = Date.now();
  try {
    const normalized = await extractDocument({
      fileName: job.fileName,
      mimeType: job.mimeType,
      contentBase64: job.fileDataBase64,
    });

    const extraction = extractionRepo.upsert({
      id: randomUUID(),
      sessionId: job.sessionId,
      fileName: job.fileName,
      fileHash: job.fileHash,
      mimeType: job.mimeType,
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
      processingTimeMs: Date.now() - startedAtMs,
      status: "COMPLETE",
    });

    jobRepo.updateStatus(job.id, "COMPLETE", {
      extractionId: extraction.id,
      retryable: 0,
    });
  } catch (error) {
    const failedExtraction = extractionRepo.upsert({
      id: randomUUID(),
      sessionId: job.sessionId,
      fileName: job.fileName,
      fileHash: job.fileHash,
      mimeType: job.mimeType,
      rawLlmResponse:
        error instanceof LlmJsonParseError ? error.rawResponse : String(error),
      processingTimeMs: Date.now() - startedAtMs,
      status: "FAILED",
      confidence: "LOW",
      summary: "Extraction failed during asynchronous processing.",
    });

    const isRetryable = error instanceof LlmJsonParseError ? 1 : 0;
    jobRepo.updateStatus(job.id, "FAILED", {
      extractionId: failedExtraction.id,
      errorCode:
        error instanceof LlmJsonParseError ? "LLM_JSON_PARSE_FAIL" : "INTERNAL_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      retryable: isRetryable,
    });
  }
}

export function startQueueWorker(): void {
  if (workerInterval) {
    return;
  }
  jobRepo.failStaleProcessing(env.LLM_TIMEOUT_MS + 5000);
  workerState.isRunning = true;
  workerInterval = setInterval(() => {
    void processNextJob();
  }, 700);
}

export function stopQueueWorker(): void {
  if (!workerInterval) return;
  clearInterval(workerInterval);
  workerInterval = null;
  workerState.isRunning = false;
}

export function getQueueWorkerState(): WorkerState {
  return { ...workerState };
}
