-- Enable RLS on lesson_videos table
ALTER TABLE public.lesson_videos ENABLE ROW LEVEL SECURITY;

-- Allow public read access to completed videos
CREATE POLICY "Allow public read access to lesson_videos"
ON public.lesson_videos
FOR SELECT
USING (true);

-- Allow public insert for video creation
CREATE POLICY "Allow public insert for lesson_videos"
ON public.lesson_videos
FOR INSERT
WITH CHECK (true);

-- Allow public update for video status
CREATE POLICY "Allow public update for lesson_videos"
ON public.lesson_videos
FOR UPDATE
USING (true);

-- Enable RLS on lesson_attachments table
ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;

-- Allow public read access to attachments
CREATE POLICY "Allow public read access to lesson_attachments"
ON public.lesson_attachments
FOR SELECT
USING (true);

-- Allow public insert for attachments
CREATE POLICY "Allow public insert for lesson_attachments"
ON public.lesson_attachments
FOR INSERT
WITH CHECK (true);

-- Allow public update for attachments
CREATE POLICY "Allow public update for lesson_attachments"
ON public.lesson_attachments
FOR UPDATE
USING (true);

-- Enable RLS on dummy_heygen_jobs table (internal use only)
ALTER TABLE public.dummy_heygen_jobs ENABLE ROW LEVEL SECURITY;

-- Allow public access for testing/development
CREATE POLICY "Allow public access to dummy_heygen_jobs"
ON public.dummy_heygen_jobs
FOR ALL
USING (true);