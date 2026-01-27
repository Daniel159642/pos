-- Schedule generator tables for PostgreSQL
-- Required for /api/schedule/generate, Calendar schedule builder
-- Python uses Schedule_Periods, Scheduled_Shifts, Employee_Positions (Postgres lowercases to snake_case)

-- 1. Schedule Periods (draft/published schedule windows)
CREATE TABLE IF NOT EXISTS schedule_periods (
    period_id SERIAL PRIMARY KEY,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by INTEGER REFERENCES employees(employee_id),
    created_at TIMESTAMP DEFAULT NOW(),
    published_by INTEGER REFERENCES employees(employee_id),
    published_at TIMESTAMP,
    template_id INTEGER,
    generation_method TEXT DEFAULT 'manual' CHECK (generation_method IN ('manual', 'auto', 'template')),
    generation_settings TEXT,
    total_labor_hours NUMERIC(10,2),
    estimated_labor_cost NUMERIC(10,2),
    UNIQUE(week_start_date)
);

-- 2. Scheduled Shifts (shifts within a period)
CREATE TABLE IF NOT EXISTS scheduled_shifts (
    scheduled_shift_id SERIAL PRIMARY KEY,
    period_id INTEGER NOT NULL REFERENCES schedule_periods(period_id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INTEGER DEFAULT 30,
    position TEXT,
    notes TEXT,
    is_draft INTEGER DEFAULT 1 CHECK (is_draft IN (0, 1)),
    conflicts TEXT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_period_date ON scheduled_shifts(period_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_employee_date ON scheduled_shifts(employee_id, shift_date);

-- 3. Employee Positions (optional; used for hourly_rate in cost estimation, LEFT JOIN in generator)
CREATE TABLE IF NOT EXISTS employee_positions (
    employee_position_id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    position_name TEXT NOT NULL,
    hourly_rate NUMERIC(10,2),
    UNIQUE(employee_id, position_name)
);

CREATE INDEX IF NOT EXISTS idx_employee_positions_employee ON employee_positions(employee_id);
