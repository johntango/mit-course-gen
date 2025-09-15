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
import { ArrowLeft, Edit3, Trash2, Save, Upload, X } from "lucide-react";
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

const CourseManagement = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [lessonContent, setLessonContent] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

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
      return data;
    },
    enabled: !!courseId,
  });

  // Delete course mutation
  const deleteCourse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Course deleted",
        description: "Course has been successfully deleted.",
      });
      navigate("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete course.",
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
          {modules?.map((module, moduleIndex) => (
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
                {module.lessons?.map((lesson, lessonIndex) => (
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