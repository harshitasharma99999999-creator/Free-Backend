"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().default(3000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: zod_1.z.string().default('*'),
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    FIREBASE_PROJECT_ID: zod_1.z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
    FIREBASE_CLIENT_EMAIL: zod_1.z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
    FIREBASE_PRIVATE_KEY: zod_1.z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),
    OLLAMA_BASE_URL: zod_1.z.string().default('http://localhost:11434'),
    OLLAMA_MODEL: zod_1.z.string().default('llama3.2'),
    GROQ_API_KEY: zod_1.z.string().optional(),
    REPLICATE_API_TOKEN: zod_1.z.string().optional(),
    SD_BASE_URL: zod_1.z.string().default('http://localhost:7860'),
    SD_MODEL: zod_1.z.string().default('dreamshaper_8'),
    API_KEY_MAX_PER_USER: zod_1.z.coerce.number().default(10),
    RATE_LIMIT_RPM: zod_1.z.coerce.number().default(60),
    RATE_LIMIT_RPD: zod_1.z.coerce.number().default(1000),
    // Hetzner Cloud — VPS provisioning (get token at cloud.hetzner.com → Security → API Tokens)
    HETZNER_API_TOKEN: zod_1.z.string().optional(),
    // Proxmox VE (legacy)
    PROXMOX_HOST: zod_1.z.string().optional(),
    PROXMOX_TOKEN_ID: zod_1.z.string().optional(),
    PROXMOX_TOKEN_SECRET: zod_1.z.string().optional(),
    PROXMOX_NODE: zod_1.z.string().default('pve'),
    PROXMOX_STORAGE: zod_1.z.string().default('local-lvm'),
    PROXMOX_TEMPLATE_VMID: zod_1.z.coerce.number().default(9000),
});
const result = envSchema.safeParse(process.env);
if (!result.success) {
    console.error('\n❌ Invalid environment configuration:\n');
    result.error.issues.forEach(i => console.error(`  ${i.path.join('.')}: ${i.message}`));
    console.error('\nCopy .env.example → .env and fill in the required values.\n');
    process.exit(1);
}
exports.config = result.data;
//# sourceMappingURL=config.js.map