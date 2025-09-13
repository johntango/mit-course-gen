import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface CourseGenerationStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message?: string;
}

export const CourseGenerator = () => {
  const [formData, setFormData] = useState({
    username: '',
    userKnowledgeLevel: '',
    courseTitle: '',
    courseLengthHours: ''
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<CourseGenerationStep[]>([
    { name: 'Creating Course Specification', status: 'pending' },
    { name: 'Generating Course Content', status: 'pending' },
    { name: 'Building Course Structure', status: 'pending' }
  ]);
  const [generatedCourse, setGeneratedCourse] = useState<any>(null);
  const { toast } = useToast();

  const updateStep = (stepIndex: number, status: CourseGenerationStep['status'], message?: string) => {
    setSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status, message } : step
    ));
  };

  const handleGenerate = async () => {
    if (!formData.username || !formData.userKnowledgeLevel || !formData.courseTitle || !formData.courseLengthHours) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to generate your course.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setGeneratedCourse(null);
    
    // Reset steps
    setSteps([
      { name: 'Creating Course Specification', status: 'pending' },
      { name: 'Generating Course Content', status: 'pending' },
      { name: 'Building Course Structure', status: 'pending' }
    ]);

    try {
      // Step 1: Call OrchestrationAgent
      updateStep(0, 'running');
      setProgress(20);

      const { data: orchestrationResult, error: orchestrationError } = await supabase.functions.invoke('orchestration-agent', {
        body: {
          username: formData.username,
          user_knowledge_level: formData.userKnowledgeLevel,
          course_title: formData.courseTitle,
          course_length_hours: parseInt(formData.courseLengthHours)
        }
      });

      if (orchestrationError) {
        throw new Error(`Orchestration failed: ${orchestrationError.message}`);
      }

      if (!orchestrationResult.success) {
        throw new Error(orchestrationResult.error || 'Orchestration failed');
      }

      updateStep(0, 'completed', 'Course specification created successfully');
      setProgress(40);

      // Step 2: Call CourseWriterAgent
      updateStep(1, 'running');
      setProgress(60);

      const { data: writerResult, error: writerError } = await supabase.functions.invoke('course-writer-agent', {
        body: {
          courseId: orchestrationResult.courseId,
          courseSpec: orchestrationResult.courseSpec
        }
      });

      if (writerError) {
        throw new Error(`Content generation failed: ${writerError.message}`);
      }

      if (!writerResult.success) {
        throw new Error(writerResult.error || 'Content generation failed');
      }

      updateStep(1, 'completed', 'Course content generated successfully');
      setProgress(80);

      // Step 3: Finalize
      updateStep(2, 'running');
      setProgress(90);

      // Fetch the completed course data
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select(`
          *,
          modules (
            *,
            lessons (*)
          )
        `)
        .eq('id', orchestrationResult.courseId)
        .single();

      if (courseError) {
        throw new Error(`Failed to fetch course data: ${courseError.message}`);
      }

      updateStep(2, 'completed', 'Course structure built successfully');
      setProgress(100);
      setGeneratedCourse(courseData);

      toast({
        title: "Course Generated Successfully!",
        description: `Your course "${courseData.title}" has been created with ${courseData.modules.length} modules.`,
      });

    } catch (error: any) {
      console.error('Course generation error:', error);
      const currentStep = steps.findIndex(step => step.status === 'running');
      if (currentStep !== -1) {
        updateStep(currentStep, 'error', error.message);
      }
      
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      userKnowledgeLevel: '',
      courseTitle: '',
      courseLengthHours: ''
    });
    setProgress(0);
    setGeneratedCourse(null);
    setSteps([
      { name: 'Creating Course Specification', status: 'pending' },
      { name: 'Generating Course Content', status: 'pending' },
      { name: 'Building Course Structure', status: 'pending' }
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
            AI Course Generator
          </CardTitle>
          <CardDescription>
            Fill in the details below and let AI create a comprehensive course for you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="username">Your Name</Label>
              <Input
                id="username"
                placeholder="Enter your name"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                disabled={isGenerating}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="knowledge-level">Target Knowledge Level</Label>
              <Select 
                value={formData.userKnowledgeLevel} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, userKnowledgeLevel: value }))}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-title">Course Title</Label>
            <Input
              id="course-title"
              placeholder="What do you want to teach?"
              value={formData.courseTitle}
              onChange={(e) => setFormData(prev => ({ ...prev, courseTitle: e.target.value }))}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-length">Course Length (Hours)</Label>
            <Input
              id="course-length"
              type="number"
              min="1"
              max="100"
              placeholder="Enter hours (e.g., 8)"
              value={formData.courseLengthHours}
              onChange={(e) => setFormData(prev => ({ ...prev, courseLengthHours: e.target.value }))}
              disabled={isGenerating}
            />
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Course...
                </>
              ) : (
                'Generate Course'
              )}
            </Button>
            
            {!isGenerating && (progress > 0 || generatedCourse) && (
              <Button variant="outline" onClick={resetForm}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Section */}
      {(isGenerating || progress > 0) && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Generation Progress</CardTitle>
            <Progress value={progress} className="w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                {step.status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                {step.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {step.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
                {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-muted" />}
                
                <div className="flex-1">
                  <div className="font-medium">{step.name}</div>
                  {step.message && (
                    <div className={`text-sm ${step.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {step.message}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Generated Course Display */}
      {generatedCourse && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-xl text-primary">Generated Course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">{generatedCourse.title}</h3>
              <p className="text-muted-foreground mb-4">{generatedCourse.description}</p>
              
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Duration: {generatedCourse.length_hours} hours</span>
                <span>Level: {generatedCourse.target_knowledge_level}</span>
                <span>Modules: {generatedCourse.modules.length}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-semibold">Course Modules</h4>
              {generatedCourse.modules.map((module: any, index: number) => (
                <Card key={module.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      Module {index + 1}: {module.title}
                    </CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {module.lessons.length} lessons
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};