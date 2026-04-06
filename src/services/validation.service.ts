import { randomUUID } from "node:crypto";
import { createLlmClient } from "./llm/client.js";
import { parseJsonObject } from "../lib/json-repair.js";
import { validationRepo } from "../db/client.js";

function buildValidationPrompt(records: Array<Record<string, unknown>>): string {
  return `You are a maritime compliance reviewer. Analyze the extracted document records for one seafarer.
Use only the given records. Do not invent fields.

Tasks:
1) Build a holder profile from the strongest consistent identity data.
2) Check cross-document consistency (name, birth date, passport, sirb, role alignment).
3) Identify missing required documents based on inferred role.
4) List expiring/expired documents and medical concerns.
5) Return an overall recommendation.

Return ONLY valid JSON with this exact shape:
{
  "holderProfile": {},
  "consistencyChecks": [],
  "missingDocuments": [],
  "expiringDocuments": [],
  "medicalFlags": [],
  "overallStatus": "APPROVED | CONDITIONAL | REJECTED",
  "overallScore": 0,
  "summary": "",
  "recommendations": []
}

Input records:
${JSON.stringify(records)}`;
}

export async function validateSessionDocuments(
  sessionId: string,
  records: Array<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const llm = createLlmClient();
  const prompt = buildValidationPrompt(records);
  const raw = await llm.generateText(prompt);
  const parsed = parseJsonObject<Record<string, unknown>>(raw);

  const response = {
    sessionId,
    holderProfile: parsed.holderProfile ?? {},
    consistencyChecks: Array.isArray(parsed.consistencyChecks)
      ? parsed.consistencyChecks
      : [],
    missingDocuments: Array.isArray(parsed.missingDocuments)
      ? parsed.missingDocuments
      : [],
    expiringDocuments: Array.isArray(parsed.expiringDocuments)
      ? parsed.expiringDocuments
      : [],
    medicalFlags: Array.isArray(parsed.medicalFlags) ? parsed.medicalFlags : [],
    overallStatus: parsed.overallStatus ?? "CONDITIONAL",
    overallScore:
      typeof parsed.overallScore === "number"
        ? parsed.overallScore
        : Number(parsed.overallScore ?? 0),
    summary:
      typeof parsed.summary === "string"
        ? parsed.summary
        : "Validation completed with limited confidence.",
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : [],
    validatedAt: new Date().toISOString(),
  };

  validationRepo.create(randomUUID(), sessionId, JSON.stringify(response));
  return response;
}
