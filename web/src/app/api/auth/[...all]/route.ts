import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Created per request so the module can be imported at build time without environment variables.
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}
export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
