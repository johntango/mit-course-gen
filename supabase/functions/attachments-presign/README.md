# Attachments Presign Edge Function

Purpose: return presigned upload info for lesson attachments.

Env vars required:
- AWS_REGION
- S3_BUCKET
- SUPABASE_SERVICE_ROLE_KEY

Deploy:
- Copy into supabase/functions/attachments-presign
- Run `supabase functions deploy attachments-presign --project-ref <ref>` or use your CI.

Notes:
- Current implementation returns a direct S3 URL placeholder. To return a signed URL, update index.ts to use @aws-sdk/s3-request-presigner.
# Attachments Presign Edge Function

Purpose: return presigned upload info for lesson attachments.

Env vars required:
- AWS_REGION
- S3_BUCKET
- SUPABASE_SERVICE_ROLE_KEY

Deploy:
- Copy into supabase/functions/attachments-presign
- Run `supabase functions deploy attachments-presign --project-ref <ref>` or use your CI.

Notes:
- Current implementation returns a direct S3 URL placeholder. To return a signed URL, update index.ts to use @aws-sdk/s3-request-presigner.