-- ==============================================================================
-- OutcomeX — Migration 08: Ensure Reports Storage Bucket & Security Policies
-- Description:
-- Idempotently creates the private 'reports' storage bucket for durable
-- Excel report retention and configures RLS access policies.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Create 'reports' bucket in storage.buckets if storage schema exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'reports',
            'reports',
            false,
            15728640, -- 15MB limit
            ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/octet-stream']
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            allowed_mime_types = EXCLUDED.allowed_mime_types;
    END IF;
END $$;

-- 2. Storage Object RLS Policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Allow authenticated users to view/download reports
        DROP POLICY IF EXISTS "reports_bucket_read" ON storage.objects;
        CREATE POLICY "reports_bucket_read" ON storage.objects
            FOR SELECT TO authenticated
            USING (bucket_id = 'reports');

        -- Allow authenticated users to upload report files
        DROP POLICY IF EXISTS "reports_bucket_insert" ON storage.objects;
        CREATE POLICY "reports_bucket_insert" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'reports');
    END IF;
END $$;
