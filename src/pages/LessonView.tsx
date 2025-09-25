import { useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const InlineVideoPlayer = ({ url, title }: { url: string; title?: string }) => (
  <video
    controls
    playsInline
    preload="metadata"
    className="w-full rounded-lg border border-border/50 my-3"
    src={url}
    aria-label={title || "Lesson video"}
  />
);

const displayVideoId = (vid?: string | null) =>
  vid && /^dryRun(_|$)/.test(vid) ? "dryRun" : vid || "—";

const LessonView = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();

  // Load lesson (with module + course names)
  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select(
          `
          *,
          modules (*, courses (*))
        `
        )
        .eq("id", lessonId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!lessonId,
  });

  // Load all lessons to compute prev/next
  const { data: allLessons, isLoading: allLessonsLoading } = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select(
          `
          *,
          lessons (*)
        `
        )
        .eq("course_id", courseId)
        .order("position");
      if (error) throw error;
      const list =
        data
          .flatMap((module: any) =>
            (module.lessons ?? []).map((l: any) => ({ ...l, moduleTitle: module.title }))
          )
          .sort((a: any, b: any) => a.position - b.position) ?? [];
      return list as any[];
    },
    enabled: !!courseId,
  });

  // Latest completed video for this lesson
  const { data: completedRow } = useQuery({
    queryKey: ["lesson-completed-video", lessonId],
    enabled: !!lessonId,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_videos")
        .select("id, lesson_id, video_status, video_url, created_at")
        .eq("lesson_id", lessonId)
        .eq("video_status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; video_url: string } | null;
    },
  });

  // Latest active job (pending/processing)
  const { data: activeRow } = useQuery({
    queryKey: ["lesson-active-video", lessonId],
    enabled: !!lessonId,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_videos")
        .select(
          "id, lesson_id, video_status, video_id, created_at, target_duration_s"
        )
        .eq("lesson_id", lessonId)
        .in("video_status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as
        | { id: string; video_id?: string | null; video_status: string; target_duration_s?: number | null }
        | null;
    },
  });

  const firstImageSeen = useRef(false);
  useEffect(() => {
    firstImageSeen.current = false;
  }, [lessonId, lesson?.content]);

  const currentLessonIndex = useMemo(
    () => (allLessons?.findIndex((l: any) => l.id === lessonId) ?? -1),
    [allLessons, lessonId]
  );
  const previousLesson =
    currentLessonIndex > 0 ? allLessons?.[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < (allLessons?.length ?? 0) - 1
      ? allLessons?.[currentLessonIndex + 1]
      : null;

  if (lessonLoading || allLessonsLoading) {
    return (
      <div className="min-h-screen bg-gradient-secondary">
        <div className="container mx-auto py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-64 w-full mb-6" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Lesson not found</h1>
          <Button onClick={() => navigate(`/course/${courseId}`)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>
        </div>
      </div>
    );
  }

  // “Video block” to render under the first image (or under title if no image)
  const VideoBlock = () => {
    if (completedRow?.video_url) {
      return (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default">Video ready</Badge>
            <a
              href={completedRow.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-sm"
            >
              Open in new tab
            </a>
          </div>
          <InlineVideoPlayer url={completedRow.video_url} title={lesson.title} />
        </div>
      );
    }
    if (activeRow) {
      return (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Badge variant="secondary">Rendering…</Badge>
          <code className="px-1.5 py-0.5 rounded bg-muted">
            {displayVideoId(activeRow.video_id)}
          </code>
          {typeof activeRow.target_duration_s === "number" && (
            <span>• {Math.round(activeRow.target_duration_s / 60)} min</span>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom Markdown renderer: after the FIRST <img>, inject <VideoBlock />
  const MarkdownWithInlineVideo = (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold text-foreground mb-3 mt-5 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-medium text-foreground mb-2 mt-4 first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-foreground mb-3 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-4 space-y-1 text-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="text-foreground">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-4">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4">
            {children}
          </pre>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-foreground">{children}</em>,
        img: ({ src, alt }) => {
          // Render the image
          const imgEl = (
            <img
              src={src || ""}
              alt={alt || "Lesson image"}
              className="w-full max-w-2xl mx-auto rounded-lg shadow-lg my-6 first:mt-0"
            />
          );
          // If this is the FIRST image we encounter, also render the VideoBlock beneath it
          if (!firstImageSeen.current) {
            firstImageSeen.current = true;
            return (
              <div>
                {imgEl}
                <VideoBlock />
              </div>
            );
          }
          return imgEl;
        },
      }}
    >
      {lesson.content || "No content available for this lesson."}
    </ReactMarkdown>
  );

  // If there is NO image at all, we still want to show the VideoBlock beneath the title once.
  const showTopVideo =
    !/\!\[[^\]]*\]\([^)]+\)/.test(lesson.content ?? "") && // no markdown image pattern
    (completedRow?.video_url || activeRow); // only show block if something to show

  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="container mx-auto py-12">
        <div className="flex items-center justify-between mb-8">
          <Button onClick={() => navigate(`/course/${courseId}`)} variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="w-4 h-4" />
            <span>{lesson.modules?.courses?.title}</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="bg-card border-border/50 mb-8">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-foreground">
                {lesson.title}
              </CardTitle>
              <p className="text-muted-foreground">Module: {lesson.modules?.title}</p>
              {showTopVideo && <VideoBlock />}
            </CardHeader>
            <CardContent>
              <div className="markdown-content text-foreground leading-relaxed space-y-4">
                {MarkdownWithInlineVideo}
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div>
              {previousLesson && (
                <Button
                  onClick={() => navigate(`/course/${courseId}/lesson/${previousLesson.id}`)}
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous: {previousLesson.title}
                </Button>
              )}
            </div>

            <div>
              {nextLesson && (
                <Button onClick={() => navigate(`/course/${courseId}/lesson/${nextLesson.id}`)}>
                  Next: {nextLesson.title}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonView;
