import "server-only";
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageEnv } from "./env";

/**
 * Provider-agnostic S3 storage for lab photos (Neon Object Storage, Cloudflare R2, any S3 API).
 * Outside production, an unset S3_BUCKET falls back to the local public/uploads directory so the app
 * runs without a bucket. Production never falls back: the deployment filesystem is read-only and
 * files written at runtime are not served, so a missing variable must surface as an error that names it.
 */
let client: S3Client | undefined;

function usesLocalDisk(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.S3_BUCKET;
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

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export function newObjectKey(admissionId: string, contentType: string): string {
  return `lab/${admissionId}/${crypto.randomUUID()}.${EXT[contentType] ?? "bin"}`;
}

/** Presigned PUT for direct browser upload. The content length is signed, so it cannot be changed. */
export async function presignPut(key: string, contentType: string, size: number): Promise<string> {
  if (usesLocalDisk()) throw new Error("Direct presigned upload requires S3. Use proxy upload mode.");
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 120 },
  );
}

/** Presigned GET with a short expiry for viewing, or the local public URL in local-disk mode. */
export async function presignGet(key: string): Promise<string> {
  if (usesLocalDisk()) return `/uploads/${key}`;
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 60 });
}

/** Server-side upload, used by the proxy upload route. Saves locally in local-disk mode. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (usesLocalDisk()) {
    const fullPath = getLocalPath(key);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, body);
    return;
  }
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, ContentLength: body.byteLength }),
  );
}

/** Confirms an uploaded object exists and returns its real size and type. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
  if (usesLocalDisk()) {
    const fullPath = getLocalPath(key);
    if (!existsSync(fullPath)) return null;
    return { size: statSync(fullPath).size, contentType: undefined };
  }
  try {
    const r = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: r.ContentLength ?? 0, contentType: r.ContentType };
  } catch (e) {
    console.error("head object failed", key, e);
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (usesLocalDisk()) {
    const fullPath = getLocalPath(key);
    if (existsSync(fullPath)) unlinkSync(fullPath);
    return;
  }
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
