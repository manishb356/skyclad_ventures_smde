import { env } from "../config/env.js";
import type { LlmClient, VisionPromptInput } from "../types/llm.js";

function withTimeout(signalTimeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), signalTimeoutMs);
  return controller;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOpenAiLikeContent(payload: unknown): string {
  if (!isRecord(payload)) return "";
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = isRecord(choices[0]) ? choices[0].message : null;
  if (!isRecord(message)) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textNode = content.find(
      (item) => isRecord(item) && typeof item.text === "string",
    ) as Record<string, unknown> | undefined;
    return typeof textNode?.text === "string" ? textNode.text : "";
  }
  return "";
}

function parseGeminiContent(payload: unknown): string {
  if (!isRecord(payload)) return "";
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const first = candidates[0];
  if (!isRecord(first) || !isRecord(first.content)) return "";
  const parts = first.content.parts;
  if (!Array.isArray(parts)) return "";
  const textPart = parts.find(
    (part) => isRecord(part) && typeof part.text === "string",
  ) as Record<string, unknown> | undefined;
  return typeof textPart?.text === "string" ? textPart.text : "";
}

class GeminiClient implements LlmClient {
  async generateFromDocument(input: VisionPromptInput): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      env.LLM_MODEL,
    )}:generateContent?key=${encodeURIComponent(env.LLM_API_KEY)}`;
    const controller = withTimeout(env.LLM_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: input.prompt },
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.fileBase64,
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }
    return parseGeminiContent(payload);
  }

  async generateText(prompt: string): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      env.LLM_MODEL,
    )}:generateContent?key=${encodeURIComponent(env.LLM_API_KEY)}`;
    const controller = withTimeout(env.LLM_TIMEOUT_MS);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }
    return parseGeminiContent(payload);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const text = await this.generateText("Reply with OK");
      return text.toUpperCase().includes("OK");
    } catch {
      return false;
    }
  }
}

class OpenAiLikeClient implements LlmClient {
  constructor(private readonly baseUrl: string) {}

  async generateFromDocument(input: VisionPromptInput): Promise<string> {
    const endpoint = `${this.baseUrl}/chat/completions`;
    const controller = withTimeout(env.LLM_TIMEOUT_MS);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: input.prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mimeType};base64,${input.fileBase64}`,
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(`OpenAI-like request failed: ${response.status}`);
    }
    return parseOpenAiLikeContent(payload);
  }

  async generateText(prompt: string): Promise<string> {
    const endpoint = `${this.baseUrl}/chat/completions`;
    const controller = withTimeout(env.LLM_TIMEOUT_MS);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(`OpenAI-like request failed: ${response.status}`);
    }
    return parseOpenAiLikeContent(payload);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const text = await this.generateText("Reply with OK");
      return text.toUpperCase().includes("OK");
    } catch {
      return false;
    }
  }
}

class AnthropicClient implements LlmClient {
  async generateFromDocument(input: VisionPromptInput): Promise<string> {
    const endpoint = "https://api.anthropic.com/v1/messages";
    const controller = withTimeout(env.LLM_TIMEOUT_MS);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.LLM_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mimeType,
                  data: input.fileBase64,
                },
              },
              { type: "text", text: input.prompt },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }
    const content = payload.content;
    if (!Array.isArray(content)) return "";
    const textNode = content.find(
      (item) => isRecord(item) && item.type === "text" && typeof item.text === "string",
    ) as Record<string, unknown> | undefined;
    return typeof textNode?.text === "string" ? textNode.text : "";
  }

  async generateText(prompt: string): Promise<string> {
    const endpoint = "https://api.anthropic.com/v1/messages";
    const controller = withTimeout(env.LLM_TIMEOUT_MS);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.LLM_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }
    const content = payload.content;
    if (!Array.isArray(content)) return "";
    const textNode = content.find(
      (item) => isRecord(item) && item.type === "text" && typeof item.text === "string",
    ) as Record<string, unknown> | undefined;
    return typeof textNode?.text === "string" ? textNode.text : "";
  }

  async healthCheck(): Promise<boolean> {
    try {
      const text = await this.generateText("Reply with OK");
      return text.toUpperCase().includes("OK");
    } catch {
      return false;
    }
  }
}

export function createLlmClient(): LlmClient {
  switch (env.LLM_PROVIDER.toLowerCase()) {
    case "gemini":
      return new GeminiClient();
    case "anthropic":
      return new AnthropicClient();
    case "openai":
      return new OpenAiLikeClient("https://api.openai.com/v1");
    case "groq":
      return new OpenAiLikeClient("https://api.groq.com/openai/v1");
    case "mistral":
      return new OpenAiLikeClient("https://api.mistral.ai/v1");
    default:
      return new GeminiClient();
  }
}
