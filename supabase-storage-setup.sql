-- Create storage bucket for videos (if not exists)
-- Note: buckets are typically created via the Supabase UI, but you can also use the storage API
-- For now, ensure the bucket exists in the Supabase dashboard: https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets

-- Grant permissions to authenticated users to upload videos to their org bucket
GRANT ALL ON storage.objects TO authenticated;

-- Create RLS policy for authenticated users to upload videos
CREATE POLICY "Users can upload videos to their org bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'videos'
        AND (
            auth.jwt() ->> 'sub'::text IN (
                SELECT owner_id::text
                FROM organisations
                WHERE id::text = (storage.foldername(name))[1]
            )
        )
    );

-- Create RLS policy for authenticated users to read their org videos
CREATE POLICY "Users can read videos from their org bucket"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'videos'
        AND (
            auth.jwt() ->> 'sub'::text IN (
                SELECT owner_id::text
                FROM organisations
                WHERE id::text = (storage.foldername(name))[1]
            )
        )
    );

-- Create RLS policy for anonymous users to read videos (for TV playback)
CREATE POLICY "Anonymous users can read videos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'videos');

-- Create RLS policy for authenticated users to delete their org videos
CREATE POLICY "Users can delete their org videos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'videos'
        AND (
            auth.jwt() ->> 'sub'::text IN (
                SELECT owner_id::text
                FROM organisations
                WHERE id::text = (storage.foldername(name))[1]
            )
        )
    );
