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
import { ArrowLeft, Edit3, Trash2, Save, Upload, X, Image, RefreshCcw, Video } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Helper to extract structured error messages from supabase.functions.invoke
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

const CourseManagement = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [lessonContent, setLessonContent] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Video workflow UI state
  const [scriptDrafts, setScriptDrafts] = useState<Record<string, string>>({});
  const [minutesByLesson, setMinutesByLesson] = useState<Record<string, number>>({});
  const [dryRun, setDryRun] = useState<boolean>(false); // toggle to pass to generate-lesson-video

  // Fetch course data
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch modules and lessons
  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ["modules", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select(`
          *,
          lessons (*)
        `)
        .eq("course_id", courseId)
        .order("position");

      if (error) throw error;

      return (
        data?.map((module: any) => ({
          ...module,
          lessons: module.lessons?.sort((a: any, b: any) => a.position - b.position) || [],
        })) || []
      );
    },
    enabled: !!courseId,
  });

  // Compute lesson IDs once for queries/keys
  const lessonIds = useMemo(() => {
    if (!modules) return [] as string[];
    return modules.flatMap((m: any) => m.lessons?.map((l: any) => l.id) ?? []);
  }, [modules]);

  // Active jobs (pending/processing) — auto-refresh
  const { data: activeJobs } = useQuery({
    queryKey: ["activeVideoJobs", courseId, lessonIds.join(",")],
    enabled: !!courseId && lessonIds.length > 0,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_videos")
        .select(
          "id, lesson_id, video_status, video_id, created_at, target_duration_s, check_attempts, last_checked_at, next_check_at"
        )
        .in("lesson_id", lessonIds)
        .in("video_status", ["pending", "processing"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Map active by lesson (latest first)
  const activeByLesson: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    (activeJobs ?? []).forEach((row: any) => {
      if (!map[row.lesson_id]) map[row.lesson_id] = row;
    });
    return map;
  }, [activeJobs]);

  // Completed videos — auto-refresh; latest per lesson
  const { data: completedRows } = useQuery({
    queryKey: ["completedLessonVideos", courseId, lessonIds.join(",")],
    enabled: !!courseId && lessonIds.length > 0,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
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
      if (!map[row.lesson_id] && row.video_url) {
        map[row.lesson_id] = { id: row.id, video_url: row.video_url };
      }
    });
    return map;
  }, [completedRows]);

  // Delete course mutation
  const deleteCourse = useMutation({
    mutationFn: async () => {
      const { data: modulesData } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", courseId);

      if (modulesData && modulesData.length > 0) {
        const moduleIds = modulesData.map((m: any) => m.id);
        await supabase.from("lessons").delete().in("module_id", moduleIds);
      }

      await supabase.from("modules").delete().eq("course_id", courseId);
      await supabase.from("course_specs").delete().eq("course_id", courseId);
      await supabase.from("agent_runs").update({ course_id: null }).eq("course_id", courseId);
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Course deleted",
        description: "Course and all related content have been successfully deleted.",
      });
      navigate("/");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast({ title: "Error", description: "Failed to delete course. Please try again.", variant: "destructive" });
    },
  });

  // Update lesson mutation
  const updateLesson = useMutation({
    mutationFn: async ({ lessonId, title, content }: { lessonId: string; title: string; content: string }) => {
      const { error } = await supabase.from("lessons").update({ title, content }).eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Lesson updated", description: "Lesson has been successfully updated." });
      setEditingLesson(null);
      queryClient.invalidateQueries({ queryKey: ["modules", courseId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update lesson.", variant: "destructive" });
    },
  });

  // Populate images mutation
  const populateImages = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("populate-course-images", { body: { courseId } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Images populated",
        description: `Successfully processed ${data.processedLessons}/${data.totalLessons} lessons with images.`,
      });
      queryClient.invalidateQueries({ queryKey: ["modules", courseId] });
    },
    onError: (error) => {
      console.error("Populate images error:", error);
      toast({ title: "Error", description: "Failed to populate images. Please try again.", variant: "destructive" });
    },
  });

  // NEW: Generate script for a lesson (persists draft)
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
      queryClient.invalidateQueries({ queryKey: ["modules", courseId] });
    },
    onError: (err: any) => {
      toast({ title: "Script generation error", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  // NEW: Refresh course videos (poll status)
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
      queryClient.invalidateQueries({ queryKey: ["activeVideoJobs", courseId] });
      queryClient.invalidateQueries({ queryKey: ["completedLessonVideos", courseId] });
      queryClient.invalidateQueries({ queryKey: ["modules", courseId] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to check video status", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  // NEW: Generate & Insert Video (per lesson) – non-blocking (returns 202 or 200 in dryRun)
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
          dryRun,
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
      queryClient.invalidateQueries({ queryKey: ["activeVideoJobs", courseId] });
    },
    onError: (err: any) => {
      toast({ title: "Video generation error", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const handleEditLesson = (lesson: any) => {
    setEditingLesson(lesson.id);
    setLessonTitle(lesson.title);
    setLessonContent(lesson.content || "");
  };

  const handleSaveLesson = () => {
    if (editingLesson) {
      updateLesson.mutate({ lessonId: editingLesson, title: lessonTitle, content: lessonContent });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `lessons/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("course-images").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("course-images").getPublicUrl(filePath);
      const publicUrl = pub.publicUrl;

      const imageMarkdown = `![Image](${publicUrl})\n\n`;
      setLessonContent((prev) => imageMarkdown + prev);

      toast({ title: "Image uploaded", description: "Image has been uploaded and added to lesson content." });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ title: "Error", description: "Failed to upload image.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    // Initialize default minutes to 3 for each lesson when modules load
    if (!modules) return;
    setMinutesByLesson((prev) => {
      const next = { ...prev } as Record<string, number>;
      modules.forEach((m: any) => (m.lessons || []).forEach((l: any) => {
        if (next[l.id] == null) next[l.id] = 3;
      }));
      return next;
    });
  }, [modules]);

  const displayVideoId = (vid?: string | null) => (vid && /^dryRun(_|$)/.test(vid) ? "dryRun" : vid || "—");

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
            Back to Course
          </Button>

          <div className="flex items-center gap-2">
            {/* Dry-run toggle */}
            <label className="flex items-center gap-2 text-sm mr-2">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              Dry-run
            </label>

            <Button onClick={() => refreshCourseVideos.mutate()} variant="secondary">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh Videos
            </Button>

            {course.status === "completed" && (
              <Button onClick={() => populateImages.mutate()} disabled={(populateImages as any).isPending} variant="outline">
                <Image className="w-4 h-4 mr-2" />
                {(populateImages as any).isPending ? "Populating Images..." : "Populate Images"}
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Course
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the course and all its modules and lessons.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteCourse.mutate()}>Delete Course</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Card className="bg-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">Manage Course: {course.title}</CardTitle>
            <CardDescription>Edit course content, modules, and lessons</CardDescription>
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
                {module.lessons?.map((lesson: any, lessonIndex: number) => (
                  <div key={lesson.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Lesson {lessonIndex + 1}</Badge>
                        <span className="font-medium">{lesson.title}</span>
                      </div>
                      {editingLesson === lesson.id ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveLesson} disabled={(updateLesson as any).isPending}>
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingLesson(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleEditLesson(lesson)}>
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>

                    {/* Content view / edit */}
                    {editingLesson === lesson.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`lesson-title-${lesson.id}`}>Lesson Title</Label>
                          <Input id={`lesson-title-${lesson.id}`} value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label htmlFor={`lesson-content-${lesson.id}`}>Lesson Content</Label>
                            <div className="flex gap-2">
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" id={`image-upload-${lesson.id}`} />
                              <Button size="sm" variant="outline" onClick={() => document.getElementById(`image-upload-${lesson.id}`)?.click()} disabled={uploadingImage}>
                                <Upload className="w-4 h-4 mr-1" />
                                {uploadingImage ? "Uploading..." : "Add Image"}
                              </Button>
                            </div>
                          </div>
                          <Textarea id={`lesson-content-${lesson.id}`} value={lessonContent} onChange={(e) => setLessonContent(e.target.value)} rows={10} placeholder="Enter lesson content (supports Markdown)..." />
                        </div>

                        {/* Script editor when editing lesson */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Video Script (draft)</Label>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`minutes-${lesson.id}`} className="text-sm">Length (min)</Label>
                              <Input
                                id={`minutes-${lesson.id}`}
                                type="number"
                                step="0.1"
                                min="0.5"
                                className="w-24"
                                value={minutesByLesson[lesson.id] ?? 3}
                                onChange={(e) =>
                                  setMinutesByLesson((prev) => ({ ...prev, [lesson.id]: Number(e.target.value) }))
                                }
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  generateLessonScript.mutate({
                                    lessonId: lesson.id,
                                    minutes: minutesByLesson[lesson.id] ?? 3,
                                  })
                                }
                              >
                                Generate Script
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  generateLessonVideo.mutate({
                                    lessonId: lesson.id,
                                    minutes: minutesByLesson[lesson.id] ?? 3,
                                    forceRegenerate: false,
                                  })
                                }
                              >
                                <Video className="w-4 h-4 mr-1" />
                                Generate Video
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            placeholder="No script yet. Click Generate Script or paste your own…"
                            rows={8}
                            value={scriptDrafts[lesson.id] ?? ""}
                            onChange={(e) => setScriptDrafts((p) => ({ ...p, [lesson.id]: e.target.value }))}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-muted-foreground">
                          {lesson.content ? (
                            <div className="prose max-w-none">
                              {lesson.content.substring(0, 200)}
                              {lesson.content.length > 200 && "..."}
                            </div>
                          ) : (
                            <em>No content yet</em>
                          )}
                        </div>

                        {/* Video status / link in read-only view */}
                        <div className="mt-2 text-sm">
                          {completedByLesson[lesson.id]?.video_url ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Video ready</Badge>
                              <a
                                href={completedByLesson[lesson.id].video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                Open video
                              </a>
                            </div>
                          ) : activeByLesson[lesson.id] ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Rendering…</Badge>
                              <code className="px-1.5 py-0.5 rounded bg-muted">
                                {displayVideoId(activeByLesson[lesson.id].video_id)}
                              </code>
                            </div>
                          ) : (
                            <em>No completed video yet</em>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CourseManagement;
