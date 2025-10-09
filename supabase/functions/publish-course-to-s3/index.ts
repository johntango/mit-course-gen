import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.515.0";

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json() as PublishRequest;
    const { course_id } = body;

    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Publishing course ${course_id} to S3...`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update status to syncing
    await supabase.from("courses").update({ 
      s3_sync_status: "syncing",
      s3_error_message: null 
    }).eq("id", course_id);

    // Fetch complete course data
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${courseError?.message}`);
    }

    // Fetch modules with lessons
    const { data: modules, error: modulesError } = await (supabase as any)
      .from("modules")
      .select("*")
      .eq("course_id", course_id)
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

    // Configure S3 client
    const s3Config: any = {
      region: REGION,
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
    };

    if (ENDPOINT_URL) {
      s3Config.endpoint = ENDPOINT_URL;
      s3Config.forcePathStyle = true;
    }

    const s3Client = new S3Client(s3Config);

    // Upload manifest to S3
    const manifestKey = `courses/${course_id}/manifest.json`;
    const manifestCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: manifestKey,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(manifestCommand);

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
    }).eq("id", course_id);

    return new Response(
      JSON.stringify({
        success: true,
        manifest_url: manifestUrl,
        course_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error publishing course to S3:", error);
    
    // Update course with error status if we have the course_id
    const body = await req.json().catch(() => ({}));
    if (body.course_id) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("courses").update({
        s3_sync_status: "error",
        s3_error_message: String(error),
      }).eq("id", body.course_id);
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
