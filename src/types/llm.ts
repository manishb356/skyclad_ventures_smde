export interface VisionPromptInput {
  prompt: string;
  fileBase64: string;
  mimeType: string;
}

export interface LlmClient {
  generateFromDocument(input: VisionPromptInput): Promise<string>;
  generateText(prompt: string): Promise<string>;
  healthCheck(): Promise<boolean>;
}
