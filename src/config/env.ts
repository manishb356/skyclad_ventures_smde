import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LLM_PROVIDER: z.string().min(1).default("gemini"),
  LLM_MODEL: z.string().min(1).default("gemini-2.0-flash"),
  LLM_API_KEY: z.string().min(1).default("dev-placeholder"),
  DATABASE_PATH: z.string().min(1).default("./data/smde.db"),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().default(10485760),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = parsed.data;
