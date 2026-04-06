export type ExtractionStatus = "COMPLETE" | "FAILED";
export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

export interface SessionRecord {
  id: string;
  createdAt: string;
}

export interface ExtractionRecord {
  id: string;
  sessionId: string;
  fileName: string;
  fileHash: string;
  mimeType: string;
  documentType: string | null;
  documentName: string | null;
  category: string | null;
  applicableRole: string | null;
  confidence: string | null;
  holderName: string | null;
  dateOfBirth: string | null;
  sirbNumber: string | null;
  passportNumber: string | null;
  fieldsJson: string;
  validityJson: string;
  complianceJson: string;
  medicalDataJson: string;
  flagsJson: string;
  isExpired: number;
  summary: string | null;
  rawLlmResponse: string | null;
  promptVersion: string;
  processingTimeMs: number | null;
  status: ExtractionStatus;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  sessionId: string;
  extractionId: string | null;
  fileName: string;
  fileHash: string;
  mimeType: string;
  status: JobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: number;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ValidationRecord {
  id: string;
  sessionId: string;
  resultJson: string;
  createdAt: string;
}

export interface UpsertExtractionInput {
  id: string;
  sessionId: string;
  fileName: string;
  fileHash: string;
  mimeType: string;
  documentType?: string | null;
  documentName?: string | null;
  category?: string | null;
  applicableRole?: string | null;
  confidence?: string | null;
  holderName?: string | null;
  dateOfBirth?: string | null;
  sirbNumber?: string | null;
  passportNumber?: string | null;
  fieldsJson?: string;
  validityJson?: string;
  complianceJson?: string;
  medicalDataJson?: string;
  flagsJson?: string;
  isExpired?: number;
  summary?: string | null;
  rawLlmResponse?: string | null;
  promptVersion?: string;
  processingTimeMs?: number | null;
  status?: ExtractionStatus;
}

export interface CreateJobInput {
  id: string;
  sessionId: string;
  fileName: string;
  fileHash: string;
  mimeType: string;
}
