-- Reset stuck syncing status for the course
UPDATE courses 
SET s3_sync_status = 'not_synced', 
    s3_error_message = 'Reset after failed publish - filesystem error resolved' 
WHERE s3_sync_status = 'syncing';