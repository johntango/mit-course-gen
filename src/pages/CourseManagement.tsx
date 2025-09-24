import { useEffect, useState, useMemo } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Save,
  Upload,
  X,
  Image,
  FileText,
  Clapperboard,
  Loader2,
  Copy,
  Trash,
} from "lucide-react";
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

const DEFAULT_MINUTES = "2";



// Robust extraction of edge function error payloads
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

  // Per-lesson target duration (string to preserve decimals like "1.5")
  const [lengthMinutesByLesson, setLengthMinutesByLesson] = useState<Record<string, string>>({});
  // Local draft scripts for preview/copy
  const [scriptDrafts, setScriptDrafts] = useState<Record<string, string>>({});

  // Fetch course
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch modules + lessons
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

  // Derived: all lesson ids
  const lessonIds = useMemo(() => {
    if (!modules) return [] as string[];
    return modules.flatMap((m: any) => m.lessons?.map((l: any) => l.id) ?? []);
  }, [modules]);

  // Completed videos (latest per lesson); refetch frequently to surface URLs
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

  // Map of latest completed row per lesson
  const completedByLesson: Record<string, { id: string; video_url: string }> = useMemo(() => {
    const map: Record<string, { id: string; video_url: string }> = {};
    (completedRows ?? []).forEach((row: any) => {
      if (!map[row.lesson_id] && row.video_url) {
        map[row.lesson_id] = { id: row.id, video_url: row.video_url };
      }
    });
    return map;
  }, [completedRows]);

  // Active jobs (pending, processing)
  const { data: activeJobs } = useQuery({
    queryKey: ["activeVideoJobs", courseId, lessonIds.join(",")],
    enabled: !!courseId && lessonIds.length > 0,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_videos")
        .select("id, lesson_id, video_status, video_id, created_at, target_duration_s")
        .in("lesson_id", lessonIds)
        .in("video_status", ["pending", "processing"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeByLesson = useMemo(() => {
    const map = new Map<string, any[]>();
    (activeJobs ?? []).forEach((row: any) => {
      const arr = map.get(row.lesson_id) ?? [];
      arr.push(row);
      map.set(row.lesson_id, arr);
    });
    return map;
  }, [activeJobs]);

  // Delete course (cascaded)
  const deleteCourse = useMutation({
    mutationFn: async () => {
      const { data: modulesData } = await supabase.from("modules").select("id").eq("course_id", courseId);
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
      toast({
        title: "Error",
        description: "Failed to delete course. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update lesson
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
      toast({
        title: "Error",
        description: "Failed to update lesson.",
        variant: "destructive",
      });
    },
  });

  // Populate images
  const populateImages = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("populate-course-images", {
        body: { courseId },
      });
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
      toast({
        title: "Error",
        description: "Failed to populate images. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Sweep for updates (HeyGen / emulator)
  const refreshCourseVideos = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("refresh-course-videos", {
        body: { courseId, limit: 100, force: true },
      });
      if (error) {
        const msg = await explainEdgeError(error);
        throw new Error(msg);
      }
      return data;
    },
    onSuccess: (data: any) => {
      const completed = data?.summary?.completed ?? 0;
      if (completed > 0) {
        toast({ title: "Videos updated", description: `${completed} video(s) completed and inserted.` });
      } else {
        toast({ title: "No updates", description: "No videos completed since the last check." });
      }
      queryClient.invalidateQueries({ queryKey: ["modules", courseId] });
      queryClient.invalidateQueries({ queryKey: ["activeVideoJobs", courseId] });
      queryClient.invalidateQueries({ queryKey: ["completedLessonVideos", courseId] });
    },
    onError: async (error: any) => {
      const msg = await explainEdgeError(error);
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  // Sweep once per load
  useEffect(() => {
    if (courseId) refreshCourseVideos.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Generate script (persist draft in lesson_videos)
  const generateLessonScript = useMutation({
    mutationFn: async ({ lessonId, minutes }: { lessonId: string; minutes: number }) => {
      const { data, error } = await supabase.functions.invoke("generate-lesson-script", {
        body: { lessonId, targetDurationMinutes: minutes, persistDraft: true },
      });
      if (error) {
        const msg = await explainEdgeError(error);
        throw new Error(msg);
      }
      return data as { script: string };
    },
    onSuccess: (data, vars) => {
      setScriptDrafts((prev) => ({ ...prev, [vars.lessonId]: data.script }));
      toast({ title: "Script generated", description: "A draft narration script has been generated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  // Generate & insert video (non-blocking)
  const generateLessonVideo = useMutation({
    mutationFn: async ({
      lessonId,
      minutes,
      forceRegenerate = true,
    }: {
      lessonId: string;
      minutes: number;
      forceRegenerate?: boolean;
    }) => {
      const inlineScript = scriptDrafts[lessonId];
      const { data, error } = await supabase.functions.invoke("generate-lesson-video", {
        body: {
          lessonId,
          targetDurationMinutes: minutes,
          dryRun: false,            // emulator vs real is decided by backend env
          forceRegenerate,          // avoid reuse during demos
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
      // Kick a sweep to catch fast completions
      refreshCourseVideos.mutate();
      queryClient.invalidateQueries({ queryKey: ["activeVideoJobs", courseId] });
    },
    onError: (err: any) => {
      toast({ title: "Video generation error", description: String(err?.message ?? err), variant: "destructive" });
    },
  });



type VideoPlayerProps = {
  url: string;
  title?: string;
  captionsVttUrl?: string; // optional: Supabase public URL to .vtt
};

function InlineVideoPlayer({ url, title = "Lesson Video", captionsVttUrl }: VideoPlayerProps) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const openInNewTab = () => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setOpen(true)}>Play inline</Button>
        <Button size="sm" variant="outline" onClick={openInNewTab}>
          Open in new tab
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFailed(false); }}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {!failed ? (
            <video
              key={open ? url : undefined} // unmount on close to stop playback
              src={url}
              controls
              playsInline
              preload="metadata"
              className="w-full h-auto rounded-lg"
              crossOrigin="anonymous" // needed if you later draw frames to canvas
              onError={() => setFailed(true)}
            >
              {captionsVttUrl && (
                <track kind="subtitles" srcLang="en" src={captionsVttUrl} label="English" default />
              )}
            </video>
          ) : (
            <div className="text-sm text-muted-foreground">
              This video can’t be embedded by the provider.{" "}
              <Button size="sm" variant="link" onClick={openInNewTab}>Open in a new tab instead.</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
  const firstImageUrl = (md?: string | null) => {
    if (!md) return null;
    const m = md.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/); // ![alt](url "title")
    return m?.[1] ?? null;
  };
  const handleEditLesson = (lesson: any) => {
    setEditingLesson(lesson.id);
    setLessonTitle(lesson.title);
    setLessonContent(lesson.content || "");
  };

  const handleSaveLesson = () => {
    if (editingLesson) {
      updateLesson.mutate({
        lessonId: editingLesson,
        title: lessonTitle,
        content: lessonContent,
      });
    }
  };

  const handleImageUpload =
    (lessonIdForInput?: string) => async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingImage(true);
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `lessons/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("course-images").upload(filePath, file);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("course-images").getPublicUrl(filePath);

        const imageMarkdown = `![Image](${publicUrl})\n\n`;
        setLessonContent((prev) => imageMarkdown + prev);

        toast({
          title: "Image uploaded",
          description: "Image has been uploaded and added to lesson content.",
        });
      } catch (error) {
        console.error("Error uploading image:", error);
        toast({
          title: "Error",
          description: "Failed to upload image.",
          variant: "destructive",
        });
      } finally {
        setUploadingImage(false);
        if (lessonIdForInput) {
          const el = document.getElementById(`image-upload-${lessonIdForInput}`) as HTMLInputElement | null;
          if (el) el.value = "";
        }
      }
    };

  const getMinutesForLesson = (lessonId: string) => {
    return lengthMinutesByLesson[lessonId] ?? DEFAULT_MINUTES;
  };
  const setMinutesForLesson = (lessonId: string, value: string) => {
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const normalized =
      parts.length <= 2 ? (parts.length === 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0]) : cleaned;
    setLengthMinutesByLesson((prev) => ({ ...prev, [lessonId]: normalized }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Script copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };
  // purge only dry-run rows (safe)
  const purgeDryRun = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cleanup-lesson-videos", {
        body: { onlyDryRun: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast({ title: "Purged dry-run videos", description: `${d.deleted} row(s) deleted.` });
      queryClient.invalidateQueries({ queryKey: ["activeVideoJobs", courseId] });
      queryClient.invalidateQueries({ queryKey: ["completedLessonVideos", courseId] });
    },
    onError: (e: any) => {
      toast({ title: "Purge failed", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  // purge all videos for this course
  const purgeCourseVideos = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cleanup-lesson-videos", {
        body: { courseId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast({ title: "Purged course videos", description: `${d.deleted} row(s) deleted.` });
      queryClient.invalidateQueries({ queryKey: ["activeVideoJobs", courseId] });
      queryClient.invalidateQueries({ queryKey: ["completedLessonVideos", courseId] });
    },
    onError: (e: any) => {
      toast({ title: "Purge failed", description: String(e?.message ?? e), variant: "destructive" });
    },
  });
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

          <div className="flex gap-2">
            {course.status === "completed" && (
              <>
                <Button onClick={() => populateImages.mutate()} disabled={populateImages.isPending} variant="outline">
                  <Image className="w-4 h-4 mr-2" />
                  {populateImages.isPending ? "Populating Images..." : "Populate Images"}
                </Button>
                <Button
                  onClick={() => refreshCourseVideos.mutate()}
                  disabled={refreshCourseVideos.isPending}
                  variant="outline"
                >
                  {refreshCourseVideos.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking Videos…
                    </>
                  ) : (
                    "Check Video Status"
                  )}
                </Button>
                 <Button variant="outline" onClick={() => purgeDryRun.mutate()}>
                  Purge Dry-Run
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Purge Course Videos</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all lesson videos for this course?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all rows in <code>lesson_videos</code> for this course. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => purgeCourseVideos.mutate()}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
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
            {module.lessons?.map((lesson: any, lessonIndex: number) => {
              const minutesStr = getMinutesForLesson(lesson.id);
              const minutesNum = parseFloat(minutesStr || DEFAULT_MINUTES);

              const isGenScriptPending =
                generateLessonScript.isPending &&
                (generateLessonScript.variables as any)?.lessonId === lesson.id;

              const isGenVideoPending =
                generateLessonVideo.isPending &&
                (generateLessonVideo.variables as any)?.lessonId === lesson.id;

              // Active jobs for this lesson (latest first)
              const jobs = activeByLesson.get(lesson.id) ?? [];

              return (
                <div key={lesson.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Lesson {lessonIndex + 1}</Badge>
                      <span className="font-medium">{lesson.title}</span>
                    </div>

                    {/* Active video jobs */}
                    {jobs.length > 0 && (
                      <div className="mt-2 rounded-md border border-border/60 p-2">
                        <div className="text-sm font-medium">Active video jobs</div>
                        <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {jobs.slice(0, 5).map((job: any) => (
                            <div key={job.id} className="flex items-center gap-2">
                              <code className="px-1.5 py-0.5 rounded bg-muted">
                                {displayVideoId(job.video_id)}
                              </code>
                              <span>{job.video_status}</span>
                              {typeof job.target_duration_s === "number" && (
                                <span>• {Math.round(job.target_duration_s / 60)} min</span>
                              )}
                              <span>• {new Date(job.created_at).toLocaleString()}</span>
                            </div>
                          ))}
                          {jobs.length > 5 && (
                            <div className="text-[11px] italic">(+{jobs.length - 5} more)</div>
                          )}
                        </div>
                      </div>
                    )}

                    {editingLesson === lesson.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveLesson} disabled={updateLesson.isPending}>
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

                  {/* VIDEO TOOLS */}
                  <div className="rounded-md border border-border/60 p-3 mb-3">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                      <div className="w-full md:max-w-xs">
                        <Label htmlFor={`minutes-${lesson.id}`}>Target length (minutes)</Label>
                        <Input
                          id={`minutes-${lesson.id}`}
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={minutesStr}
                          onChange={(e) => setMinutesForLesson(lesson.id, e.target.value)}
                          placeholder={DEFAULT_MINUTES}
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
                              minutes: isNaN(minutesNum) ? 3 : minutesNum,
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
                              minutes: isNaN(minutesNum) ? 3 : minutesNum,
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

                    {/* Optional: script preview */}
                    {scriptDrafts[lesson.id] && (
                      <div className="mt-3">
                        <Label>Draft Script (preview)</Label>
                        <Textarea
                          value={scriptDrafts[lesson.id]}
                          onChange={(e) => setScriptDrafts((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                          rows={8}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(scriptDrafts[lesson.id])}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setScriptDrafts((prev) => {
                                const next = { ...prev };
                                delete next[lesson.id];
                                return next;
                              })
                            }
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Clear Preview
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* LESSON CONTENT + STATUS/URL */}
                  {editingLesson === lesson.id ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor={`lesson-title-${lesson.id}`}>Lesson Title</Label>
                        <Input
                          id={`lesson-title-${lesson.id}`}
                          value={lessonTitle}
                          onChange={(e) => setLessonTitle(e.target.value)}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor={`lesson-content-${lesson.id}`}>Lesson Content</Label>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload(lesson.id)}
                              className="hidden"
                              id={`image-upload-${lesson.id}`}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => document.getElementById(`image-upload-${lesson.id}`)?.click()}
                              disabled={uploadingImage}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              {uploadingImage ? "Uploading..." : "Add Image"}
                            </Button>
                          </div>
                        </div>

                        <Textarea
                          id={`lesson-content-${lesson.id}`}
                          value={lessonContent}
                          onChange={(e) => setLessonContent(e.target.value)}
                          rows={10}
                          placeholder="Enter lesson content (supports Markdown)..."
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Text excerpt */}
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

                      {/* Hero image */}
                      {(() => {
                        const hero = firstImageUrl(lesson.content);
                        if (!hero) return null;
                        return (
                          <div className="my-3">
                            <img
                              src={hero}
                              alt={`${lesson.title} illustration`}
                              className="w-full h-auto rounded-md border border-border/50"
                              loading="lazy"
                            />
                          </div>
                        );
                      })()}

                      {/* Video block — directly under the image */}
                      <div className="mt-2">
                        {completedByLesson[lesson.id]?.video_url ? (
                          <div className="flex items-center gap-3">
                            <Badge variant="default">Video ready</Badge>

                            {/* If you don't have InlineVideoPlayer, replace with a plain <video> block */}
                            <InlineVideoPlayer
                              url={completedByLesson[lesson.id].video_url}
                              title={lesson.title}
                            />
                          </div>
                        ) : jobs.length > 0 ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">Rendering…</Badge>
                            <code className="px-1.5 py-0.5 rounded bg-muted">
                              {displayVideoId(jobs[0]?.video_id)}
                            </code>
                          </div>
                        ) : (
                          <em className="text-sm">No completed video yet</em>
                        )}
                      </div>
                    </>
                  )}
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
};

export default CourseManagement;
