import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return value;
}, z.boolean());

const defaultCorsOrigins = ['http://localhost:8080', 'http://localhost:5173'];

const corsOriginsEnv = z.preprocess((value) => {
  if (value === undefined || value === '') {
    return defaultCorsOrigins;
  }

  if (typeof value !== 'string') {
    return value;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}, z.array(z.url()).min(1));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  LOG_TO_FILE: booleanEnv.default(false),
  LOG_DIR: z.string().min(1).default('logs'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: corsOriginsEnv,
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('wardrobe-images'),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  EXTRACTION_VISION_MODEL: z.string().min(1).default('google/gemma-4-26b-a4b-it'),
  EXTRACTION_NORMALIZATION_MODEL: z.string().min(1).default('google/gemma-4-26b-a4b-it'),
  OUTFIT_INTENT_CLASSIFIER_MODEL: z.string().min(1).default('google/gemma-4-26b-a4b-it'),
  OUTFIT_INTENT_REPAIR_MODEL: z.string().min(1).default('google/gemma-4-26b-a4b-it'),
  OUTFIT_CURATOR_MODEL: z.string().min(1).default('google/gemma-4-26b-a4b-it'),
  OUTFIT_CURATOR_REPAIR_MODEL: z.string().min(1).default('google/gemma-4-26b-a4b-it'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formatted = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment variables: ${formatted}`);
}

export const env = parsedEnv.data;
