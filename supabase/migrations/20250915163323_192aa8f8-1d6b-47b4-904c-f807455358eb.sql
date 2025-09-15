-- Add DELETE policy for courses table
CREATE POLICY "Allow public delete of courses" 
ON public.courses 
FOR DELETE 
USING (true);

-- Add foreign key constraints with CASCADE DELETE to handle related records
-- First, add foreign key constraint for modules referencing courses
ALTER TABLE public.modules 
ADD CONSTRAINT modules_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) 
ON DELETE CASCADE;

-- Add foreign key constraint for lessons referencing modules  
ALTER TABLE public.lessons 
ADD CONSTRAINT lessons_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES public.modules(id) 
ON DELETE CASCADE;

-- Add foreign key constraint for course_specs referencing courses
ALTER TABLE public.course_specs 
ADD CONSTRAINT course_specs_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) 
ON DELETE CASCADE;

-- Add foreign key constraint for agent_runs referencing courses (nullable)
ALTER TABLE public.agent_runs 
ADD CONSTRAINT agent_runs_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) 
ON DELETE SET NULL;