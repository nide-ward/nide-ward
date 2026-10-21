import { z } from "zod";
import { usernameSchema } from "./validation";

/**
 * Environment access is lazy on purpose: nothing here runs at import time, so
 * `next build` succeeds without any variables. Each group is validated the first
 * time it is needed and the error names exactly what is missing.
 */

function parse<T extends z.ZodType>(name: string, schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables for ${name}: ${issues}. See .env.example.`);
  }
  return result.data;
}

const dbSchema = z.object({ DATABASE_URL: z.string().min(1) });

const authSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  SESSION_MAX_AGE_MINUTES: z.coerce.number().int().min(15).max(1440).default(120),
});

/**
 * S3-compatible object storage (Neon Object Storage, Cloudflare R2, ...). The AWS SDK reads the
 * endpoint, region and credentials from these standard variables by itself; they are validated
 * here only to give a clear error when something is missing.
 */
const storageSchema = z.object({
  AWS_ENDPOINT_URL_S3: z.url(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  S3_UPLOAD_MODE: z.enum(["presigned", "proxy"]).default("presigned"),
});

const seedAdminSchema = z.object({
  SEED_ADMIN_USERNAME: usernameSchema,
  SEED_ADMIN_PASSWORD: z.string().min(10),
  SEED_ADMIN_NAME: z.string().min(1),
  SEED_ADMIN_BADGE: z.string().optional(),
});

export const dbEnv = () => parse("the database", dbSchema);
export const authEnv = () => parse("authentication", authSchema);
export const storageEnv = () => parse("object storage", storageSchema);
/** Safe to call from the client-facing config route: no secrets, never throws. */
export const uploadMode = (): "presigned" | "proxy" => (process.env.S3_UPLOAD_MODE === "proxy" ? "proxy" : "presigned");
export const seedAdminEnv = () => parse("the first attending seed", seedAdminSchema);
