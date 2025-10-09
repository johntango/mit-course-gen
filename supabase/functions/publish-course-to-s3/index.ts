import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REGION = Deno.env.get("S3FS_REGION") || "us-east-1";
const BUCKET = Deno.env.get("S3_BUCKET") || "tangobucket";
const ACCESS_KEY = Deno.env.get("S3FS_ACCESS_KEY_ID")!;
const SECRET_KEY = Deno.env.get("S3FS_SECRET_ACCESS_KEY")!;
const ENDPOINT_URL = Deno.env.get("S3FS_ENDPOINT_URL");
const S3_PUBLIC_BASE = Deno.env.get("S3_PUBLIC_BASE");

interface PublishRequest {
  course_id: string;
}

// Manual AWS Signature V4 implementation (no filesystem dependencies)
async function signS3PutRequest(
  bucket: string,
  key: string,
  body: string,
  region: string,
  accessKey: string,
  secretKey: string,
  endpoint?: string
): Promise<{ url: string; headers: Record<string, string> }> {
  const encoder = new TextEncoder();
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  
  // For standard S3, use virtual-hosted-style URLs (bucket.s3.region.amazonaws.com)
  // For custom endpoints (like DigitalOcean Spaces), use path-style
  let host: string;
  let url: string;
  let canonicalUri: string;
  
  if (endpoint) {
    // Custom endpoint - use path style (endpoint/bucket/key)
    const endpointUrl = new URL(endpoint);
    host = endpointUrl.host;
    url = `${endpoint}/${bucket}/${key}`;
    canonicalUri = `/${bucket}/${key}`;
  } else {
    // Standard AWS S3 - use virtual-hosted style (bucket.s3.region.amazonaws.com/key)
    host = `${bucket}.s3.${region}.amazonaws.com`;
    url = `https://${host}/${key}`;
    canonicalUri = `/${key}`;
  }

  // Hash the payload
  const payloadHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(body)))
  ).map(b => b.toString(16).padStart(2, '0')).join('');

  // Create canonical request
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)))
  ).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n');

  // Calculate signature
  const getSignatureKey = async (key: string, dateStamp: string, regionName: string, serviceName: string) => {
    const kDate = await hmac(`AWS4${key}`, dateStamp);
    const kRegion = await hmac(kDate, regionName);
    const kService = await hmac(kRegion, serviceName);
    const kSigning = await hmac(kService, 'aws4_request');
    return kSigning;
  };

  const hmac = async (key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> => {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      typeof key === 'string' ? encoder.encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  };

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, 's3');
  const signature = Array.from(
    new Uint8Array(await hmac(signingKey, stringToSign))
  ).map(b => b.toString(16).padStart(2, '0')).join('');

  // Build authorization header
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url,
    headers: {
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorization,
      'Content-Type': 'application/json',
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let courseId: string | undefined;
  
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json() as PublishRequest;
    courseId = body.course_id;

    if (!courseId) {
      return new Response(JSON.stringify({ error: "course_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Publishing course ${courseId} to S3...`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update status to syncing
    await supabase.from("courses").update({ 
      s3_sync_status: "syncing",
      s3_error_message: null 
    }).eq("id", courseId);

    // Fetch complete course data
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${courseError?.message}`);
    }

    // Fetch modules with lessons
    const { data: modules, error: modulesError } = await (supabase as any)
      .from("modules")
      .select("*")
      .eq("course_id", courseId)
      .order("position", { ascending: true });

    if (modulesError) throw modulesError;

    // Fetch all lessons for this course
    const moduleIds = modules?.map((m: any) => m.id) || [];
    const { data: lessons, error: lessonsError } = await (supabase as any)
      .from("lessons")
      .select("*")
      .in("module_id", moduleIds)
      .order("position", { ascending: true });

    if (lessonsError) throw lessonsError;

    // Fetch lesson videos and attachments
    const lessonIds = lessons?.map((l: any) => l.id) || [];
    
    const { data: videos } = await (supabase as any)
      .from("lesson_videos")
      .select("*")
      .in("lesson_id", lessonIds)
      .eq("video_status", "completed");

    const { data: attachments } = await (supabase as any)
      .from("lesson_attachments")
      .select("*")
      .in("lesson_id", lessonIds);

    // Build manifest structure
    const manifest = {
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        target_knowledge_level: course.target_knowledge_level,
        length_hours: course.length_hours,
        created_by: course.created_by,
        created_at: course.created_at,
        updated_at: course.updated_at,
      },
      modules: modules?.map((mod: any) => ({
        id: mod.id,
        title: mod.title,
        description: mod.description,
        position: mod.position,
        lessons: lessons
          ?.filter((l: any) => l.module_id === mod.id)
          .map((lesson: any) => {
            const lessonVideos = videos?.filter((v: any) => v.lesson_id === lesson.id) || [];
            const lessonAttachments = attachments?.filter((a: any) => a.lesson_id === lesson.id) || [];
            
            return {
              id: lesson.id,
              title: lesson.title,
              content: lesson.content,
              position: lesson.position,
              video_script: lesson.video_script,
              videos: lessonVideos.map((v: any) => ({
                id: v.id,
                video_url: v.video_url,
                public_url: v.public_url,
                storage_path: v.storage_path,
                video_duration_s: v.video_duration_s,
                target_duration_s: v.target_duration_s,
                created_at: v.created_at,
              })),
              attachments: lessonAttachments.map((a: any) => ({
                id: a.id,
                filename: a.filename,
                asset_type: a.asset_type,
                public_url: a.public_url,
                storage_path: a.storage_path,
                mime_type: a.mime_type,
                alt_text: a.alt_text,
              })),
            };
          }),
      })),
      published_at: new Date().toISOString(),
    };

    // Upload to S3 using manual signature
    const manifestKey = `courses/${courseId}/manifest.json`;
    const manifestBody = JSON.stringify(manifest, null, 2);
    
    console.log(`Uploading to S3 - Bucket: ${BUCKET}, Region: ${REGION}, Endpoint: ${ENDPOINT_URL || 'default'}, Key: ${manifestKey}`);
    
    const { url, headers } = await signS3PutRequest(
      BUCKET,
      manifestKey,
      manifestBody,
      REGION,
      ACCESS_KEY,
      SECRET_KEY,
      ENDPOINT_URL
    );

    console.log(`S3 PUT URL: ${url}`);

    const s3Response = await fetch(url, {
      method: 'PUT',
      headers,
      body: manifestBody,
    });

    if (!s3Response.ok) {
      const errorText = await s3Response.text();
      console.error(`S3 upload failed - Status: ${s3Response.status}, Response: ${errorText.substring(0, 500)}`);
      throw new Error(`S3 upload failed (${s3Response.status}): ${errorText}`);
    }

    const manifestUrl = S3_PUBLIC_BASE 
      ? `${S3_PUBLIC_BASE}/${manifestKey}`
      : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${manifestKey}`;

    console.log(`Course published to S3: ${manifestUrl}`);

    // Update course with success status
    await supabase.from("courses").update({
      s3_sync_status: "synced",
      s3_published_at: new Date().toISOString(),
      s3_manifest_url: manifestUrl,
      s3_error_message: null,
    }).eq("id", courseId);

    return new Response(
      JSON.stringify({
        success: true,
        manifest_url: manifestUrl,
        course_id: courseId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error publishing course to S3:", error);
    
    // Update course with error status
    if (courseId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("courses").update({
        s3_sync_status: "error",
        s3_error_message: String(error),
      }).eq("id", courseId);
    }

    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
