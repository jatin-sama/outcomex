-- ==============================================================================
-- OutcomeX — Migration 09: Ensure report_runs Workflow Lifecycle Schema & PostgREST Reload
-- Description:
-- 1. Idempotently adds workflow_status and academic governance lifecycle columns to public.report_runs.
-- 2. Sets safe defaults and backfills existing report records without resetting existing states.
-- 3. Makes generated_by nullable if needed and adds updated_at.
-- 4. Creates public.reload_schema_cache() function and triggers PostgREST schema reload.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Ensure workflow_status column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'workflow_status'
    ) THEN
        ALTER TABLE public.report_runs 
        ADD COLUMN workflow_status VARCHAR(50) NOT NULL DEFAULT 'CALCULATED';
    END IF;

    -- 2. Drop any outdated check constraint and re-add canonical constraint
    ALTER TABLE public.report_runs DROP CONSTRAINT IF EXISTS chk_report_runs_workflow_status;
    ALTER TABLE public.report_runs DROP CONSTRAINT IF EXISTS report_runs_workflow_status_check;
    ALTER TABLE public.report_runs 
        ADD CONSTRAINT chk_report_runs_workflow_status 
        CHECK (workflow_status IN ('DRAFT', 'CALCULATED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'LOCKED'));

    -- 3. Ensure submitted_by and submitted_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'submitted_by'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN submitted_by UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'submitted_at'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN submitted_at TIMESTAMPTZ;
    END IF;

    -- 4. Ensure reviewed_by, reviewed_at, reviewer_comments
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN reviewed_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'reviewer_comments'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN reviewer_comments TEXT;
    END IF;

    -- 5. Ensure locked_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'locked_at'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN locked_at TIMESTAMPTZ;
    END IF;

    -- 6. Ensure reopened_at, reopen_reason
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'reopened_at'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN reopened_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'reopen_reason'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN reopen_reason TEXT;
    END IF;

    -- 7. Ensure updated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    -- 8. Make generated_by nullable if strict profile reference is optional
    ALTER TABLE public.report_runs ALTER COLUMN generated_by DROP NOT NULL;

    -- 9. Backfill existing records where workflow_status is null
    UPDATE public.report_runs
    SET workflow_status = 'CALCULATED'
    WHERE workflow_status IS NULL;

END $$;

-- 10. Performance indexes
CREATE INDEX IF NOT EXISTS idx_report_runs_workflow ON public.report_runs(workflow_status);
CREATE INDEX IF NOT EXISTS idx_report_runs_offering_workflow ON public.report_runs(course_offering_id, workflow_status);

-- 11. RPC for PostgREST schema cache reload
CREATE OR REPLACE FUNCTION public.reload_schema_cache()
RETURNS void AS $$
BEGIN
    NOTIFY pgrst, 'reload schema';
    NOTIFY pgrst, 'reload config';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger PostgREST schema reload immediately
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
