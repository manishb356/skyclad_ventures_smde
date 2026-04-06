import type { NormalizedExtraction } from "./extraction.types.js";

interface ExtractDocumentInput {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

/**
 * Placeholder implementation for endpoint wiring.
 * Full LLM reliability pipeline is implemented in the next todo.
 */
export async function extractDocument(
  input: ExtractDocumentInput,
): Promise<NormalizedExtraction> {
  void input.contentBase64;

  return {
    documentType: "OTHER",
    documentName: "Unknown Document",
    category: "OTHER",
    applicableRole: "N/A",
    confidence: "LOW",
    holderName: null,
    dateOfBirth: null,
    sirbNumber: null,
    passportNumber: null,
    fields: [
      {
        key: "file_name",
        label: "File Name",
        value: input.fileName,
        importance: "LOW",
        status: "OK",
      },
      {
        key: "mime_type",
        label: "MIME Type",
        value: input.mimeType,
        importance: "LOW",
        status: "OK",
      },
    ],
    validity: {
      dateOfIssue: null,
      dateOfExpiry: null,
      isExpired: false,
      daysUntilExpiry: null,
      revalidationRequired: null,
    },
    compliance: {
      issuingAuthority: "UNKNOWN",
      regulationReference: null,
      imoModelCourse: null,
      recognizedAuthority: null,
      limitations: null,
    },
    medicalData: {
      fitnessResult: "N/A",
      drugTestResult: "N/A",
      restrictions: null,
      specialNotes: null,
      expiryDate: null,
    },
    flags: [
      {
        severity: "LOW",
        message: "LLM extraction pipeline not fully configured yet.",
      },
    ],
    isExpired: false,
    summary:
      "The uploaded file was accepted and stored. Structured extraction defaults were returned.",
    rawLlmResponse: null,
  };
}
