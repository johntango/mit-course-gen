// src/pages/CourseView.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Clapperboard, Loader2, RefreshCcw } from "lucide-react";

/** Inline video player kept minimal; swaps in any https URL returned by HeyGen */
function InlineVideoPlayer({ url, title }: { url: string; title?: string }) {
  // If your URLs are not direct mp4/streamable, swap for react-player or an <iframe>.
  return (
    <video
      className="w-full rounded-md border border-border/50"
      controls
      preload="metadata"
      src={url}
      aria-label={title || "Lesson video"}
    />
  );
}

/** Extract first Markdown image URL (e.g., ![alt](https://...)) */
function firstImageUrl(markdown?: string | null): string | null {
  if (!markdown) return null;
  const m = markdown.match(/!\[[^\]]*\]\((?<u>[^)\s]+)(?:\s+"[^"]*")?\)/);
  return m?.groups?.u ?? null;
}

/** Explain Edge Function errors from supabase.functions.invoke */
async function explainEdgeError(error: any): Promise<string> {
  try {
    const res: Response | undefined = error?.context?.response;
    if (!res) return error?.message || "Edge function failed";
    const text = await res.clone().text().catch(() => "");
    try {
      const j = JSON.parse(text);
      return `${res.status} ${j.details || j.error || j.message || text}`;
    } catch {
      return `${res.status} ${text || error?.message || "Edge function failed"}`;
    }
  } catch (e: any) {
    return String(error?.message ?? e ?? "Edge function failed");
  }
}

const DEFAULT_MINUTES = 3;

