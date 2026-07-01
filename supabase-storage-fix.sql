-- Fix ambiguous column reference: the subquery's "FROM organisations" shadowed
-- the intended storage.objects.name, so foldername() was reading the org's
-- business name instead of the uploaded file's path. Every upload/read/delete
-- silently failed RLS as a result.

DROP POLICY IF EXISTS "Users can upload videos to their org bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can read videos from their org bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their org videos" ON storage.objects;

CREATE POLICY "Users can upload videos to their org bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'videos'
        AND auth.jwt() ->> 'sub' IN (
            SELECT owner_id::text FROM organisations
            WHERE id::text = (storage.foldername(objects.name))[1]
        )
    );

CREATE POLICY "Users can read videos from their org bucket"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'videos'
        AND auth.jwt() ->> 'sub' IN (
            SELECT owner_id::text FROM organisations
            WHERE id::text = (storage.foldername(objects.name))[1]
        )
    );

CREATE POLICY "Users can delete their org videos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'videos'
        AND auth.jwt() ->> 'sub' IN (
            SELECT owner_id::text FROM organisations
            WHERE id::text = (storage.foldername(objects.name))[1]
        )
    );
