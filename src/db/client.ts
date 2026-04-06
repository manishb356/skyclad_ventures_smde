import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "../config/env.js";
import type {
  CreateJobInput,
  ExtractionRecord,
  JobRecord,
  SessionRecord,
  UpsertExtractionInput,
  ValidationRecord,
} from "./types.js";

const dbPath = path.resolve(env.DATABASE_PATH);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const schemaPath = path.resolve("src/db/schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");
db.exec(schemaSql);

function mapSession(row: { id: string; created_at: string }): SessionRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
  };
}

function mapExtraction(
  row: Record<string, string | number | null>,
): ExtractionRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    fileName: String(row.file_name),
    fileHash: String(row.file_hash),
    mimeType: String(row.mime_type),
    documentType: (row.document_type as string | null) ?? null,
    documentName: (row.document_name as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    applicableRole: (row.applicable_role as string | null) ?? null,
    confidence: (row.confidence as string | null) ?? null,
    holderName: (row.holder_name as string | null) ?? null,
    dateOfBirth: (row.date_of_birth as string | null) ?? null,
    sirbNumber: (row.sirb_number as string | null) ?? null,
    passportNumber: (row.passport_number as string | null) ?? null,
    fieldsJson: String(row.fields_json ?? "[]"),
    validityJson: String(row.validity_json ?? "{}"),
    complianceJson: String(row.compliance_json ?? "{}"),
    medicalDataJson: String(row.medical_data_json ?? "{}"),
    flagsJson: String(row.flags_json ?? "[]"),
    isExpired: Number(row.is_expired ?? 0),
    summary: (row.summary as string | null) ?? null,
    rawLlmResponse: (row.raw_llm_response as string | null) ?? null,
    promptVersion: String(row.prompt_version ?? "v1"),
    processingTimeMs: (row.processing_time_ms as number | null) ?? null,
    status: (row.status as "COMPLETE" | "FAILED") ?? "COMPLETE",
    createdAt: String(row.created_at),
  };
}

function mapJob(row: Record<string, string | number | null>): JobRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    extractionId: (row.extraction_id as string | null) ?? null,
    fileName: String(row.file_name),
    fileHash: String(row.file_hash),
    mimeType: String(row.mime_type),
    status: row.status as JobRecord["status"],
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    retryable: Number(row.retryable ?? 0),
    queuedAt: String(row.queued_at),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

function mapValidation(
  row: Record<string, string | number | null>,
): ValidationRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    resultJson: String(row.result_json),
    createdAt: String(row.created_at),
  };
}

export const sessionRepo = {
  create(id: string): SessionRecord {
    db.prepare("INSERT INTO sessions (id) VALUES (?)").run(id);
    const row = db
      .prepare("SELECT id, created_at FROM sessions WHERE id = ?")
      .get(id) as { id: string; created_at: string };
    return mapSession(row);
  },

  findById(id: string): SessionRecord | null {
    const row = db
      .prepare("SELECT id, created_at FROM sessions WHERE id = ?")
      .get(id) as { id: string; created_at: string } | undefined;
    return row ? mapSession(row) : null;
  },
};

export const extractionRepo = {
  upsert(input: UpsertExtractionInput): ExtractionRecord {
    db.prepare(
      `
        INSERT INTO extractions (
          id, session_id, file_name, file_hash, mime_type, document_type,
          document_name, category, applicable_role, confidence, holder_name,
          date_of_birth, sirb_number, passport_number, fields_json, validity_json,
          compliance_json, medical_data_json, flags_json, is_expired, summary,
          raw_llm_response, prompt_version, processing_time_ms, status
        ) VALUES (
          @id, @sessionId, @fileName, @fileHash, @mimeType, @documentType,
          @documentName, @category, @applicableRole, @confidence, @holderName,
          @dateOfBirth, @sirbNumber, @passportNumber, @fieldsJson, @validityJson,
          @complianceJson, @medicalDataJson, @flagsJson, @isExpired, @summary,
          @rawLlmResponse, @promptVersion, @processingTimeMs, @status
        )
        ON CONFLICT(id) DO UPDATE SET
          document_type = excluded.document_type,
          document_name = excluded.document_name,
          category = excluded.category,
          applicable_role = excluded.applicable_role,
          confidence = excluded.confidence,
          holder_name = excluded.holder_name,
          date_of_birth = excluded.date_of_birth,
          sirb_number = excluded.sirb_number,
          passport_number = excluded.passport_number,
          fields_json = excluded.fields_json,
          validity_json = excluded.validity_json,
          compliance_json = excluded.compliance_json,
          medical_data_json = excluded.medical_data_json,
          flags_json = excluded.flags_json,
          is_expired = excluded.is_expired,
          summary = excluded.summary,
          raw_llm_response = excluded.raw_llm_response,
          prompt_version = excluded.prompt_version,
          processing_time_ms = excluded.processing_time_ms,
          status = excluded.status
      `,
    ).run({
      id: input.id,
      sessionId: input.sessionId,
      fileName: input.fileName,
      fileHash: input.fileHash,
      mimeType: input.mimeType,
      documentType: input.documentType ?? null,
      documentName: input.documentName ?? null,
      category: input.category ?? null,
      applicableRole: input.applicableRole ?? null,
      confidence: input.confidence ?? null,
      holderName: input.holderName ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      sirbNumber: input.sirbNumber ?? null,
      passportNumber: input.passportNumber ?? null,
      fieldsJson: input.fieldsJson ?? "[]",
      validityJson: input.validityJson ?? "{}",
      complianceJson: input.complianceJson ?? "{}",
      medicalDataJson: input.medicalDataJson ?? "{}",
      flagsJson: input.flagsJson ?? "[]",
      isExpired: input.isExpired ?? 0,
      summary: input.summary ?? null,
      rawLlmResponse: input.rawLlmResponse ?? null,
      promptVersion: input.promptVersion ?? "v1",
      processingTimeMs: input.processingTimeMs ?? null,
      status: input.status ?? "COMPLETE",
    });

    const row = db
      .prepare("SELECT * FROM extractions WHERE id = ?")
      .get(input.id) as Record<string, string | number | null>;

    return mapExtraction(row);
  },

  findById(id: string): ExtractionRecord | null {
    const row = db
      .prepare("SELECT * FROM extractions WHERE id = ?")
      .get(id) as Record<string, string | number | null> | undefined;

    return row ? mapExtraction(row) : null;
  },

  findBySessionAndHash(
    sessionId: string,
    fileHash: string,
  ): ExtractionRecord | null {
    const row = db
      .prepare("SELECT * FROM extractions WHERE session_id = ? AND file_hash = ?")
      .get(sessionId, fileHash) as Record<string, string | number | null> | undefined;

    return row ? mapExtraction(row) : null;
  },

  listBySession(sessionId: string): ExtractionRecord[] {
    const rows = db
      .prepare(
        "SELECT * FROM extractions WHERE session_id = ? ORDER BY datetime(created_at) DESC",
      )
      .all(sessionId) as Record<string, string | number | null>[];

    return rows.map(mapExtraction);
  },
};