export default function CourseView() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local script preview (user can tweak before sending to generate-lesson-video)
  const [scriptDrafts, setScriptDrafts] = useState<Record<string, string>>({});
  // Per-lesson target duration
  const [minutesByLesson, setMinutesByLesson] = useState<Record<string, number>>({});

  /* --------------------------- Data fetching --------------------------- */

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course-read", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ["modules-read", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select(`
          *,
          lessons(*)
        `)
        .eq("course_id", courseId)
        .order("position");

      if (error) throw error;
      return (
        data?.map((m: any) => ({
          ...m,
          lessons: (m.lessons ?? []).sort((a: any, b: any) => a.position - b.position),
        })) || []
      );
    },
  });

  const lessonIds = useMemo(() => {
    if (!modules) return [] as string[];
    return modules.flatMap((m: any) => m.lessons?.map((l: any) => l.id) ?? []);
  }, [modules]);

  // Active/in-flight jobs
  const { data: activeJobs } = useQuery({
    queryKey: ["activeVideoJobs-read", courseId, lessonIds.join(",")],
    enabled: !!courseId && lessonIds.length > 0,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lesson_videos")
        .select("id, lesson_id, video_status, video_id, created_at, target_duration_s")
        .in("lesson_id", lessonIds)
        .in("video_status", ["pending", "processing"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeByLesson: Record<string, any[]> = useMemo(() => {
    const map: Record<string, any[]> = {};
    (activeJobs ?? []).forEach((row: any) => {
      map[row.lesson_id] = map[row.lesson_id] || [];
      map[row.lesson_id].push(row);
    });
    return map;
  }, [activeJobs]);

  // Completed videos — show latest per lesson
  const { data: completedRows } = useQuery({
    queryKey: ["completedLessonVideos-read", courseId, lessonIds.join(",")],
    enabled: !!courseId && lessonIds.length > 0,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lesson_videos")
        .select("id, lesson_id, video_status, video_url, created_at")
        .in("lesson_id", lessonIds)
        .eq("video_status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const completedByLesson: Record<string, { id: string; video_url: string }> = useMemo(() => {
    const map: Record<string, { id: string; video_url: string }> = {};
    (completedRows ?? []).forEach((row: any) => {
      if (!map[row.lesson_id] && row.video_url) map[row.lesson_id] = { id: row.id, video_url: row.video_url };
    });
    return map;
  }, [completedRows]);

  /* --------------------------- Mutations --------------------------- */

  const refreshCourseVideos = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("refresh-course-videos", {
        body: { courseId, force: true },
      });
      if (error) {
        const msg = await explainEdgeError(error);
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeVideoJobs-read", courseId] });
      queryClient.invalidateQueries({ queryKey: ["completedLessonVideos-read", courseId] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to check video status", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const generateLessonScript = useMutation({
    mutationFn: async ({ lessonId, minutes }: { lessonId: string; minutes: number }) => {
      const { data, error } = await supabase.functions.invoke("generate-lesson-script", {
        body: { lessonId, targetDurationMinutes: minutes, persistDraft: true },
      });
      if (error) {
        const msg = await explainEdgeError(error);
        throw new Error(msg);
      }
      return data as { script: string; lessonVideoId?: string };
    },
    onSuccess: (data, vars) => {
      setScriptDrafts((prev) => ({ ...prev, [vars.lessonId]: data.script }));
      toast({ title: "Script generated", description: "Draft saved to lesson_videos." });
    },
    onError: (err: any) => {
      toast({ title: "Script generation error", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const generateLessonVideo = useMutation({
    mutationFn: async ({
      lessonId,
      minutes,
      forceRegenerate = false,
    }: {
      lessonId: string;
      minutes: number;
      forceRegenerate?: boolean;
    }) => {
      const inlineScript = scriptDrafts?.[lessonId];
      const { data, error } = await supabase.functions.invoke("generate-lesson-video", {
        body: {
          lessonId,
          targetDurationMinutes: minutes,
          forceRegenerate,
          ...(inlineScript ? { script: inlineScript } : {}),
        },
      });
      if (error) {
        const msg = await explainEdgeError(error);
        throw new Error(msg);
      }
      return data as {
        accepted: boolean;
        status: "processing" | "reused" | "skipped" | "dry_run";
        lessonVideoId?: string;
        providerVideoId?: string;
        message?: string;
      };
    },
    onSuccess: (data) => {
      toast({ title: "Generate Video", description: data?.message ?? "Video job accepted." });
      refreshCourseVideos.mutate();
    },
    onError: (err: any) => {
      toast({ title: "Video generation error", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  /* --------------------------- Helpers --------------------------- */

  useEffect(() => {
    if (!modules) return;
    setMinutesByLesson((prev) => {
      const next = { ...prev };
      modules.forEach((m: any) =>
        (m.lessons || []).forEach((l: any) => {
          if (next[l.id] == null) next[l.id] = DEFAULT_MINUTES;
        })
      );
      return next;
    });
  }, [modules]);

  const displayVideoId = (vid?: string | null) => (vid && /^dryRun(_|$)/.test(vid) ? "dryRun" : vid || "—");

  /* ------------------------------ UI ------------------------------ */

  if (courseLoading || modulesLoading) {
    return (
      <div className="min-h-screen bg-gradient-secondary">
        <div className="container mx-auto py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Course not found</h1>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="container mx-auto py-12">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate(`/course/${courseId}`)} variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course Overview
          </Button>

          <Button onClick={() => refreshCourseVideos.mutate()} variant="secondary" disabled={refreshCourseVideos.isPending}>
            {refreshCourseVideos.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Check Video Status
              </>
            )}
          </Button>
        </div>

        <Card className="bg-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">{course.title}</CardTitle>
            <CardDescription>Work through each module and lesson. You can generate a narrated video per lesson.</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          {modules?.map((module: any, moduleIndex: number) => (
            <Card key={module.id} className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                    {moduleIndex + 1}
                  </span>
                  {module.title}
                </CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {module.lessons?.map((lesson: any, lessonIndex: number) => {
                  const minutes = minutesByLesson[lesson.id] ?? DEFAULT_MINUTES;
                  const isGenScriptPending =
                    generateLessonScript.isPending && (generateLessonScript.variables as any)?.lessonId === lesson.id;
                  const isGenVideoPending =
                    generateLessonVideo.isPending && (generateLessonVideo.variables as any)?.lessonId === lesson.id;

                  const jobs = activeByLesson[lesson.id] ?? [];
                  const active = jobs[0]; // latest first

                  return (
                    <div key={lesson.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Lesson {lessonIndex + 1}</Badge>
                          <span className="font-medium">{lesson.title}</span>
                        </div>
                      </div>

                      {/* Hero image (from Markdown) */}
                      {(() => {
                        const hero = firstImageUrl(lesson.content);
                        if (!hero) return null;
                        return (
                          <div className="mb-3">
                            <img
                              src={hero}
                              alt={`${lesson.title} illustration`}
                              className="w-full h-auto rounded-md border border-border/50"
                              loading="lazy"
                            />
                          </div>
                        );
                      })()}

                      {/* Video block under the image */}
                      <div className="mt-2">
                        {completedByLesson[lesson.id]?.video_url ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Video ready</Badge>
                              <a
                                href={completedByLesson[lesson.id].video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                Open in new tab
                              </a>
                            </div>
                            <InlineVideoPlayer url={completedByLesson[lesson.id].video_url} title={lesson.title} />
                          </div>
                        ) : active ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">Rendering…</Badge>
                            <code className="px-1.5 py-0.5 rounded bg-muted">{displayVideoId(active.video_id)}</code>
                            {typeof active.target_duration_s === "number" && (
                              <span>• {Math.round(active.target_duration_s / 60)} min</span>
                            )}
                          </div>
                        ) : (
                          <em className="text-sm">No completed video yet</em>
                        )}
                      </div>

                      {/* Script + buttons for learners */}
                      <div className="rounded-md border border-border/60 p-3 mt-4">
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                          <div className="w-full md:max-w-xs">
                            <Label htmlFor={`minutes-${lesson.id}`}>Target length (minutes)</Label>
                            <Input
                              id={`minutes-${lesson.id}`}
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={minutes}
                              onChange={(e) =>
                                setMinutesByLesson((prev) => ({ ...prev, [lesson.id]: Number(e.target.value) || 3 }))
                              }
                              placeholder={String(DEFAULT_MINUTES)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Decimals allowed, e.g., <code>1.5</code> for ~90 seconds.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                generateLessonScript.mutate({
                                  lessonId: lesson.id,
                                  minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_MINUTES,
                                })
                              }
                              disabled={isGenScriptPending}
                            >
                              {isGenScriptPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Generating Script...
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Generate Script
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              onClick={() =>
                                generateLessonVideo.mutate({
                                  lessonId: lesson.id,
                                  minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_MINUTES,
                                  forceRegenerate: false,
                                })
                              }
                              disabled={isGenVideoPending}
                            >
                              {isGenVideoPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Generating Video...
                                </>
                              ) : (
                                <>
                                  <Clapperboard className="w-4 h-4 mr-2" />
                                  Generate & Insert Video
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refreshCourseVideos.mutate()}
                              disabled={refreshCourseVideos.isPending}
                            >
                              {refreshCourseVideos.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Checking…
                                </>
                              ) : (
                                "Check Status"
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Optional script preview for learner */}
                        <div className="mt-3">
                          <Label>Draft Script (preview)</Label>
                          <Textarea
                            rows={6}
                            placeholder="After generating, you can review or tweak the script here before creating a video."
                            value={scriptDrafts[lesson.id] ?? ""}
                            onChange={(e) => setScriptDrafts((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Short excerpt of lesson text */}
                      <div className="mt-3 text-muted-foreground">
                        {lesson.content ? (
                          <div className="prose max-w-none">
                            {lesson.content.substring(0, 200)}
                            {lesson.content.length > 200 && "..."}
                          </div>
                        ) : (
                          <em>No content yet</em>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
