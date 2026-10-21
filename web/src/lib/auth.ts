import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { getDb, schema } from "@/db";
import { authEnv } from "./env";
import { USERNAME_MAX, USERNAME_MIN } from "./username";

/**
 * Self-hosted Better Auth in the same Neon database. Created lazily so `next build`
 * works without environment variables.
 *
 * - Username + password. Public sign-up is disabled: accounts are created by an attending
 *   (staff management) or by the first-attending seed script, via the admin plugin. Each user
 *   still has an email because Better Auth requires one, but it is a never-used placeholder
 *   (see src/lib/username.ts), so email sign-in is switched off. Usernames cannot be changed.
 *   The username-availability endpoint is off too, so usernames cannot be probed from outside.
 * - Sessions are short (default 120 min idle, sliding) because ward computers are shared.
 *   No cookie cache: deactivating or banning a user takes effect on the next request.
 * - Rate limiting is stored in the database because serverless instances do not share memory.
 */
function create() {
  const env = authEnv();
  const maxAgeSeconds = env.SESSION_MAX_AGE_MINUTES * 60;
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      "https://nideward.vercel.app",
      "http://localhost:3000",
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ],
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
      customRules: { "/sign-in/username": { window: 60, max: 5 } },
    },
    disabledPaths: ["/sign-in/email", "/is-username-available"],
    advanced: { cookiePrefix: "nide-ward" },
    plugins: [
      admin({ defaultRole: "user", adminRoles: ["admin"] }),
      username({ minUsernameLength: USERNAME_MIN, maxUsernameLength: USERNAME_MAX, immutableUsername: true }),
      nextCookies(),
    ],
  });
}

let cached: ReturnType<typeof create> | undefined;
export function getAuth() {
  cached ??= create();
  return cached;
}
export type Auth = ReturnType<typeof getAuth>;

/** Better Auth platform role for each clinical role. Only the admin role is a platform admin. */
export const platformRoleFor = (clinicalRole: "admin" | "attending" | "resident") =>
  clinicalRole === "admin" ? "admin" : "user";
