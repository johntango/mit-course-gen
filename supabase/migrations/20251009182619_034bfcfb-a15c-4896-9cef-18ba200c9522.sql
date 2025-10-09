-- Add S3 publication tracking to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS s3_published_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS s3_sync_status text DEFAULT 'not_synced' CHECK (s3_sync_status IN ('not_synced', 'syncing', 'synced', 'error')),
ADD COLUMN IF NOT EXISTS s3_manifest_url text,
ADD COLUMN IF NOT EXISTS s3_error_message text;

-- Add index for querying courses that need syncing
CREATE INDEX IF NOT EXISTS idx_courses_s3_sync_status ON public.courses(s3_sync_status);

COMMENT ON COLUMN public.courses.s3_published_at IS 'Timestamp when course was last published to S3';
COMMENT ON COLUMN public.courses.s3_sync_status IS 'Status of S3 synchronization: not_synced, syncing, synced, error';
COMMENT ON COLUMN public.courses.s3_manifest_url IS 'URL to the course manifest JSON in S3';
COMMENT ON COLUMN public.courses.s3_error_message IS 'Error message if S3 sync failed';