import { CourseCard } from "./CourseCard";

const sampleCourses = [
  {
    title: "Introduction to Web Development",
    description: "Learn the fundamentals of HTML, CSS, and JavaScript to build modern websites from scratch.",
    duration: "8 weeks",
    students: 2547,
    rating: 4.8,
    level: "Beginner"
  },
  {
    title: "Advanced React Patterns",
    description: "Master advanced React concepts including hooks, context, and performance optimization techniques.",
    duration: "6 weeks", 
    students: 1823,
    rating: 4.9,
    level: "Advanced"
  },
  {
    title: "Digital Marketing Fundamentals",
    description: "Comprehensive guide to digital marketing strategies, SEO, social media, and analytics.",
    duration: "10 weeks",
    students: 3214,
    rating: 4.7,
    level: "Intermediate"
  },
  {
    title: "Data Science with Python",
    description: "Explore data analysis, visualization, and machine learning using Python and popular libraries.",
    duration: "12 weeks",
    students: 1956,
    rating: 4.9,
    level: "Intermediate"
  },
  {
    title: "UI/UX Design Principles",
    description: "Learn design thinking, user research, prototyping, and creating beautiful user interfaces.",
    duration: "9 weeks",
    students: 2891,
    rating: 4.8,
    level: "Beginner"
  },
  {
    title: "Mobile App Development",
    description: "Build native mobile applications for iOS and Android using modern development frameworks.",
    duration: "14 weeks",
    students: 1634,
    rating: 4.6,
    level: "Advanced"
  }
];

export const CourseCatalog = () => {
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sampleCourses.map((course, index) => (
            <CourseCard key={index} {...course} />
          ))}
        </div>
      </div>
    </section>
  );
};