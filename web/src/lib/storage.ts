import "server-only";
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageEnv } from "./env";

/**
 * Provider-agnostic S3 storage for lab photos (Neon Object Storage, Cloudflare R2, any S3 API).
 * When S3 environment variables are absent, falls back gracefully to local public/uploads directory.
 */
let client: S3Client | undefined;

export function isS3Configured(): boolean {
  try {
    const s = storageEnv();
    return Boolean(s.S3_BUCKET);
  } catch {
    return false;
  }
}

function getLocalPath(key: string): string {
  return join(process.cwd(), "public", "uploads", key);
}

function getClient(): S3Client {
  if (!client) {
    const { S3_FORCE_PATH_STYLE } = storageEnv(); // validates configuration with a clear error
    client = new S3Client({
      forcePathStyle: S3_FORCE_PATH_STYLE,
      // Newer SDK versions add CRC32 checksum headers by default, which some S3-compatible stores reject on presigned PUTs.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

const bucket = () => storageEnv().S3_BUCKET;

export const ALLOWED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // photos are compressed to ~1600px WebP client-side, so this is generous

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export function newObjectKey(admissionId: string, contentType: string): string {
  return `lab/${admissionId}/${crypto.randomUUID()}.${EXT[contentType] ?? "bin"}`;
}

/** Presigned PUT for direct browser upload. Content type and length are signed, so they cannot be changed. */
export async function presignPut(key: string, contentType: string, size: number): Promise<string> {
  if (!isS3Configured()) {
    throw new Error("Direct presigned upload requires S3. Use proxy upload mode.");
  }
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 120 },
  );
}

/** Presigned GET with a short expiry for viewing. Falls back to local public URL if S3 is unconfigured. */
export async function presignGet(key: string): Promise<string> {
  if (isS3Configured()) {
    return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 60 });
  }
  return `/uploads/${key}`;
}

/** Server-side upload, used by the proxy upload mode. Saves locally when S3 is not configured. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (isS3Configured()) {
    await getClient().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, ContentLength: body.byteLength }),
    );
  } else {
    const fullPath = getLocalPath(key);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, body);
  }
}

/** Confirms an uploaded object exists and returns its real size and type. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
  if (isS3Configured()) {
    try {
      const r = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType };
    } catch {
      return null;
    }
  } else {
    const fullPath = getLocalPath(key);
    if (!existsSync(fullPath)) return null;
    try {
      const st = statSync(fullPath);
      return { size: st.size, contentType: key.endsWith(".webp") ? "image/webp" : "image/jpeg" };
    } catch {
      return null;
    }
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (isS3Configured()) {
    try {
      await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    } catch {
      // Ignore
    }
  } else {
    const fullPath = getLocalPath(key);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        // Ignore
      }
    }
  }
}
