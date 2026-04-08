import type { NormalizedExtraction } from "../types/extraction.js";
import { EXTRACTION_PROMPT } from "../lib/prompts.js";
import { parseJsonObject } from "../lib/json-repair.js";
import { createLlmClient } from "./llm-client.service.js";

interface ExtractDocumentInput {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

type ParsedExtraction = {
  detection?: {
    documentType?: string;
    documentName?: string;
    category?: string;
    applicableRole?: string;
    confidence?: string;
  };
  holder?: {
    fullName?: string | null;
    dateOfBirth?: string | null;
    sirbNumber?: string | null;
    passportNumber?: string | null;
  };
  fields?: Array<Record<string, unknown>>;
  validity?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  medicalData?: Record<string, unknown>;
  flags?: Array<Record<string, unknown>>;
  summary?: string;
};

export class LlmJsonParseError extends Error {
  readonly rawResponse: string;

  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "LlmJsonParseError";
    this.rawResponse = rawResponse;
  }
}

function confidenceScore(value: string | undefined): number {
  switch ((value ?? "").toUpperCase()) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

async function parseWithRepair(
  rawResponse: string,
  client = createLlmClient(),
): Promise<ParsedExtraction> {
  try {
    return parseJsonObject<ParsedExtraction>(rawResponse);
  } catch {
    const repairPrompt = `The following model output should be a JSON object but may include markdown, extra explanation, or malformed formatting.
Return ONLY a valid JSON object with no markdown and no explanation.

RAW OUTPUT:
${rawResponse}`;

    const repairedRaw = await client.generateText(repairPrompt);
    try {
      return parseJsonObject<ParsedExtraction>(repairedRaw);
    } catch {
      throw new LlmJsonParseError(
        "Document extraction failed after repair attempt.",
        rawResponse,
      );
    }
  }
}

export async function extractDocument(
  input: ExtractDocumentInput,
): Promise<NormalizedExtraction> {
  const client = createLlmClient();
  let rawPrimary = "";
  let parsedPrimary: ParsedExtraction;

  try {
    rawPrimary = await client.generateFromDocument({
      prompt: EXTRACTION_PROMPT,
      fileBase64: input.contentBase64,
      mimeType: input.mimeType,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new LlmJsonParseError("LLM timed out.", "Timeout");
    }
    throw error;
  }

  parsedPrimary = await parseWithRepair(rawPrimary, client);

  let selected = parsedPrimary;
  let rawCombined = rawPrimary;

  const primaryConfidence = confidenceScore(parsedPrimary.detection?.confidence);
  if (primaryConfidence <= 1) {
    const focusedPrompt = `${EXTRACTION_PROMPT}

Additional hints:
- file_name: ${input.fileName}
- mime_type: ${input.mimeType}
- Prior run confidence was LOW. Re-check holder identity and document taxonomy strictly.`;

    const rawRetry = await client.generateFromDocument({
      prompt: focusedPrompt,
      fileBase64: input.contentBase64,
      mimeType: input.mimeType,
    });
    rawCombined = `${rawPrimary}\n\n--- RETRY RESPONSE ---\n${rawRetry}`;
    const parsedRetry = await parseWithRepair(rawRetry, client);

    if (
      confidenceScore(parsedRetry.detection?.confidence) >=
      confidenceScore(parsedPrimary.detection?.confidence)
    ) {
      selected = parsedRetry;
    }
  }

  const validity = selected.validity ?? {};
  const isExpired = Boolean(validity.isExpired);
  const fields = Array.isArray(selected.fields) ? selected.fields : [];
  const flags = Array.isArray(selected.flags) ? selected.flags : [];

  return {
    documentType: selected.detection?.documentType ?? "OTHER",
    documentName: selected.detection?.documentName ?? "Unknown Document",
    category: selected.detection?.category ?? "OTHER",
    applicableRole: selected.detection?.applicableRole ?? "N/A",
    confidence: selected.detection?.confidence ?? "LOW",
    holderName: selected.holder?.fullName ?? null,
    dateOfBirth: selected.holder?.dateOfBirth ?? null,
    sirbNumber: selected.holder?.sirbNumber ?? null,
    passportNumber: selected.holder?.passportNumber ?? null,
    fields: fields as Array<Record<string, string | null>>,
    validity,
    compliance: selected.compliance ?? {},
    medicalData: selected.medicalData ?? {},
    flags,
    isExpired,
    summary:
      selected.summary ??
      "Document processed. Some expected fields may be missing due to extraction quality.",
    rawLlmResponse: rawCombined,
  };
}
