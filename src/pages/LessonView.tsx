import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

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
            <CardContent>
              <div className="markdown-content text-foreground leading-relaxed space-y-4">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({children}) => <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">{children}</h1>,
                    h2: ({children}) => <h2 className="text-xl font-semibold text-foreground mb-3 mt-5 first:mt-0">{children}</h2>,
                    h3: ({children}) => <h3 className="text-lg font-medium text-foreground mb-2 mt-4 first:mt-0">{children}</h3>,
                    p: ({children}) => <p className="text-foreground mb-3 leading-relaxed">{children}</p>,
                    ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1 text-foreground">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground">{children}</ol>,
                    li: ({children}) => <li className="text-foreground">{children}</li>,
                    blockquote: ({children}) => <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-4">{children}</blockquote>,
                    code: ({children}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>,
                    pre: ({children}) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                    strong: ({children}) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({children}) => <em className="italic text-foreground">{children}</em>,
                    img: ({src, alt}) => (
                      <img 
                        src={src} 
                        alt={alt || "Lesson image"} 
                        className="w-full max-w-2xl mx-auto rounded-lg shadow-lg my-6 first:mt-0" 
                      />
                    ),
                  }}
                >
                  {lesson.content || 'No content available for this lesson.'}
                </ReactMarkdown>
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