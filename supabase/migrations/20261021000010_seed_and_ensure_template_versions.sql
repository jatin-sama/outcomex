-- OutcomeX — Migration 10: Seed and Ensure Approved Template Versions
-- Ensures public.template_versions contains active, approved 60/40 and 30/20 templates
-- Idempotent, non-destructive, and preserves existing foreign key relationships.

-- 1. Ensure template_versions table exists with proper unique constraint
CREATE TABLE IF NOT EXISTS public.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    file_sha256 VARCHAR(64) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    sheet_name VARCHAR(100) NOT NULL,
    adapter_identifier VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_template_version UNIQUE (template_name, version)
);

-- 2. Enable RLS on template_versions
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

-- 3. Ensure SELECT policy allows both authenticated and anonymous reading of active templates
DROP POLICY IF EXISTS "template_versions_select" ON public.template_versions;
DROP POLICY IF EXISTS "template_versions_read_all" ON public.template_versions;
CREATE POLICY "template_versions_read_all" ON public.template_versions
    FOR SELECT
    USING (is_active = true);

-- 4. Idempotently insert or update the canonical 60/40 approved template version
INSERT INTO public.template_versions (
    id,
    template_name,
    version,
    file_sha256,
    storage_path,
    sheet_name,
    adapter_identifier,
    is_active,
    created_at,
    updated_at
) VALUES (
    '70000000-0000-0000-0000-000000000001',
    '60_40_v1',
    'v1.0',
    '497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477',
    'templates/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx',
    'For 60_40 (final)',
    'Adapter60_40',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (template_name, version) DO UPDATE SET
    is_active = true,
    sheet_name = EXCLUDED.sheet_name,
    adapter_identifier = EXCLUDED.adapter_identifier,
    file_sha256 = EXCLUDED.file_sha256,
    storage_path = EXCLUDED.storage_path,
    updated_at = NOW();

-- 5. Idempotently insert or update the canonical 30/20 approved template version
INSERT INTO public.template_versions (
    id,
    template_name,
    version,
    file_sha256,
    storage_path,
    sheet_name,
    adapter_identifier,
    is_active,
    created_at,
    updated_at
) VALUES (
    '70000000-0000-0000-0000-000000000002',
    '30_20_v1',
    'v1.0',
    '497f4d82b76337c5826027f606e635489777ee9f8b95c26e878e84c45a6ad477',
    'templates/Autonomous_Attainment_IDS_3rd _25_26 (2).xlsx',
    'For 30_20 (Final)',
    'Adapter30_20',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (template_name, version) DO UPDATE SET
    is_active = true,
    sheet_name = EXCLUDED.sheet_name,
    adapter_identifier = EXCLUDED.adapter_identifier,
    file_sha256 = EXCLUDED.file_sha256,
    storage_path = EXCLUDED.storage_path,
    updated_at = NOW();

-- 6. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
