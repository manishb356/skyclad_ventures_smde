export interface NormalizedExtraction {
  documentType: string;
  documentName: string;
  category: string;
  applicableRole: string;
  confidence: string;
  holderName: string | null;
  dateOfBirth: string | null;
  sirbNumber: string | null;
  passportNumber: string | null;
  fields: Array<Record<string, string | null>>;
  validity: Record<string, unknown>;
  compliance: Record<string, unknown>;
  medicalData: Record<string, unknown>;
  flags: Array<Record<string, unknown>>;
  isExpired: boolean;
  summary: string;
  rawLlmResponse: string | null;
}
