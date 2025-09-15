-- Create storage bucket for course images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('course-images', 'course-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

-- Create RLS policies for course images
CREATE POLICY "Anyone can view course images"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-images');

CREATE POLICY "Anyone can upload course images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'course-images');

CREATE POLICY "Anyone can update course images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'course-images');

CREATE POLICY "Anyone can delete course images"
ON storage.objects FOR DELETE
USING (bucket_id = 'course-images');