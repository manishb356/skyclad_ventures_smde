import type { ExtractionRecord, JobRecord, ValidationRecord } from "../db/types.js";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function buildSessionReport(params: {
  sessionId: string;
  extractions: ExtractionRecord[];
  pendingJobs: JobRecord[];
  latestValidation: ValidationRecord | null;
}): Record<string, unknown> {
  const { sessionId, extractions, pendingJobs, latestValidation } = params;
  const totalFlags = extractions.reduce((sum, extraction) => {
    const flags = parseJson<Array<{ severity?: string }>>(extraction.flagsJson, []);
    return sum + flags.length;
  }, 0);

  const criticalFlags = extractions.reduce((sum, extraction) => {
    const flags = parseJson<Array<{ severity?: string }>>(extraction.flagsJson, []);
    return (
      sum + flags.filter((flag) => String(flag.severity).toUpperCase() === "CRITICAL").length
    );
  }, 0);

  const expiredCount = extractions.filter((item) => item.isExpired === 1).length;
  const validation = latestValidation
    ? parseJson<Record<string, unknown>>(latestValidation.resultJson, {})
    : null;

  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    decisionSnapshot: {
      totalDocuments: extractions.length,
      pendingJobs: pendingJobs.length,
      expiredDocuments: expiredCount,
      totalFlags,
      criticalFlags,
    },
    identity: {
      holderName: extractions.find((item) => item.holderName)?.holderName ?? null,
      dateOfBirth: extractions.find((item) => item.dateOfBirth)?.dateOfBirth ?? null,
      passportNumber:
        extractions.find((item) => item.passportNumber)?.passportNumber ?? null,
      sirbNumber: extractions.find((item) => item.sirbNumber)?.sirbNumber ?? null,
    },
    documents: extractions.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      documentType: item.documentType,
      documentName: item.documentName,
      role: item.applicableRole,
      confidence: item.confidence,
      status: item.status,
      createdAt: item.createdAt,
      isExpired: Boolean(item.isExpired),
      summary: item.summary,
      flags: parseJson(item.flagsJson, [] as unknown[]),
    })),
    pendingQueue: pendingJobs.map((job) => ({
      jobId: job.id,
      status: job.status,
      fileName: job.fileName,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt,
    })),
    latestValidation: validation,
  };
}
