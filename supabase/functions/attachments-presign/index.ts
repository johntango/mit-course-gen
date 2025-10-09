import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.336.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.336.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REGION = Deno.env.get("S3FS_REGION") || Deno.env.get("AWS_REGION") || "us-east-1";
const BUCKET = Deno.env.get("S3_BUCKET");
const ACCESS_KEY = Deno.env.get("S3FS_ACCESS_KEY_ID");
const SECRET_KEY = Deno.env.get("S3FS_SECRET_ACCESS_KEY");
const ENDPOINT_URL = Deno.env.get("S3FS_ENDPOINT_URL");

if (!BUCKET) throw new Error("S3_BUCKET is required");
if (!ACCESS_KEY) throw new Error("S3FS_ACCESS_KEY_ID is required");
if (!SECRET_KEY) throw new Error("S3FS_SECRET_ACCESS_KEY is required");

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const body = await req.json() as PresignRequest;
    if (!body.lesson_id || !body.filename) {
      return new Response(
        JSON.stringify({ error: "lesson_id and filename required" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating presigned URL for lesson ${body.lesson_id}, file: ${body.filename}`);

    const key = `lessons/${body.lesson_id}/${Date.now()}-${randomHex(8)}-${body.filename}`;
    const mime = body.mime_type || "application/octet-stream";

    // Configure S3 client with credentials
    const s3Config: any = {
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
    };

    // Add custom endpoint if provided (for S3-compatible services)
    if (ENDPOINT_URL) {
      s3Config.endpoint = ENDPOINT_URL;
      s3Config.forcePathStyle = true;
    }

    const client = new S3Client(s3Config);
    
    // Create the PUT command
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: mime,
    });

    // Generate presigned URL (expires in 15 minutes)
    const expiresIn = 60 * 15;
    const signedUrl = await getSignedUrl(client, command, { expiresIn });

    console.log(`Generated presigned URL for path: ${key}`);

    const presignPayload = {
      upload_url: signedUrl,
      storage_bucket: BUCKET,
      storage_path: key,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      mime_type: mime,
      public: !!body.public,
    };

    return new Response(JSON.stringify(presignPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error generating presigned URL:", err);
    return new Response(
      JSON.stringify({ error: String(err) }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});