export const jobRepo = {
  create(input: CreateJobInput): JobRecord {
    db.prepare(
      `
        INSERT INTO jobs (id, session_id, file_name, file_hash, mime_type, status)
        VALUES (@id, @sessionId, @fileName, @fileHash, @mimeType, 'QUEUED')
      `,
    ).run(input);
    const row = db
      .prepare("SELECT * FROM jobs WHERE id = ?")
      .get(input.id) as Record<string, string | number | null>;
    return mapJob(row);
  },

  findById(id: string): JobRecord | null {
    const row = db
      .prepare("SELECT * FROM jobs WHERE id = ?")
      .get(id) as Record<string, string | number | null> | undefined;
    return row ? mapJob(row) : null;
  },

  listPendingBySession(sessionId: string): JobRecord[] {
    const rows = db
      .prepare(
        "SELECT * FROM jobs WHERE session_id = ? AND status IN ('QUEUED', 'PROCESSING') ORDER BY datetime(queued_at) ASC",
      )
      .all(sessionId) as Record<string, string | number | null>[];
    return rows.map(mapJob);
  },

  countQueuedAhead(jobId: string): number {
    const target = db
      .prepare("SELECT queued_at FROM jobs WHERE id = ?")
      .get(jobId) as { queued_at: string } | undefined;
    if (!target) return 0;

    const row = db
      .prepare(
        "SELECT COUNT(*) as count FROM jobs WHERE status = 'QUEUED' AND datetime(queued_at) <= datetime(?)",
      )
      .get(target.queued_at) as { count: number };
    return row.count;
  },

  updateStatus(
    id: string,
    status: JobRecord["status"],
    options?: {
      extractionId?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      retryable?: number;
    },
  ): JobRecord | null {
    const now = new Date().toISOString();
    const startedAt = status === "PROCESSING" ? now : null;
    const completedAt = status === "COMPLETE" || status === "FAILED" ? now : null;
    db.prepare(
      `
        UPDATE jobs
        SET
          status = @status,
          extraction_id = COALESCE(@extractionId, extraction_id),
          error_code = @errorCode,
          error_message = @errorMessage,
          retryable = COALESCE(@retryable, retryable),
          started_at = COALESCE(@startedAt, started_at),
          completed_at = COALESCE(@completedAt, completed_at)
        WHERE id = @id
      `,
    ).run({
      id,
      status,
      extractionId: options?.extractionId ?? null,
      errorCode: options?.errorCode ?? null,
      errorMessage: options?.errorMessage ?? null,
      retryable: options?.retryable ?? null,
      startedAt,
      completedAt,
    });
    return this.findById(id);
  },
};

export const validationRepo = {
  create(id: string, sessionId: string, resultJson: string): ValidationRecord {
    db.prepare(
      "INSERT INTO validations (id, session_id, result_json) VALUES (?, ?, ?)",
    ).run(id, sessionId, resultJson);
    const row = db
      .prepare("SELECT * FROM validations WHERE id = ?")
      .get(id) as Record<string, string | number | null>;
    return mapValidation(row);
  },

  findLatestBySession(sessionId: string): ValidationRecord | null {
    const row = db
      .prepare(
        "SELECT * FROM validations WHERE session_id = ? ORDER BY datetime(created_at) DESC LIMIT 1",
      )
      .get(sessionId) as Record<string, string | number | null> | undefined;
    return row ? mapValidation(row) : null;
  },
};
