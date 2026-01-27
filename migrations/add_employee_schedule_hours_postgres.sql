-- Add schedule-related columns to employees (used by schedule generator)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS max_hours_per_week INTEGER DEFAULT 40;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS min_hours_per_week INTEGER DEFAULT 0;
