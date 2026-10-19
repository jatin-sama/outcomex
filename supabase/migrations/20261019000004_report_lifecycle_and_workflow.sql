-- ==============================================================================
-- OutcomeX — Migration 04: Report Lifecycle, Workflow States & Reopen Audit
-- Description: Extends report_runs with full academic lifecycle (DRAFT -> LOCKED)
-- ==============================================================================

-- 1. Add workflow lifecycle columns to public.report_runs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'workflow_status'
    ) THEN
        ALTER TABLE public.report_runs 
        ADD COLUMN workflow_status VARCHAR(50) NOT NULL DEFAULT 'CALCULATED'
            CHECK (workflow_status IN ('DRAFT', 'CALCULATED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'LOCKED'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'submitted_by'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN submitted_by UUID REFERENCES public.profiles(id);
        ALTER TABLE public.report_runs ADD COLUMN submitted_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id);
        ALTER TABLE public.report_runs ADD COLUMN reviewed_at TIMESTAMPTZ;
        ALTER TABLE public.report_runs ADD COLUMN reviewer_comments TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'locked_at'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN locked_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'report_runs' AND column_name = 'reopened_at'
    ) THEN
        ALTER TABLE public.report_runs ADD COLUMN reopened_at TIMESTAMPTZ;
        ALTER TABLE public.report_runs ADD COLUMN reopen_reason TEXT;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_report_runs_workflow ON public.report_runs(workflow_status);
