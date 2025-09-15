-- Create storage bucket for course images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('course-images', 'course-images', true);

-- Create policies for course images bucket
CREATE POLICY "Course images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'course-images');

CREATE POLICY "Anyone can upload course images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'course-images');

CREATE POLICY "Anyone can update course images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'course-images');

CREATE POLICY "Anyone can delete course images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'course-images');