import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageEnv } from "./env";

/**
 * Provider-agnostic S3 storage for lab photos (Neon Object Storage, Cloudflare R2, any S3 API).
 * The client is created lazily; endpoint, region and credentials come from the standard AWS_* variables.
 * The bucket is private: objects are only reachable through short-lived presigned URLs or this server.
 */
let client: S3Client | undefined;

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
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 120 },
  );
}

/** Presigned GET with a short expiry for viewing. */
export async function presignGet(key: string): Promise<string> {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 60 });
}

/** Server-side upload, used by the proxy upload mode. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType, ContentLength: body.byteLength }),
  );
}

/** Confirms an uploaded object exists and returns its real size and type. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | undefined } | null> {
  try {
    const r = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: r.ContentLength ?? 0, contentType: r.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
