import { CourseGenerator } from "@/components/CourseGenerator";

const CourseGeneration = () => {
  return (
    <div className="min-h-screen bg-gradient-secondary">
      <div className="container mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Create Your Course with
            <span className="block bg-gradient-primary bg-clip-text text-transparent">
              AI Assistance
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform your expertise into comprehensive courses in minutes. 
            Our AI will help you structure content, create engaging lessons, and build a complete curriculum.
          </p>
        </div>
        
        <CourseGenerator />
      </div>
    </div>
  );
};

export default CourseGeneration;