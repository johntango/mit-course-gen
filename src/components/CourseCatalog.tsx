import { CourseCard } from "./CourseCard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  length_hours: number;
  target_knowledge_level: string;
  created_at: string;
}

export const CourseCatalog = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching courses:', error);
        return;
      }

      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section id="course-catalog" className="py-20 px-6 bg-background">
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading courses...</p>
        </div>
      </section>
    );
  }

  return (
    <section id="course-catalog" className="py-20 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Featured Courses
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore our most popular courses created by educators around the world.
          </p>
        </div>
        
        {courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg mb-4">No courses available yet.</p>
            <p className="text-sm text-muted-foreground">
              Be the first to create a course using our AI generator!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map((course) => (
              <CourseCard 
                key={course.id} 
                id={course.id}
                title={course.title}
                description={course.description || "No description available"}
                duration={`${course.length_hours} hours`}
                students={0} // We could add a students count later
                rating={5.0} // Default rating for now
                level={course.target_knowledge_level}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};