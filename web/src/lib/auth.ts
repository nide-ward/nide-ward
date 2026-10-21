import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { getDb, schema } from "@/db";
import { authEnv } from "./env";

/**
 * Self-hosted Better Auth in the same Neon database. Created lazily so `next build`
 * works without environment variables.
 *
 * - Email + password only. Public sign-up is disabled: accounts are created by an attending
 *   (staff management) or by the first-attending seed script, via the admin plugin.
 * - Sessions are short (default 120 min idle, sliding) because ward computers are shared.
 *   No cookie cache: deactivating or banning a user takes effect on the next request.
 * - Rate limiting is stored in the database because serverless instances do not share memory.
 */
function create() {
  const env = authEnv();
  const maxAgeSeconds = env.SESSION_MAX_AGE_MINUTES * 60;
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    session: {
      expiresIn: maxAgeSeconds,
      updateAge: Math.min(600, Math.floor(maxAgeSeconds / 4)),
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
    },
    advanced: { cookiePrefix: "nide-ward" },
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
  });
}

let cached: ReturnType<typeof create> | undefined;
export function getAuth() {
  cached ??= create();
  return cached;
}
export type Auth = ReturnType<typeof getAuth>;

/** Better Auth platform role for each clinical role. Only attendings are platform admins. */
export const platformRoleFor = (clinicalRole: "attending" | "resident" | "nurse") =>
  clinicalRole === "attending" ? "admin" : "user";
