-- Add DELETE policy for courses table
CREATE POLICY "Allow public delete of courses" 
ON public.courses 
FOR DELETE 
USING (true);