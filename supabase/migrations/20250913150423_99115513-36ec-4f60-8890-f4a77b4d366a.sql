-- Drop existing tables in correct order (handle foreign key constraints)
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS modules CASCADE;  
DROP TABLE IF EXISTS course_specs CASCADE;
DROP TABLE IF EXISTS agent_runs CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  length_hours INTEGER NOT NULL CHECK (length_hours > 0),
  target_knowledge_level TEXT NOT NULL CHECK (target_knowledge_level IN ('beginner', 'intermediate', 'advanced')),
  created_by TEXT NOT NULL, -- username from form
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'published', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create course_specs table (normalized schema from OrchestrationAgent)
CREATE TABLE public.course_specs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  spec_data JSONB NOT NULL, -- The normalized CourseSpec schema
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create modules table  
CREATE TABLE public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lessons table
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT, -- Lesson content (markdown/html)
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent_runs table (for tracking agent execution)
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('orchestration', 'course_writer')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  input_data JSONB, -- Input parameters/spec
  output_data JSONB, -- Generated results
  messages JSONB, -- Agent messages/logs
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a demo app)
CREATE POLICY "Allow public read access to courses" 
ON public.courses 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert for course creation"
ON public.courses
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update for course status"
ON public.courses  
FOR UPDATE
USING (true);

-- Course specs policies
CREATE POLICY "Allow public access to course specs"
ON public.course_specs
FOR ALL
USING (true);

-- Modules policies  
CREATE POLICY "Allow public access to modules"
ON public.modules
FOR ALL
USING (true);

-- Lessons policies
CREATE POLICY "Allow public access to lessons" 
ON public.lessons
FOR ALL
USING (true);

-- Agent runs policies
CREATE POLICY "Allow public access to agent runs"
ON public.agent_runs  
FOR ALL
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();