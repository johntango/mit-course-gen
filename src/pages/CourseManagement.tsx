import { useState } from "react";
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
import { ArrowLeft, Edit3, Trash2, Save, Upload, X, Image, FileText, Clapperboard, Loader2, Copy, Trash } from "lucide-react";
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

const DEFAULT_MINUTES = "3"; // sensible default

const CourseManagement = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [lessonContent, setLessonContent] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Per-lesson target lengths (minutes as string to preserve decimals like "1.5")
  const [lengthMinutesByLesson, setLengthMinutesByLesson] = useState<Record<string, string>>({});
  // Local drafts of generated scripts (for preview/copy)
  const [scriptDrafts, setScriptDrafts] = useState<Record<string, string>>({});

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
      
      // Sort lessons by position within each module
      return data?.map((module: any) => ({
        ...module,
        lessons: module.lessons?.sort((a: any, b: any) => a.position - b.position) || []
      })) || [];
    },
    enabled: !!courseId,
  });

  // Delete course mutation
  const deleteCourse = useMutation({
    mutationFn: async () => {
      // Delete related records in correct order
      // 1. Delete lessons first (they reference modules)
      const { data: modulesData } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", courseId);
      
      if (modulesData && modulesData.length > 0) {
        const moduleIds = modulesData.map((m: any) => m.id);
        await supabase
          .from("lessons")
          .delete()
          .in("module_id", moduleIds);
      }
      
      // 2. Delete modules (they reference courses)
      await supabase
        .from("modules")
        .delete()
        .eq("course_id", courseId);
      
      // 3. Delete course specs (they reference courses)
      await supabase
        .from("course_specs")
        .delete()
        .eq("course_id", courseId);
      
      // 4. Set agent_runs course_id to null (nullable reference)
      await supabase
        .from("agent_runs")
        .update({ course_id: null })
        .eq("course_id", courseId);
      
      // 5. Finally delete the course
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);
      
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
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete course. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update lesson mutation
  const updateLesson = useMutation({
    mutationFn: async ({ lessonId, title, content }: { lessonId: string; title: string; content: string }) => {
      const { error } = await supabase
        .from("lessons")
        .update({ title, content })
        .eq("id", lessonId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Lesson updated",
        description: "Lesson has been successfully updated.",
      });
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

  // Populate images mutation (existing)
  const populateImages = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('populate-course-images', {
        body: { courseId }
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
      console.error('Populate images error:', error);
      toast({
        title: "Error",
        description: "Failed to populate images. Please try again.",
        variant: "destructive",
      });
    },
  });

  // --- NEW: Generate Script (per lesson)
  const generateLessonScript = useMutation({
    mutationFn: async ({ lessonId, minutes }: { lessonId: string; minutes: number }) => {
      // Expected Edge Function contract:
      //   name: generate-lesson-script
      //   body: { lessonId, targetDurationMinutes }
      //   returns: { script: string, videoRowId?: string }
      const { data, error } = await supabase.functions.invoke('generate-lesson-script', {
        body: { lessonId, targetDurationMinutes: minutes }
      });
      if (error) throw error;
      return data as { script: string; videoRowId?: string };
    },
    onSuccess: (data, vars) => {
      setScriptDrafts(prev => ({ ...prev, [vars.lessonId]: data.script }));
      toast({
        title: "Script generated",
        description: "A draft narration script has been generated.",
      });
    },
    onError: (err: any) => {
      console.error("generate-lesson-script error:", err);
      toast({
        title: "Error",
        description: "Failed to generate script. Please try again.",
        variant: "destructive",
      });
    }
  });

  // --- NEW: Generate & Insert Video (per lesson)
  const generateLessonVideo = useMutation({
    mutationFn: async ({ lessonId, minutes, forceRegenerate = false }: { lessonId: string; minutes: number; forceRegenerate?: boolean }) => {
      // Expected Edge Function contract:
      //   name: generate-lesson-video
      //   body: { lessonId, targetDurationMinutes, forceRegenerate? }
      //   returns: { success: boolean, videoUrl?: string }
      const { data, error } = await supabase.functions.invoke('generate-lesson-video', {
        body: { lessonId, targetDurationMinutes: minutes, forceRegenerate }
      });
      if (error) throw error;
      return data as { success: boolean; videoUrl?: string };
    },
    onSuccess: (data) => {
      if (data?.success) {
        toast({
          title: "Video generated",
          description: "The video was generated and the link was inserted into the lesson.",
        });
        // Re-fetch to show updated content snippet
        queryClient.invalidateQueries({ queryKey: ["modules", courseId] });
      } else {
        toast({
          title: "Video generation incomplete",
          description: "The request did not complete successfully.",
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      console.error("generate-lesson-video error:", err);
      toast({
        title: "Error",
        description: "Failed to generate video. Please try again.",
        variant: "destructive",
      });
    }
  });

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `lessons/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('course-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('course-images')
        .getPublicUrl(filePath);

      // Insert image markdown at the beginning of lesson content
      const imageMarkdown = `![Image](${publicUrl})\n\n`;
      setLessonContent(prev => imageMarkdown + prev);

      toast({
        title: "Image uploaded",
        description: "Image has been uploaded and added to lesson content.",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Helpers for minutes input
  const getMinutesForLesson = (lessonId: string) => {
    return lengthMinutesByLesson[lessonId] ?? DEFAULT_MINUTES;
  };
  const setMinutesForLesson = (lessonId: string, value: string) => {
    // Keep only digits and a single dot; allow empty string to let user clear
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    const normalized =
      parts.length <= 2
        ? (parts.length === 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : parts[0])
        : cleaned; // don’t over-aggressively sanitize
    setLengthMinutesByLesson(prev => ({ ...prev, [lessonId]: normalized }));
  };

  // UI helpers
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Script copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

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
          <Button 
            onClick={() => navigate(`/course/${courseId}`)} 
            variant="ghost"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>
          
          <div className="flex gap-2">
            {course.status === 'completed' && (
              <Button
                onClick={() => populateImages.mutate()}
                disabled={populateImages.isPending}
                variant="outline"
              >
                <Image className="w-4 h-4 mr-2" />
                {populateImages.isPending ? 'Populating Images...' : 'Populate Images'}
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
                    This action cannot be undone. This will permanently delete the course
                    and all its modules and lessons.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteCourse.mutate()}>
                    Delete Course
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Card className="bg-card border-border/50 mb-6">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">
              Manage Course: {course.title}
            </CardTitle>
            <CardDescription>
              Edit course content, modules, and lessons
            </CardDescription>
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
                  const isGenScriptPending = generateLessonScript.isPending && (generateLessonScript.variables as any)?.lessonId === lesson.id;
                  const isGenVideoPending = generateLessonVideo.isPending && (generateLessonVideo.variables as any)?.lessonId === lesson.id;

                  return (
                    <div key={lesson.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            Lesson {lessonIndex + 1}
                          </Badge>
                          <span className="font-medium">{lesson.title}</span>
                        </div>
                        {editingLesson === lesson.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveLesson}
                              disabled={updateLesson.isPending}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingLesson(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditLesson(lesson)}
                          >
                            <Edit3 className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>

                      {/* NEW: Video tools */}
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
                              onClick={() => generateLessonScript.mutate({ lessonId: lesson.id, minutes: isNaN(minutesNum) ? 3 : minutesNum })}
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
                              onClick={() => generateLessonVideo.mutate({ lessonId: lesson.id, minutes: isNaN(minutesNum) ? 3 : minutesNum })}
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
                          </div>
                        </div>

                        {/* Optional: show local script draft if available */}
                        {scriptDrafts[lesson.id] && (
                          <div className="mt-3">
                            <Label>Draft Script (preview)</Label>
                            <Textarea
                              value={scriptDrafts[lesson.id]}
                              onChange={(e) => setScriptDrafts(prev => ({ ...prev, [lesson.id]: e.target.value }))}
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
                                onClick={() => setScriptDrafts(prev => {
                                  const next = { ...prev }; delete next[lesson.id]; return next;
                                })}
                              >
                                <Trash className="w-4 h-4 mr-2" />
                                Clear Preview
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    
                      {editingLesson === lesson.id ? (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="lesson-title">Lesson Title</Label>
                            <Input
                              id="lesson-title"
                              value={lessonTitle}
                              onChange={(e) => setLessonTitle(e.target.value)}
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label htmlFor="lesson-content">Lesson Content</Label>
                              <div className="flex gap-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageUpload}
                                  className="hidden"
                                  id="image-upload"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => document.getElementById('image-upload')?.click()}
                                  disabled={uploadingImage}
                                >
                                  <Upload className="w-4 h-4 mr-1" />
                                  {uploadingImage ? 'Uploading...' : 'Add Image'}
                                </Button>
                              </div>
                            </div>
                            <Textarea
                              id="lesson-content"
                              value={lessonContent}
                              onChange={(e) => setLessonContent(e.target.value)}
                              rows={10}
                              placeholder="Enter lesson content (supports Markdown)..."
                            />
                          </div>
                        </div>
                      ) : (
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
