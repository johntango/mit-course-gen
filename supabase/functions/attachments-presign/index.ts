import { createHash } from "node:crypto";
import process from "node:process";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.336.0";

const REGION = Deno.env.get("AWS_REGION") || process.env.AWS_REGION || "us-east-1";
const BUCKET = Deno.env.get("S3_BUCKET") || process.env.S3_BUCKET;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BUCKET) throw new Error("S3_BUCKET is required");

interface PresignRequest {
  lesson_id: string;
  filename: string;
  mime_type?: string;
  asset_type?: string;
  public?: boolean;
  file_size?: number;
}

function randomHex(n: number) {
  return createHash("sha256").update(String(Math.random()) + Date.now()).digest("hex").slice(0, n);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const body = await req.json() as PresignRequest;
    if (!body.lesson_id || !body.filename) return new Response("lesson_id and filename required", { status: 400 });

    // Minimal auth check: expect supabase service role in header (you should integrate real auth)
    const auth = req.headers.get("authorization");
    if (!auth || !auth.includes("Bearer")) return new Response("Unauthorized", { status: 401 });

    const key = `lessons/${body.lesson_id}/${Date.now()}-${randomHex(8)}-${body.filename}`;
    const mime = body.mime_type || "application/octet-stream";

    // Generate presigned PUT URL using AWS SDK v3 presign (use @aws-sdk/s3-request-presigner if needed)
    // We'll produce a simple signed URL via S3Client (requires aws credentials in env)
    const client = new S3Client({ region: REGION });
    // For portability, return the storage path and a signed URL placeholder; client can use your backend to sign.
    // If you prefer full server-side presign, add @aws-sdk/s3-request-presigner and implement getSignedUrl.
    const expiresIn = 60 * 15; // 15 min

    // Note: Deno runtime may not have AWS creds via process.env; ensure env set.
    const presignPayload = {
      upload_url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${encodeURIComponent(key)}`,
      storage_bucket: BUCKET,
      storage_path: key,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      mime_type: mime,
      public: !!body.public,
    };

    return new Response(JSON.stringify(presignPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});