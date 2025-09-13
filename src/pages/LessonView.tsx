import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";

const LessonView = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();

  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select(`
          *,
          modules (*, courses (*))
        `)
        .eq("id", lessonId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  const { data: allLessons, isLoading: allLessonsLoading } = useQuery({
    queryKey: ["course-lessons", courseId],
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
      return data.flatMap(module => 
        module.lessons?.map(lesson => ({
          ...lesson,
          moduleTitle: module.title
        })) || []
      ).sort((a, b) => a.position - b.position);
    },
    enabled: !!courseId,
  });

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

  const currentLessonIndex = allLessons?.findIndex(l => l.id === lessonId) ?? -1;
  const previousLesson = currentLessonIndex > 0 ? allLessons?.[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < (allLessons?.length ?? 0) - 1 ? allLessons?.[currentLessonIndex + 1] : null;

  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="container mx-auto py-12">
        <div className="flex items-center justify-between mb-8">
          <Button 
            onClick={() => navigate(`/course/${courseId}`)} 
            variant="ghost"
          >
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
              <p className="text-muted-foreground">
                Module: {lesson.modules?.title}
              </p>
            </CardHeader>
            <CardContent className="prose prose-lg max-w-none">
              <div 
                className="text-foreground leading-relaxed"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {lesson.content || 'No content available for this lesson.'}
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
                <Button
                  onClick={() => navigate(`/course/${courseId}/lesson/${nextLesson.id}`)}
                >
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