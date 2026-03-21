import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT:     z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL:    z.string().default('redis://localhost:6379'),

  FIREBASE_PROJECT_ID:   z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
  FIREBASE_PRIVATE_KEY:  z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),

  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL:    z.string().default('llama3.2'),

  GROQ_API_KEY:        z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),

  SD_BASE_URL: z.string().default('http://localhost:7860'),
  SD_MODEL:    z.string().default('dreamshaper_8'),

  API_KEY_MAX_PER_USER: z.coerce.number().default(10),
  RATE_LIMIT_RPM:       z.coerce.number().default(60),
  RATE_LIMIT_RPD:       z.coerce.number().default(1000),

  // Hetzner Cloud — VPS provisioning (get token at cloud.hetzner.com → Security → API Tokens)
  HETZNER_API_TOKEN: z.string().optional(),

  // Proxmox VE (legacy)
  PROXMOX_HOST:          z.string().optional(),
  PROXMOX_TOKEN_ID:      z.string().optional(),
  PROXMOX_TOKEN_SECRET:  z.string().optional(),
  PROXMOX_NODE:          z.string().default('pve'),
  PROXMOX_STORAGE:       z.string().default('local-lvm'),
  PROXMOX_TEMPLATE_VMID: z.coerce.number().default(9000),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('\n❌ Invalid environment configuration:\n');
  result.error.issues.forEach(i => console.error(`  ${i.path.join('.')}: ${i.message}`));
  console.error('\nCopy .env.example → .env and fill in the required values.\n');
  process.exit(1);
}

export const config = result.data;
export type Config = typeof config;
