--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Homebrew)
-- Dumped by pg_dump version 14.18 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approved_shipment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approved_shipment_items (
    approved_item_id integer NOT NULL,
    shipment_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity_received integer NOT NULL,
    unit_cost numeric NOT NULL,
    lot_number text,
    expiration_date date,
    received_by integer NOT NULL,
    received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT approved_shipment_items_quantity_received_check CHECK ((quantity_received > 0)),
    CONSTRAINT approved_shipment_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: approved_shipment_items_approved_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approved_shipment_items_approved_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approved_shipment_items_approved_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approved_shipment_items_approved_item_id_seq OWNED BY public.approved_shipment_items.approved_item_id;


--
-- Name: approved_shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approved_shipments (
    shipment_id integer NOT NULL,
    pending_shipment_id integer,
    vendor_id integer NOT NULL,
    purchase_order_number text,
    received_date date,
    approved_by integer NOT NULL,
    approved_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_items_received integer DEFAULT 0,
    total_cost numeric DEFAULT 0,
    has_issues integer DEFAULT 0,
    issue_count integer DEFAULT 0,
    CONSTRAINT approved_shipments_has_issues_check CHECK ((has_issues = ANY (ARRAY[0, 1])))
);


--
-- Name: approved_shipments_shipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approved_shipments_shipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approved_shipments_shipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approved_shipments_shipment_id_seq OWNED BY public.approved_shipments.shipment_id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    audit_id integer NOT NULL,
    establishment_id integer NOT NULL,
    table_name text NOT NULL,
    record_id integer NOT NULL,
    action_type text NOT NULL,
    employee_id integer NOT NULL,
    action_timestamp timestamp without time zone DEFAULT now(),
    old_values text,
    new_values text,
    ip_address text,
    notes text,
    resource_type text,
    details text,
    CONSTRAINT audit_log_action_type_check CHECK ((action_type = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'APPROVE'::text, 'VOID'::text, 'RETURN'::text, 'LOGIN'::text, 'LOGOUT'::text, 'CLOCK_IN'::text, 'CLOCK_OUT'::text])))
);


--
-- Name: audit_log_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_audit_id_seq OWNED BY public.audit_log.audit_id;


--
-- Name: cash_register_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_register_sessions (
    register_session_id integer NOT NULL,
    establishment_id integer NOT NULL,
    register_id integer DEFAULT 1,
    employee_id integer NOT NULL,
    opened_at timestamp without time zone DEFAULT now(),
    closed_at timestamp without time zone,
    starting_cash numeric(10,2) DEFAULT 0 NOT NULL,
    ending_cash numeric(10,2),
    expected_cash numeric(10,2),
    cash_sales numeric(10,2) DEFAULT 0,
    cash_refunds numeric(10,2) DEFAULT 0,
    cash_in numeric(10,2) DEFAULT 0,
    cash_out numeric(10,2) DEFAULT 0,
    discrepancy numeric(10,2) DEFAULT 0,
    status text DEFAULT 'open'::text,
    notes text,
    closed_by integer,
    reconciled_by integer,
    reconciled_at timestamp without time zone,
    CONSTRAINT cash_register_sessions_starting_cash_check CHECK ((starting_cash >= (0)::numeric)),
    CONSTRAINT cash_register_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'reconciled'::text])))
);


--
-- Name: cash_register_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_register_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_register_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_register_sessions_session_id_seq OWNED BY public.cash_register_sessions.register_session_id;


--
-- Name: cash_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_transactions (
    transaction_id integer NOT NULL,
    establishment_id integer NOT NULL,
    session_id integer NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    reason text,
    employee_id integer NOT NULL,
    transaction_date timestamp without time zone DEFAULT now(),
    notes text,
    CONSTRAINT cash_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT cash_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['cash_in'::text, 'cash_out'::text, 'deposit'::text, 'withdrawal'::text, 'adjustment'::text])))
);


--
-- Name: cash_transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_transactions_transaction_id_seq OWNED BY public.cash_transactions.transaction_id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    category_id integer NOT NULL,
    category_name text NOT NULL,
    description text,
    parent_category_id integer,
    is_auto_generated integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT categories_is_auto_generated_check CHECK ((is_auto_generated = ANY (ARRAY[0, 1])))
);


--
-- Name: categories_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_category_id_seq OWNED BY public.categories.category_id;


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_of_accounts (
    account_id integer NOT NULL,
    establishment_id integer NOT NULL,
    account_number text NOT NULL,
    account_name text NOT NULL,
    account_type text NOT NULL,
    account_subtype text,
    normal_balance text NOT NULL,
    parent_account_id integer,
    is_active integer DEFAULT 1,
    description text,
    CONSTRAINT chart_of_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['asset'::text, 'liability'::text, 'equity'::text, 'revenue'::text, 'expense'::text, 'contra_asset'::text, 'contra_revenue'::text]))),
    CONSTRAINT chart_of_accounts_is_active_check CHECK ((is_active = ANY (ARRAY[0, 1]))),
    CONSTRAINT chart_of_accounts_normal_balance_check CHECK ((normal_balance = ANY (ARRAY['debit'::text, 'credit'::text])))
);


--
-- Name: chart_of_accounts_account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chart_of_accounts_account_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chart_of_accounts_account_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chart_of_accounts_account_id_seq OWNED BY public.chart_of_accounts.account_id;


--
-- Name: customer_display_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_display_sessions (
    session_id integer NOT NULL,
    establishment_id integer NOT NULL,
    transaction_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: customer_display_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_display_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_display_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_display_sessions_session_id_seq OWNED BY public.customer_display_sessions.session_id;


--
-- Name: customer_display_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_display_settings (
    setting_id integer NOT NULL,
    establishment_id integer NOT NULL,
    tip_enabled integer DEFAULT 0 NOT NULL,
    tip_suggestions text,
    receipt_enabled integer DEFAULT 1 NOT NULL,
    signature_required integer DEFAULT 0 NOT NULL,
    display_message text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT customer_display_settings_receipt_enabled_check CHECK ((receipt_enabled = ANY (ARRAY[0, 1]))),
    CONSTRAINT customer_display_settings_signature_required_check CHECK ((signature_required = ANY (ARRAY[0, 1]))),
    CONSTRAINT customer_display_settings_tip_enabled_check CHECK ((tip_enabled = ANY (ARRAY[0, 1])))
);


--
-- Name: customer_display_settings_setting_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_display_settings_setting_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_display_settings_setting_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_display_settings_setting_id_seq OWNED BY public.customer_display_settings.setting_id;


--
-- Name: customer_rewards_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_rewards_settings (
    id integer NOT NULL,
    enabled integer DEFAULT 0,
    require_email integer DEFAULT 0,
    require_phone integer DEFAULT 0,
    require_both integer DEFAULT 0,
    reward_type text DEFAULT 'points'::text,
    points_per_dollar real DEFAULT 1.0,
    percentage_discount real DEFAULT 0.0,
    fixed_discount real DEFAULT 0.0,
    minimum_spend real DEFAULT 0.0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_rewards_settings_enabled_check CHECK ((enabled = ANY (ARRAY[0, 1]))),
    CONSTRAINT customer_rewards_settings_fixed_discount_check CHECK ((fixed_discount >= (0)::double precision)),
    CONSTRAINT customer_rewards_settings_minimum_spend_check CHECK ((minimum_spend >= (0)::double precision)),
    CONSTRAINT customer_rewards_settings_percentage_discount_check CHECK (((percentage_discount >= (0)::double precision) AND (percentage_discount <= (100)::double precision))),
    CONSTRAINT customer_rewards_settings_points_per_dollar_check CHECK ((points_per_dollar >= (0)::double precision)),
    CONSTRAINT customer_rewards_settings_require_both_check CHECK ((require_both = ANY (ARRAY[0, 1]))),
    CONSTRAINT customer_rewards_settings_require_email_check CHECK ((require_email = ANY (ARRAY[0, 1]))),
    CONSTRAINT customer_rewards_settings_require_phone_check CHECK ((require_phone = ANY (ARRAY[0, 1]))),
    CONSTRAINT customer_rewards_settings_reward_type_check CHECK ((reward_type = ANY (ARRAY['points'::text, 'percentage'::text, 'fixed'::text])))
);


--
-- Name: customer_rewards_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_rewards_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_rewards_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_rewards_settings_id_seq OWNED BY public.customer_rewards_settings.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    customer_id integer NOT NULL,
    establishment_id integer NOT NULL,
    customer_name text,
    email text,
    phone text,
    loyalty_points integer DEFAULT 0,
    created_date timestamp without time zone DEFAULT now()
);


--
-- Name: customers_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_customer_id_seq OWNED BY public.customers.customer_id;


--
-- Name: daily_cash_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_cash_counts (
    count_id integer NOT NULL,
    establishment_id integer NOT NULL,
    register_id integer DEFAULT 1 NOT NULL,
    count_date date NOT NULL,
    count_type text DEFAULT 'drop'::text NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    denominations text,
    counted_by integer NOT NULL,
    counted_at timestamp without time zone DEFAULT now(),
    notes text,
    CONSTRAINT daily_cash_counts_count_type_check CHECK ((count_type = ANY (ARRAY['drop'::text, 'opening'::text, 'closing'::text])))
);


--
-- Name: daily_cash_counts_count_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_cash_counts_count_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_cash_counts_count_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_cash_counts_count_id_seq OWNED BY public.daily_cash_counts.count_id;


--
-- Name: employee_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_availability (
    availability_id integer NOT NULL,
    establishment_id integer NOT NULL,
    employee_id integer NOT NULL,
    monday text,
    tuesday text,
    wednesday text,
    thursday text,
    friday text,
    saturday text,
    sunday text,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: employee_availability_availability_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_availability_availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_availability_availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_availability_availability_id_seq OWNED BY public.employee_availability.availability_id;


--
-- Name: employee_permission_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_permission_overrides (
    override_id integer NOT NULL,
    establishment_id integer NOT NULL,
    employee_id integer NOT NULL,
    permission_id integer NOT NULL,
    granted integer,
    reason text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT employee_permission_overrides_granted_check CHECK ((granted = ANY (ARRAY[0, 1])))
);


--
-- Name: employee_permission_overrides_override_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_permission_overrides_override_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_permission_overrides_override_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_permission_overrides_override_id_seq OWNED BY public.employee_permission_overrides.override_id;


--
-- Name: employee_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_positions (
    employee_position_id integer NOT NULL,
    employee_id integer NOT NULL,
    position_name text NOT NULL,
    hourly_rate numeric(10,2)
);


--
-- Name: employee_positions_employee_position_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_positions_employee_position_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_positions_employee_position_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_positions_employee_position_id_seq OWNED BY public.employee_positions.employee_position_id;


--
-- Name: employee_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_schedule (
    schedule_id integer NOT NULL,
    establishment_id integer NOT NULL,
    employee_id integer NOT NULL,
    schedule_date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    break_duration integer DEFAULT 0,
    notes text,
    status text DEFAULT 'scheduled'::text,
    confirmed integer DEFAULT 0,
    confirmed_at timestamp without time zone,
    time_entry_id integer,
    CONSTRAINT employee_schedule_confirmed_check CHECK ((confirmed = ANY (ARRAY[0, 1]))),
    CONSTRAINT employee_schedule_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'clocked_in'::text, 'clocked_out'::text, 'no_show'::text, 'cancelled'::text])))
);


--
-- Name: employee_schedule_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_schedule_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_schedule_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_schedule_schedule_id_seq OWNED BY public.employee_schedule.schedule_id;


--
-- Name: employee_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_sessions (
    session_id integer NOT NULL,
    establishment_id integer NOT NULL,
    employee_id integer NOT NULL,
    login_time timestamp without time zone DEFAULT now(),
    logout_time timestamp without time zone,
    session_token text,
    ip_address text,
    device_info text,
    is_active integer DEFAULT 1,
    CONSTRAINT employee_sessions_is_active_check CHECK ((is_active = ANY (ARRAY[0, 1])))
);


--
-- Name: employee_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_sessions_session_id_seq OWNED BY public.employee_sessions.session_id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    employee_id integer NOT NULL,
    establishment_id integer NOT NULL,
    employee_code text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    password_hash text,
    "position" text NOT NULL,
    department text,
    date_started date NOT NULL,
    date_terminated date,
    hourly_rate numeric(10,2),
    salary numeric(10,2),
    employment_type text DEFAULT 'part_time'::text,
    active integer DEFAULT 1,
    address text,
    emergency_contact_name text,
    emergency_contact_phone text,
    notes text,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    role_id integer,
    max_hours_per_week integer DEFAULT 40,
    min_hours_per_week integer DEFAULT 0,
    CONSTRAINT employees_active_check CHECK ((active = ANY (ARRAY[0, 1]))),
    CONSTRAINT employees_employment_type_check CHECK ((employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'contract'::text, 'temporary'::text]))),
    CONSTRAINT employees_position_check CHECK (("position" = ANY (ARRAY['cashier'::text, 'stock_clerk'::text, 'manager'::text, 'admin'::text, 'supervisor'::text, 'assistant_manager'::text])))
);


--
-- Name: employees_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_employee_id_seq OWNED BY public.employees.employee_id;


--
-- Name: establishments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.establishments (
    establishment_id integer NOT NULL,
    establishment_name text NOT NULL,
    establishment_code text NOT NULL,
    subdomain text,
    created_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb
);


--
-- Name: establishments_establishment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.establishments_establishment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: establishments_establishment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.establishments_establishment_id_seq OWNED BY public.establishments.establishment_id;


--
-- Name: fiscal_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_periods (
    period_id integer NOT NULL,
    establishment_id integer NOT NULL,
    period_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_closed integer DEFAULT 0,
    closed_by integer,
    closed_date timestamp without time zone,
    CONSTRAINT fiscal_periods_is_closed_check CHECK ((is_closed = ANY (ARRAY[0, 1])))
);


--
-- Name: fiscal_periods_period_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fiscal_periods_period_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fiscal_periods_period_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fiscal_periods_period_id_seq OWNED BY public.fiscal_periods.period_id;


--
-- Name: image_identifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.image_identifications (
    identification_id integer NOT NULL,
    establishment_id integer NOT NULL,
    product_id integer NOT NULL,
    query_image_path text NOT NULL,
    confidence_score numeric(3,2) NOT NULL,
    identified_by text,
    identified_at timestamp without time zone DEFAULT now(),
    context text DEFAULT 'manual_lookup'::text,
    CONSTRAINT image_identifications_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT image_identifications_context_check CHECK ((context = ANY (ARRAY['inventory_check'::text, 'shipment_receiving'::text, 'manual_lookup'::text])))
);


--
-- Name: image_identifications_identification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.image_identifications_identification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: image_identifications_identification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.image_identifications_identification_id_seq OWNED BY public.image_identifications.identification_id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    product_id integer NOT NULL,
    establishment_id integer NOT NULL,
    product_name text NOT NULL,
    sku text NOT NULL,
    barcode text,
    product_price numeric(10,2) NOT NULL,
    product_cost numeric(10,2) NOT NULL,
    vendor_id integer,
    photo text,
    current_quantity integer DEFAULT 0 NOT NULL,
    category text,
    last_restocked timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT inventory_current_quantity_check CHECK ((current_quantity >= 0)),
    CONSTRAINT inventory_product_cost_check CHECK ((product_cost >= (0)::numeric)),
    CONSTRAINT inventory_product_price_check CHECK ((product_price >= (0)::numeric))
);


--
-- Name: inventory_product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_product_id_seq OWNED BY public.inventory.product_id;


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    journal_entry_id integer NOT NULL,
    establishment_id integer NOT NULL,
    entry_number text,
    entry_date date NOT NULL,
    entry_type text DEFAULT 'standard'::text,
    transaction_source text NOT NULL,
    source_id integer,
    description text NOT NULL,
    employee_id integer NOT NULL,
    posted integer DEFAULT 0,
    posted_date timestamp without time zone,
    notes text,
    CONSTRAINT journal_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['standard'::text, 'adjusting'::text, 'closing'::text, 'reversing'::text]))),
    CONSTRAINT journal_entries_posted_check CHECK ((posted = ANY (ARRAY[0, 1]))),
    CONSTRAINT journal_entries_transaction_source_check CHECK ((transaction_source = ANY (ARRAY['sale'::text, 'purchase'::text, 'shipment'::text, 'return'::text, 'adjustment'::text, 'payroll'::text, 'other'::text])))
);


--
-- Name: journal_entries_journal_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_entries_journal_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_entries_journal_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_entries_journal_entry_id_seq OWNED BY public.journal_entries.journal_entry_id;


--
-- Name: journal_entry_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_lines (
    line_id integer NOT NULL,
    establishment_id integer NOT NULL,
    journal_entry_id integer NOT NULL,
    line_number integer NOT NULL,
    account_id integer NOT NULL,
    debit_amount numeric(10,2) DEFAULT 0,
    credit_amount numeric(10,2) DEFAULT 0,
    description text,
    CONSTRAINT journal_entry_lines_credit_amount_check CHECK ((credit_amount >= (0)::numeric)),
    CONSTRAINT journal_entry_lines_debit_amount_check CHECK ((debit_amount >= (0)::numeric))
);


--
-- Name: journal_entry_lines_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_entry_lines_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_entry_lines_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_entry_lines_line_id_seq OWNED BY public.journal_entry_lines.line_id;


--
-- Name: master_calendar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_calendar (
    calendar_id integer NOT NULL,
    establishment_id integer NOT NULL,
    event_date date NOT NULL,
    event_type text NOT NULL,
    title text NOT NULL,
    description text,
    start_time time without time zone,
    end_time time without time zone,
    related_id integer,
    related_table text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT master_calendar_event_type_check CHECK ((event_type = ANY (ARRAY['schedule'::text, 'shipment'::text, 'holiday'::text, 'event'::text, 'meeting'::text, 'maintenance'::text, 'other'::text])))
);


--
-- Name: master_calendar_calendar_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_calendar_calendar_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_calendar_calendar_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_calendar_calendar_id_seq OWNED BY public.master_calendar.calendar_id;


--
-- Name: metadata_extraction_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_extraction_log (
    log_id integer NOT NULL,
    product_id integer NOT NULL,
    extraction_method text NOT NULL,
    data_extracted text,
    execution_time_ms integer,
    success integer DEFAULT 1,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT metadata_extraction_log_success_check CHECK ((success = ANY (ARRAY[0, 1])))
);


--
-- Name: metadata_extraction_log_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.metadata_extraction_log_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: metadata_extraction_log_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.metadata_extraction_log_log_id_seq OWNED BY public.metadata_extraction_log.log_id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    order_item_id integer NOT NULL,
    establishment_id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    subtotal numeric(10,2) NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    CONSTRAINT order_items_discount_check CHECK ((discount >= (0)::numeric)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT order_items_tax_amount_check CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT order_items_tax_rate_check CHECK (((tax_rate >= (0)::numeric) AND (tax_rate <= (1)::numeric))),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: order_items_order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_order_item_id_seq OWNED BY public.order_items.order_item_id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    order_id integer NOT NULL,
    establishment_id integer NOT NULL,
    order_number text,
    order_date timestamp without time zone DEFAULT now(),
    customer_id integer,
    employee_id integer NOT NULL,
    subtotal numeric(10,2) DEFAULT 0,
    tax_rate numeric(5,4) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    transaction_fee numeric(10,2) DEFAULT 0,
    total numeric(10,2) DEFAULT 0,
    payment_status text DEFAULT 'completed'::text,
    order_status text DEFAULT 'completed'::text,
    notes text,
    payment_method text NOT NULL,
    tip numeric(10,2) DEFAULT 0,
    order_type text,
    CONSTRAINT orders_discount_check CHECK ((discount >= (0)::numeric)),
    CONSTRAINT orders_order_status_check CHECK ((order_status = ANY (ARRAY['completed'::text, 'voided'::text, 'returned'::text]))),
    CONSTRAINT orders_order_type_check CHECK ((order_type = ANY (ARRAY['pickup'::text, 'delivery'::text]))),
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'credit_card'::text, 'debit_card'::text, 'mobile_payment'::text, 'check'::text, 'store_credit'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'completed'::text, 'refunded'::text, 'partially_refunded'::text]))),
    CONSTRAINT orders_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT orders_tax_amount_check CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT orders_tax_rate_check CHECK (((tax_rate >= (0)::numeric) AND (tax_rate <= (1)::numeric))),
    CONSTRAINT orders_tip_check CHECK ((tip >= (0)::numeric)),
    CONSTRAINT orders_total_check CHECK ((total >= (0)::numeric)),
    CONSTRAINT orders_transaction_fee_check CHECK ((transaction_fee >= (0)::numeric))
);


--
-- Name: orders_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_order_id_seq OWNED BY public.orders.order_id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    payment_method_id integer NOT NULL,
    establishment_id integer NOT NULL,
    method_name text NOT NULL,
    method_type text NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    icon text,
    color text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT payment_methods_is_active_check CHECK ((is_active = ANY (ARRAY[0, 1]))),
    CONSTRAINT payment_methods_method_type_check CHECK ((method_type = ANY (ARRAY['cash'::text, 'credit_card'::text, 'debit_card'::text, 'mobile_payment'::text, 'check'::text, 'store_credit'::text, 'other'::text])))
);


--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_methods_payment_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_payment_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_methods_payment_method_id_seq OWNED BY public.payment_methods.payment_method_id;


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    transaction_id integer NOT NULL,
    establishment_id integer NOT NULL,
    order_id integer NOT NULL,
    payment_method text,
    amount numeric(10,2) NOT NULL,
    transaction_fee numeric(10,2) DEFAULT 0,
    transaction_fee_rate numeric(5,4) DEFAULT 0,
    net_amount numeric(10,2) NOT NULL,
    transaction_date timestamp without time zone DEFAULT now(),
    card_last_four text,
    authorization_code text,
    processor_name text,
    status text DEFAULT 'approved'::text,
    tip numeric(10,2) DEFAULT 0,
    employee_id integer,
    CONSTRAINT payment_transactions_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'credit_card'::text, 'debit_card'::text, 'mobile_payment'::text, 'check'::text, 'store_credit'::text, 'refund'::text]))),
    CONSTRAINT payment_transactions_status_check CHECK ((status = ANY (ARRAY['approved'::text, 'declined'::text, 'pending'::text, 'refunded'::text]))),
    CONSTRAINT payment_transactions_transaction_fee_check CHECK ((transaction_fee >= (0)::numeric)),
    CONSTRAINT payment_transactions_transaction_fee_rate_check CHECK (((transaction_fee_rate >= (0)::numeric) AND (transaction_fee_rate <= (1)::numeric)))
);


--
-- Name: payment_transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_transactions_transaction_id_seq OWNED BY public.payment_transactions.transaction_id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    payment_id integer NOT NULL,
    establishment_id integer NOT NULL,
    transaction_id integer NOT NULL,
    payment_method_id integer,
    amount numeric(10,2) NOT NULL,
    card_last_four text,
    card_type text,
    authorization_code text,
    payment_status text DEFAULT 'approved'::text NOT NULL,
    processed_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT payments_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payments_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'refunded'::text])))
);


--
-- Name: payments_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_payment_id_seq OWNED BY public.payments.payment_id;


--
-- Name: pending_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_return_items (
    return_item_id integer NOT NULL,
    establishment_id integer NOT NULL,
    return_id integer NOT NULL,
    order_item_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0,
    refund_amount numeric(10,2) NOT NULL,
    condition text,
    notes text,
    CONSTRAINT pending_return_items_condition_check CHECK ((condition = ANY (ARRAY['new'::text, 'opened'::text, 'damaged'::text, 'defective'::text]))),
    CONSTRAINT pending_return_items_discount_check CHECK ((discount >= (0)::numeric)),
    CONSTRAINT pending_return_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT pending_return_items_refund_amount_check CHECK ((refund_amount >= (0)::numeric)),
    CONSTRAINT pending_return_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: pending_return_items_return_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_return_items_return_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_return_items_return_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_return_items_return_item_id_seq OWNED BY public.pending_return_items.return_item_id;


--
-- Name: pending_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_returns (
    return_id integer NOT NULL,
    establishment_id integer NOT NULL,
    return_number text,
    order_id integer NOT NULL,
    employee_id integer NOT NULL,
    customer_id integer,
    return_date timestamp without time zone DEFAULT now(),
    total_refund_amount numeric(10,2) DEFAULT 0,
    reason text,
    status text DEFAULT 'pending'::text,
    approved_by integer,
    approved_date timestamp without time zone,
    notes text,
    CONSTRAINT pending_returns_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]))),
    CONSTRAINT pending_returns_total_refund_amount_check CHECK ((total_refund_amount >= (0)::numeric))
);


--
-- Name: pending_returns_return_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_returns_return_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_returns_return_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_returns_return_id_seq OWNED BY public.pending_returns.return_id;


--
-- Name: pending_shipment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_shipment_items (
    pending_item_id integer NOT NULL,
    establishment_id integer NOT NULL,
    pending_shipment_id integer NOT NULL,
    product_sku text,
    product_name text,
    quantity_expected integer NOT NULL,
    quantity_verified integer,
    unit_cost numeric(10,2) NOT NULL,
    lot_number text,
    expiration_date text,
    discrepancy_notes text,
    product_id integer,
    barcode text,
    line_number integer,
    status text DEFAULT 'pending'::text,
    verified_by integer,
    verified_at timestamp without time zone,
    CONSTRAINT pending_shipment_items_quantity_expected_check CHECK ((quantity_expected > 0)),
    CONSTRAINT pending_shipment_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: pending_shipment_items_pending_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_shipment_items_pending_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_shipment_items_pending_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_shipment_items_pending_item_id_seq OWNED BY public.pending_shipment_items.pending_item_id;


--
-- Name: pending_shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_shipments (
    pending_shipment_id integer NOT NULL,
    establishment_id integer NOT NULL,
    vendor_id integer NOT NULL,
    expected_date text,
    upload_timestamp timestamp without time zone DEFAULT now(),
    file_path text,
    purchase_order_number text,
    tracking_number text,
    status text DEFAULT 'pending_review'::text,
    uploaded_by integer,
    approved_by integer,
    approved_date timestamp without time zone,
    reviewed_by text,
    reviewed_date timestamp without time zone,
    notes text,
    started_by integer,
    verification_mode text DEFAULT 'verify_whole_shipment'::text,
    started_at timestamp without time zone,
    completed_by integer,
    completed_at timestamp without time zone,
    workflow_step text,
    added_to_inventory integer DEFAULT 0,
    CONSTRAINT pending_shipments_added_to_inventory_check CHECK ((added_to_inventory = ANY (ARRAY[0, 1]))),
    CONSTRAINT pending_shipments_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'in_progress'::text, 'approved'::text, 'rejected'::text, 'completed_with_issues'::text, 'draft'::text])))
);


--
-- Name: pending_shipments_pending_shipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_shipments_pending_shipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_shipments_pending_shipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_shipments_pending_shipment_id_seq OWNED BY public.pending_shipments.pending_shipment_id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    permission_id integer NOT NULL,
    permission_name text NOT NULL,
    permission_category text,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: permissions_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissions_permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_permission_id_seq OWNED BY public.permissions.permission_id;


--
-- Name: pos_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_settings (
    id integer NOT NULL,
    num_registers integer DEFAULT 1,
    register_type text DEFAULT 'one_screen'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: pos_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pos_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pos_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pos_settings_id_seq OWNED BY public.pos_settings.id;


--
-- Name: product_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_metadata (
    metadata_id integer NOT NULL,
    product_id integer NOT NULL,
    brand text,
    color text,
    size text,
    tags text,
    keywords text,
    attributes text,
    search_vector text,
    category_id integer,
    category_confidence real DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_metadata_category_confidence_check CHECK (((category_confidence >= (0)::double precision) AND (category_confidence <= (1)::double precision)))
);


--
-- Name: product_metadata_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_metadata_metadata_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_metadata_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_metadata_metadata_id_seq OWNED BY public.product_metadata.metadata_id;


--
-- Name: receipt_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_preferences (
    preference_id integer NOT NULL,
    transaction_id integer NOT NULL,
    receipt_type text NOT NULL,
    email_address text,
    phone_number text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT receipt_preferences_receipt_type_check CHECK ((receipt_type = ANY (ARRAY['email'::text, 'sms'::text, 'print'::text, 'none'::text])))
);


--
-- Name: receipt_preferences_preference_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receipt_preferences_preference_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_preferences_preference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receipt_preferences_preference_id_seq OWNED BY public.receipt_preferences.preference_id;


--
-- Name: receipt_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_settings (
    id integer NOT NULL,
    receipt_type text DEFAULT 'traditional'::text,
    store_name text DEFAULT 'Store'::text,
    store_address text DEFAULT ''::text,
    store_city text DEFAULT ''::text,
    store_state text DEFAULT ''::text,
    store_zip text DEFAULT ''::text,
    store_phone text DEFAULT ''::text,
    store_email text DEFAULT ''::text,
    store_website text DEFAULT ''::text,
    footer_message text DEFAULT 'Thank you for your business!'::text,
    return_policy text DEFAULT ''::text,
    show_tax_breakdown integer DEFAULT 1,
    show_payment_method integer DEFAULT 1,
    show_signature integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT receipt_settings_receipt_type_check CHECK ((receipt_type = ANY (ARRAY['traditional'::text, 'custom'::text]))),
    CONSTRAINT receipt_settings_show_payment_method_check CHECK ((show_payment_method = ANY (ARRAY[0, 1]))),
    CONSTRAINT receipt_settings_show_signature_check CHECK ((show_signature = ANY (ARRAY[0, 1]))),
    CONSTRAINT receipt_settings_show_tax_breakdown_check CHECK ((show_tax_breakdown = ANY (ARRAY[0, 1])))
);


--
-- Name: receipt_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receipt_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipt_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receipt_settings_id_seq OWNED BY public.receipt_settings.id;


--
-- Name: register_cash_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.register_cash_settings (
    setting_id integer NOT NULL,
    establishment_id integer NOT NULL,
    register_id integer DEFAULT 1 NOT NULL,
    cash_mode text DEFAULT 'total'::text NOT NULL,
    total_amount numeric(10,2),
    denominations text,
    is_active integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT register_cash_settings_cash_mode_check CHECK ((cash_mode = ANY (ARRAY['total'::text, 'denominations'::text]))),
    CONSTRAINT register_cash_settings_is_active_check CHECK ((is_active = ANY (ARRAY[0, 1])))
);


--
-- Name: register_cash_settings_setting_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.register_cash_settings_setting_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: register_cash_settings_setting_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.register_cash_settings_setting_id_seq OWNED BY public.register_cash_settings.setting_id;


--
-- Name: retained_earnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retained_earnings (
    retained_earnings_id integer NOT NULL,
    establishment_id integer NOT NULL,
    fiscal_period_id integer NOT NULL,
    beginning_balance numeric(10,2) NOT NULL,
    net_income numeric(10,2) NOT NULL,
    dividends numeric(10,2) DEFAULT 0,
    ending_balance numeric(10,2) NOT NULL,
    calculation_date timestamp without time zone DEFAULT now()
);


--
-- Name: retained_earnings_retained_earnings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.retained_earnings_retained_earnings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: retained_earnings_retained_earnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.retained_earnings_retained_earnings_id_seq OWNED BY public.retained_earnings.retained_earnings_id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_permission_id integer NOT NULL,
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    granted integer DEFAULT 1,
    CONSTRAINT role_permissions_granted_check CHECK ((granted = ANY (ARRAY[0, 1])))
);


--
-- Name: role_permissions_role_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_role_permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_permissions_role_permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_role_permission_id_seq OWNED BY public.role_permissions.role_permission_id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    role_id integer NOT NULL,
    establishment_id integer NOT NULL,
    role_name text NOT NULL,
    description text,
    is_system_role integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT roles_is_system_role_check CHECK ((is_system_role = ANY (ARRAY[0, 1])))
);


--
-- Name: roles_role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_role_id_seq OWNED BY public.roles.role_id;


--
-- Name: schedule_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_changes (
    change_id integer NOT NULL,
    period_id integer,
    scheduled_shift_id integer,
    change_type text NOT NULL,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT now(),
    old_values text,
    new_values text,
    reason text,
    CONSTRAINT schedule_changes_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'modified'::text, 'deleted'::text, 'published'::text])))
);


--
-- Name: schedule_changes_change_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_changes_change_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_changes_change_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_changes_change_id_seq OWNED BY public.schedule_changes.change_id;


--
-- Name: schedule_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_notifications (
    notification_id integer NOT NULL,
    period_id integer NOT NULL,
    employee_id integer NOT NULL,
    notification_type text,
    sent_via text,
    sent_at timestamp without time zone DEFAULT now(),
    viewed integer DEFAULT 0,
    viewed_at timestamp without time zone,
    CONSTRAINT schedule_notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['new_schedule'::text, 'schedule_change'::text, 'shift_reminder'::text]))),
    CONSTRAINT schedule_notifications_sent_via_check CHECK ((sent_via = ANY (ARRAY['email'::text, 'sms'::text, 'push'::text, 'all'::text]))),
    CONSTRAINT schedule_notifications_viewed_check CHECK ((viewed = ANY (ARRAY[0, 1])))
);


--
-- Name: schedule_notifications_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_notifications_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_notifications_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_notifications_notification_id_seq OWNED BY public.schedule_notifications.notification_id;


--
-- Name: schedule_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_periods (
    period_id integer NOT NULL,
    week_start_date date NOT NULL,
    week_end_date date NOT NULL,
    status text DEFAULT 'draft'::text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    published_by integer,
    published_at timestamp without time zone,
    template_id integer,
    generation_method text DEFAULT 'manual'::text,
    generation_settings text,
    total_labor_hours numeric(10,2),
    estimated_labor_cost numeric(10,2),
    CONSTRAINT schedule_periods_generation_method_check CHECK ((generation_method = ANY (ARRAY['manual'::text, 'auto'::text, 'template'::text]))),
    CONSTRAINT schedule_periods_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: schedule_periods_period_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedule_periods_period_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedule_periods_period_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedule_periods_period_id_seq OWNED BY public.schedule_periods.period_id;


--
-- Name: scheduled_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_shifts (
    scheduled_shift_id integer NOT NULL,
    period_id integer NOT NULL,
    employee_id integer NOT NULL,
    shift_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_duration integer DEFAULT 30,
    "position" text,
    notes text,
    is_draft integer DEFAULT 1,
    conflicts text,
    CONSTRAINT scheduled_shifts_is_draft_check CHECK ((is_draft = ANY (ARRAY[0, 1])))
);


--
-- Name: scheduled_shifts_scheduled_shift_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_shifts_scheduled_shift_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_shifts_scheduled_shift_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_shifts_scheduled_shift_id_seq OWNED BY public.scheduled_shifts.scheduled_shift_id;


--
-- Name: search_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_history (
    search_id integer NOT NULL,
    search_query text NOT NULL,
    results_count integer DEFAULT 0,
    filters text,
    user_id integer,
    search_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: search_history_search_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.search_history_search_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: search_history_search_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.search_history_search_id_seq OWNED BY public.search_history.search_id;


--
-- Name: shipment_discrepancies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_discrepancies (
    discrepancy_id integer NOT NULL,
    establishment_id integer NOT NULL,
    shipment_id integer,
    pending_shipment_id integer,
    product_id integer NOT NULL,
    discrepancy_type text NOT NULL,
    expected_quantity integer,
    actual_quantity integer,
    discrepancy_quantity integer,
    expected_product_sku text,
    actual_product_sku text,
    financial_impact numeric(10,2),
    reported_by integer NOT NULL,
    reported_date timestamp without time zone DEFAULT now(),
    resolution_status text DEFAULT 'reported'::text,
    resolved_by integer,
    resolved_date timestamp without time zone,
    resolution_notes text,
    vendor_notified integer DEFAULT 0,
    vendor_response text,
    claim_number text,
    photos text,
    CONSTRAINT shipment_discrepancies_discrepancy_type_check CHECK ((discrepancy_type = ANY (ARRAY['missing'::text, 'extra'::text, 'damaged'::text, 'wrong_product'::text, 'quantity_short'::text, 'quantity_over'::text, 'expired'::text, 'wrong_lot'::text]))),
    CONSTRAINT shipment_discrepancies_resolution_status_check CHECK ((resolution_status = ANY (ARRAY['reported'::text, 'investigating'::text, 'resolved'::text, 'written_off'::text]))),
    CONSTRAINT shipment_discrepancies_vendor_notified_check CHECK ((vendor_notified = ANY (ARRAY[0, 1])))
);


--
-- Name: shipment_discrepancies_discrepancy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipment_discrepancies_discrepancy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipment_discrepancies_discrepancy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipment_discrepancies_discrepancy_id_seq OWNED BY public.shipment_discrepancies.discrepancy_id;


--
-- Name: shipment_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_issues (
    issue_id integer NOT NULL,
    pending_shipment_id integer NOT NULL,
    pending_item_id integer,
    issue_type text NOT NULL,
    severity text DEFAULT 'minor'::text,
    quantity_affected integer DEFAULT 1,
    reported_by integer NOT NULL,
    reported_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    photo_path text,
    resolution_status text DEFAULT 'open'::text,
    resolved_by integer,
    resolved_at timestamp without time zone,
    resolution_notes text,
    CONSTRAINT shipment_issues_issue_type_check CHECK ((issue_type = ANY (ARRAY['missing'::text, 'damaged'::text, 'wrong_item'::text, 'quantity_mismatch'::text, 'expired'::text, 'quality'::text, 'other'::text]))),
    CONSTRAINT shipment_issues_resolution_status_check CHECK ((resolution_status = ANY (ARRAY['open'::text, 'resolved'::text, 'vendor_contacted'::text, 'credit_issued'::text]))),
    CONSTRAINT shipment_issues_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'major'::text, 'critical'::text])))
);


--
-- Name: shipment_issues_issue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipment_issues_issue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipment_issues_issue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipment_issues_issue_id_seq OWNED BY public.shipment_issues.issue_id;


--
-- Name: shipment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_items (
    shipment_item_id integer NOT NULL,
    establishment_id integer NOT NULL,
    shipment_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity_received integer NOT NULL,
    unit_cost numeric(10,2) NOT NULL,
    lot_number text,
    expiration_date text,
    received_timestamp timestamp without time zone DEFAULT now(),
    CONSTRAINT shipment_items_quantity_received_check CHECK ((quantity_received > 0)),
    CONSTRAINT shipment_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: shipment_items_shipment_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipment_items_shipment_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipment_items_shipment_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipment_items_shipment_item_id_seq OWNED BY public.shipment_items.shipment_item_id;


--
-- Name: shipment_scan_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_scan_log (
    scan_id integer NOT NULL,
    pending_shipment_id integer NOT NULL,
    pending_item_id integer,
    scanned_barcode text NOT NULL,
    scanned_by integer NOT NULL,
    scanned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    scan_result text DEFAULT 'match'::text,
    device_id text,
    location text,
    CONSTRAINT shipment_scan_log_scan_result_check CHECK ((scan_result = ANY (ARRAY['match'::text, 'mismatch'::text, 'unknown'::text, 'duplicate'::text])))
);


--
-- Name: shipment_scan_log_scan_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipment_scan_log_scan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipment_scan_log_scan_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipment_scan_log_scan_id_seq OWNED BY public.shipment_scan_log.scan_id;


--
-- Name: shipment_verification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipment_verification_settings (
    setting_key text NOT NULL,
    setting_value text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: shipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipments (
    shipment_id integer NOT NULL,
    establishment_id integer NOT NULL,
    vendor_id integer,
    purchase_order_number text,
    tracking_number text,
    total_cost numeric(10,2),
    received_by integer,
    verified_by integer,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    status text DEFAULT 'completed'::text,
    upload_timestamp timestamp without time zone,
    file_path text,
    uploaded_by integer,
    reviewed_by text,
    reviewed_date timestamp without time zone,
    approved_by integer,
    approved_date timestamp without time zone,
    shipment_date date,
    received_date date,
    CONSTRAINT shipments_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'rejected'::text, 'received'::text, 'completed'::text])))
);


--
-- Name: shipments_shipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipments_shipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipments_shipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipments_shipment_id_seq OWNED BY public.shipments.shipment_id;


--
-- Name: time_clock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_clock (
    time_entry_id integer NOT NULL,
    establishment_id integer NOT NULL,
    employee_id integer NOT NULL,
    clock_in timestamp without time zone NOT NULL,
    clock_out timestamp without time zone,
    break_start timestamp without time zone,
    break_end timestamp without time zone,
    total_hours numeric(5,2),
    notes text,
    status text DEFAULT 'clocked_in'::text,
    CONSTRAINT time_clock_status_check CHECK ((status = ANY (ARRAY['clocked_in'::text, 'on_break'::text, 'clocked_out'::text])))
);


--
-- Name: time_clock_time_entry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.time_clock_time_entry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: time_clock_time_entry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.time_clock_time_entry_id_seq OWNED BY public.time_clock.time_entry_id;


--
-- Name: transaction_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_items (
    transaction_item_id integer NOT NULL,
    establishment_id integer NOT NULL,
    transaction_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT transaction_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT transaction_items_subtotal_check CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT transaction_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: transaction_items_transaction_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_items_transaction_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transaction_items_transaction_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_items_transaction_item_id_seq OWNED BY public.transaction_items.transaction_item_id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    transaction_id integer NOT NULL,
    establishment_id integer NOT NULL,
    employee_id integer NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    tax numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    tip numeric(10,2) DEFAULT 0,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    payment_status text,
    amount_paid numeric(10,2),
    change_amount numeric(10,2) DEFAULT 0,
    completed_at timestamp without time zone,
    signature text,
    customer_id integer,
    order_id integer,
    CONSTRAINT transactions_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'refunded'::text]))),
    CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: transactions_transaction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_transaction_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_transaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_transaction_id_seq OWNED BY public.transactions.transaction_id;


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    vendor_id integer NOT NULL,
    establishment_id integer NOT NULL,
    vendor_name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    address text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: vendors_vendor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vendors_vendor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vendors_vendor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vendors_vendor_id_seq OWNED BY public.vendors.vendor_id;


--
-- Name: verification_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_sessions (
    session_id integer NOT NULL,
    pending_shipment_id integer NOT NULL,
    employee_id integer NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp without time zone,
    total_scans integer DEFAULT 0,
    items_verified integer DEFAULT 0,
    issues_reported integer DEFAULT 0,
    device_id text
);


--
-- Name: verification_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verification_sessions_session_id_seq OWNED BY public.verification_sessions.session_id;


--
-- Name: approved_shipment_items approved_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipment_items ALTER COLUMN approved_item_id SET DEFAULT nextval('public.approved_shipment_items_approved_item_id_seq'::regclass);


--
-- Name: approved_shipments shipment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipments ALTER COLUMN shipment_id SET DEFAULT nextval('public.approved_shipments_shipment_id_seq'::regclass);


--
-- Name: audit_log audit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN audit_id SET DEFAULT nextval('public.audit_log_audit_id_seq'::regclass);


--
-- Name: cash_register_sessions register_session_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions ALTER COLUMN register_session_id SET DEFAULT nextval('public.cash_register_sessions_session_id_seq'::regclass);


--
-- Name: cash_transactions transaction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.cash_transactions_transaction_id_seq'::regclass);


--
-- Name: categories category_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN category_id SET DEFAULT nextval('public.categories_category_id_seq'::regclass);


--
-- Name: chart_of_accounts account_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts ALTER COLUMN account_id SET DEFAULT nextval('public.chart_of_accounts_account_id_seq'::regclass);


--
-- Name: customer_display_sessions session_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_display_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.customer_display_sessions_session_id_seq'::regclass);


--
-- Name: customer_display_settings setting_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_display_settings ALTER COLUMN setting_id SET DEFAULT nextval('public.customer_display_settings_setting_id_seq'::regclass);


--
-- Name: customer_rewards_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rewards_settings ALTER COLUMN id SET DEFAULT nextval('public.customer_rewards_settings_id_seq'::regclass);


--
-- Name: customers customer_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN customer_id SET DEFAULT nextval('public.customers_customer_id_seq'::regclass);


--
-- Name: daily_cash_counts count_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_cash_counts ALTER COLUMN count_id SET DEFAULT nextval('public.daily_cash_counts_count_id_seq'::regclass);


--
-- Name: employee_availability availability_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_availability ALTER COLUMN availability_id SET DEFAULT nextval('public.employee_availability_availability_id_seq'::regclass);


--
-- Name: employee_permission_overrides override_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permission_overrides ALTER COLUMN override_id SET DEFAULT nextval('public.employee_permission_overrides_override_id_seq'::regclass);


--
-- Name: employee_positions employee_position_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_positions ALTER COLUMN employee_position_id SET DEFAULT nextval('public.employee_positions_employee_position_id_seq'::regclass);


--
-- Name: employee_schedule schedule_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_schedule ALTER COLUMN schedule_id SET DEFAULT nextval('public.employee_schedule_schedule_id_seq'::regclass);


--
-- Name: employee_sessions session_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.employee_sessions_session_id_seq'::regclass);


--
-- Name: employees employee_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN employee_id SET DEFAULT nextval('public.employees_employee_id_seq'::regclass);


--
-- Name: establishments establishment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establishments ALTER COLUMN establishment_id SET DEFAULT nextval('public.establishments_establishment_id_seq'::regclass);


--
-- Name: fiscal_periods period_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods ALTER COLUMN period_id SET DEFAULT nextval('public.fiscal_periods_period_id_seq'::regclass);


--
-- Name: image_identifications identification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_identifications ALTER COLUMN identification_id SET DEFAULT nextval('public.image_identifications_identification_id_seq'::regclass);


--
-- Name: inventory product_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory ALTER COLUMN product_id SET DEFAULT nextval('public.inventory_product_id_seq'::regclass);


--
-- Name: journal_entries journal_entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries ALTER COLUMN journal_entry_id SET DEFAULT nextval('public.journal_entries_journal_entry_id_seq'::regclass);


--
-- Name: journal_entry_lines line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines ALTER COLUMN line_id SET DEFAULT nextval('public.journal_entry_lines_line_id_seq'::regclass);


--
-- Name: master_calendar calendar_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_calendar ALTER COLUMN calendar_id SET DEFAULT nextval('public.master_calendar_calendar_id_seq'::regclass);


--
-- Name: metadata_extraction_log log_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_extraction_log ALTER COLUMN log_id SET DEFAULT nextval('public.metadata_extraction_log_log_id_seq'::regclass);


--
-- Name: order_items order_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN order_item_id SET DEFAULT nextval('public.order_items_order_item_id_seq'::regclass);


--
-- Name: orders order_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN order_id SET DEFAULT nextval('public.orders_order_id_seq'::regclass);


--
-- Name: payment_methods payment_method_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN payment_method_id SET DEFAULT nextval('public.payment_methods_payment_method_id_seq'::regclass);


--
-- Name: payment_transactions transaction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.payment_transactions_transaction_id_seq'::regclass);


--
-- Name: payments payment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN payment_id SET DEFAULT nextval('public.payments_payment_id_seq'::regclass);


--
-- Name: pending_return_items return_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_return_items ALTER COLUMN return_item_id SET DEFAULT nextval('public.pending_return_items_return_item_id_seq'::regclass);


--
-- Name: pending_returns return_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns ALTER COLUMN return_id SET DEFAULT nextval('public.pending_returns_return_id_seq'::regclass);


--
-- Name: pending_shipment_items pending_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipment_items ALTER COLUMN pending_item_id SET DEFAULT nextval('public.pending_shipment_items_pending_item_id_seq'::regclass);


--
-- Name: pending_shipments pending_shipment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipments ALTER COLUMN pending_shipment_id SET DEFAULT nextval('public.pending_shipments_pending_shipment_id_seq'::regclass);


--
-- Name: permissions permission_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN permission_id SET DEFAULT nextval('public.permissions_permission_id_seq'::regclass);


--
-- Name: pos_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_settings ALTER COLUMN id SET DEFAULT nextval('public.pos_settings_id_seq'::regclass);


--
-- Name: product_metadata metadata_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_metadata ALTER COLUMN metadata_id SET DEFAULT nextval('public.product_metadata_metadata_id_seq'::regclass);


--
-- Name: receipt_preferences preference_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_preferences ALTER COLUMN preference_id SET DEFAULT nextval('public.receipt_preferences_preference_id_seq'::regclass);


--
-- Name: receipt_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_settings ALTER COLUMN id SET DEFAULT nextval('public.receipt_settings_id_seq'::regclass);


--
-- Name: register_cash_settings setting_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.register_cash_settings ALTER COLUMN setting_id SET DEFAULT nextval('public.register_cash_settings_setting_id_seq'::regclass);


--
-- Name: retained_earnings retained_earnings_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retained_earnings ALTER COLUMN retained_earnings_id SET DEFAULT nextval('public.retained_earnings_retained_earnings_id_seq'::regclass);


--
-- Name: role_permissions role_permission_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN role_permission_id SET DEFAULT nextval('public.role_permissions_role_permission_id_seq'::regclass);


--
-- Name: roles role_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN role_id SET DEFAULT nextval('public.roles_role_id_seq'::regclass);


--
-- Name: schedule_changes change_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes ALTER COLUMN change_id SET DEFAULT nextval('public.schedule_changes_change_id_seq'::regclass);


--
-- Name: schedule_notifications notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_notifications ALTER COLUMN notification_id SET DEFAULT nextval('public.schedule_notifications_notification_id_seq'::regclass);


--
-- Name: schedule_periods period_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_periods ALTER COLUMN period_id SET DEFAULT nextval('public.schedule_periods_period_id_seq'::regclass);


--
-- Name: scheduled_shifts scheduled_shift_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_shifts ALTER COLUMN scheduled_shift_id SET DEFAULT nextval('public.scheduled_shifts_scheduled_shift_id_seq'::regclass);


--
-- Name: search_history search_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_history ALTER COLUMN search_id SET DEFAULT nextval('public.search_history_search_id_seq'::regclass);


--
-- Name: shipment_discrepancies discrepancy_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_discrepancies ALTER COLUMN discrepancy_id SET DEFAULT nextval('public.shipment_discrepancies_discrepancy_id_seq'::regclass);


--
-- Name: shipment_issues issue_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_issues ALTER COLUMN issue_id SET DEFAULT nextval('public.shipment_issues_issue_id_seq'::regclass);


--
-- Name: shipment_items shipment_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items ALTER COLUMN shipment_item_id SET DEFAULT nextval('public.shipment_items_shipment_item_id_seq'::regclass);


--
-- Name: shipment_scan_log scan_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_scan_log ALTER COLUMN scan_id SET DEFAULT nextval('public.shipment_scan_log_scan_id_seq'::regclass);


--
-- Name: shipments shipment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments ALTER COLUMN shipment_id SET DEFAULT nextval('public.shipments_shipment_id_seq'::regclass);


--
-- Name: time_clock time_entry_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_clock ALTER COLUMN time_entry_id SET DEFAULT nextval('public.time_clock_time_entry_id_seq'::regclass);


--
-- Name: transaction_items transaction_item_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items ALTER COLUMN transaction_item_id SET DEFAULT nextval('public.transaction_items_transaction_item_id_seq'::regclass);


--
-- Name: transactions transaction_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN transaction_id SET DEFAULT nextval('public.transactions_transaction_id_seq'::regclass);


--
-- Name: vendors vendor_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors ALTER COLUMN vendor_id SET DEFAULT nextval('public.vendors_vendor_id_seq'::regclass);


--
-- Name: verification_sessions session_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.verification_sessions_session_id_seq'::regclass);


--
-- Name: approved_shipment_items approved_shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipment_items
    ADD CONSTRAINT approved_shipment_items_pkey PRIMARY KEY (approved_item_id);


--
-- Name: approved_shipments approved_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipments
    ADD CONSTRAINT approved_shipments_pkey PRIMARY KEY (shipment_id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (audit_id);


--
-- Name: cash_register_sessions cash_register_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_pkey PRIMARY KEY (register_session_id);


--
-- Name: cash_transactions cash_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (category_id);


--
-- Name: chart_of_accounts chart_of_accounts_establishment_id_account_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_establishment_id_account_number_key UNIQUE (establishment_id, account_number);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (account_id);


--
-- Name: customer_display_sessions customer_display_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_display_sessions
    ADD CONSTRAINT customer_display_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: customer_display_settings customer_display_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_display_settings
    ADD CONSTRAINT customer_display_settings_pkey PRIMARY KEY (setting_id);


--
-- Name: customer_rewards_settings customer_rewards_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_rewards_settings
    ADD CONSTRAINT customer_rewards_settings_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (customer_id);


--
-- Name: daily_cash_counts daily_cash_counts_establishment_id_register_id_count_date_c_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_cash_counts
    ADD CONSTRAINT daily_cash_counts_establishment_id_register_id_count_date_c_key UNIQUE (establishment_id, register_id, count_date, count_type);


--
-- Name: daily_cash_counts daily_cash_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_cash_counts
    ADD CONSTRAINT daily_cash_counts_pkey PRIMARY KEY (count_id);


--
-- Name: employee_availability employee_availability_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT employee_availability_employee_id_key UNIQUE (employee_id);


--
-- Name: employee_availability employee_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT employee_availability_pkey PRIMARY KEY (availability_id);


--
-- Name: employee_permission_overrides employee_permission_overrides_employee_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permission_overrides
    ADD CONSTRAINT employee_permission_overrides_employee_id_permission_id_key UNIQUE (employee_id, permission_id);


--
-- Name: employee_permission_overrides employee_permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permission_overrides
    ADD CONSTRAINT employee_permission_overrides_pkey PRIMARY KEY (override_id);


--
-- Name: employee_positions employee_positions_employee_id_position_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_positions
    ADD CONSTRAINT employee_positions_employee_id_position_name_key UNIQUE (employee_id, position_name);


--
-- Name: employee_positions employee_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_positions
    ADD CONSTRAINT employee_positions_pkey PRIMARY KEY (employee_position_id);


--
-- Name: employee_schedule employee_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_pkey PRIMARY KEY (schedule_id);


--
-- Name: employee_sessions employee_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_sessions
    ADD CONSTRAINT employee_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: employee_sessions employee_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_sessions
    ADD CONSTRAINT employee_sessions_session_token_key UNIQUE (session_token);


--
-- Name: employees employees_establishment_id_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_establishment_id_employee_code_key UNIQUE (establishment_id, employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (employee_id);


--
-- Name: establishments establishments_establishment_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establishments
    ADD CONSTRAINT establishments_establishment_code_key UNIQUE (establishment_code);


--
-- Name: establishments establishments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establishments
    ADD CONSTRAINT establishments_pkey PRIMARY KEY (establishment_id);


--
-- Name: establishments establishments_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.establishments
    ADD CONSTRAINT establishments_subdomain_key UNIQUE (subdomain);


--
-- Name: fiscal_periods fiscal_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_pkey PRIMARY KEY (period_id);


--
-- Name: image_identifications image_identifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_identifications
    ADD CONSTRAINT image_identifications_pkey PRIMARY KEY (identification_id);


--
-- Name: inventory inventory_establishment_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_establishment_id_sku_key UNIQUE (establishment_id, sku);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (product_id);


--
-- Name: journal_entries journal_entries_establishment_id_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_establishment_id_entry_number_key UNIQUE (establishment_id, entry_number);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (journal_entry_id);


--
-- Name: journal_entry_lines journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (line_id);


--
-- Name: master_calendar master_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_calendar
    ADD CONSTRAINT master_calendar_pkey PRIMARY KEY (calendar_id);


--
-- Name: metadata_extraction_log metadata_extraction_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_extraction_log
    ADD CONSTRAINT metadata_extraction_log_pkey PRIMARY KEY (log_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (order_item_id);


--
-- Name: orders orders_establishment_id_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_establishment_id_order_number_key UNIQUE (establishment_id, order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (payment_method_id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- Name: pending_return_items pending_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_return_items
    ADD CONSTRAINT pending_return_items_pkey PRIMARY KEY (return_item_id);


--
-- Name: pending_returns pending_returns_establishment_id_return_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns
    ADD CONSTRAINT pending_returns_establishment_id_return_number_key UNIQUE (establishment_id, return_number);


--
-- Name: pending_returns pending_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns
    ADD CONSTRAINT pending_returns_pkey PRIMARY KEY (return_id);


--
-- Name: pending_shipment_items pending_shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipment_items
    ADD CONSTRAINT pending_shipment_items_pkey PRIMARY KEY (pending_item_id);


--
-- Name: pending_shipments pending_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipments
    ADD CONSTRAINT pending_shipments_pkey PRIMARY KEY (pending_shipment_id);


--
-- Name: permissions permissions_permission_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_permission_name_key UNIQUE (permission_name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (permission_id);


--
-- Name: pos_settings pos_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_settings
    ADD CONSTRAINT pos_settings_pkey PRIMARY KEY (id);


--
-- Name: product_metadata product_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_metadata
    ADD CONSTRAINT product_metadata_pkey PRIMARY KEY (metadata_id);


--
-- Name: product_metadata product_metadata_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_metadata
    ADD CONSTRAINT product_metadata_product_id_key UNIQUE (product_id);


--
-- Name: receipt_preferences receipt_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_preferences
    ADD CONSTRAINT receipt_preferences_pkey PRIMARY KEY (preference_id);


--
-- Name: receipt_settings receipt_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_settings
    ADD CONSTRAINT receipt_settings_pkey PRIMARY KEY (id);


--
-- Name: register_cash_settings register_cash_settings_establishment_id_register_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.register_cash_settings
    ADD CONSTRAINT register_cash_settings_establishment_id_register_id_key UNIQUE (establishment_id, register_id);


--
-- Name: register_cash_settings register_cash_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.register_cash_settings
    ADD CONSTRAINT register_cash_settings_pkey PRIMARY KEY (setting_id);


--
-- Name: retained_earnings retained_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retained_earnings
    ADD CONSTRAINT retained_earnings_pkey PRIMARY KEY (retained_earnings_id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_permission_id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_establishment_id_role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_establishment_id_role_name_key UNIQUE (establishment_id, role_name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (role_id);


--
-- Name: schedule_changes schedule_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_pkey PRIMARY KEY (change_id);


--
-- Name: schedule_notifications schedule_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_notifications
    ADD CONSTRAINT schedule_notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: schedule_periods schedule_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_pkey PRIMARY KEY (period_id);


--
-- Name: schedule_periods schedule_periods_week_start_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_week_start_date_key UNIQUE (week_start_date);


--
-- Name: scheduled_shifts scheduled_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_shifts
    ADD CONSTRAINT scheduled_shifts_pkey PRIMARY KEY (scheduled_shift_id);


--
-- Name: search_history search_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_history
    ADD CONSTRAINT search_history_pkey PRIMARY KEY (search_id);


--
-- Name: shipment_discrepancies shipment_discrepancies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_discrepancies
    ADD CONSTRAINT shipment_discrepancies_pkey PRIMARY KEY (discrepancy_id);


--
-- Name: shipment_issues shipment_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_issues
    ADD CONSTRAINT shipment_issues_pkey PRIMARY KEY (issue_id);


--
-- Name: shipment_items shipment_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_pkey PRIMARY KEY (shipment_item_id);


--
-- Name: shipment_scan_log shipment_scan_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_scan_log
    ADD CONSTRAINT shipment_scan_log_pkey PRIMARY KEY (scan_id);


--
-- Name: shipment_verification_settings shipment_verification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_verification_settings
    ADD CONSTRAINT shipment_verification_settings_pkey PRIMARY KEY (setting_key);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (shipment_id);


--
-- Name: time_clock time_clock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_clock
    ADD CONSTRAINT time_clock_pkey PRIMARY KEY (time_entry_id);


--
-- Name: transaction_items transaction_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items
    ADD CONSTRAINT transaction_items_pkey PRIMARY KEY (transaction_item_id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (vendor_id);


--
-- Name: verification_sessions verification_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_sessions
    ADD CONSTRAINT verification_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: idx_approved_shipments_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approved_shipments_pending ON public.approved_shipments USING btree (pending_shipment_id);


--
-- Name: idx_audit_log_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_establishment ON public.audit_log USING btree (establishment_id);


--
-- Name: idx_cash_register_sessions_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_register_sessions_establishment ON public.cash_register_sessions USING btree (establishment_id);


--
-- Name: idx_cash_transactions_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_transactions_establishment ON public.cash_transactions USING btree (establishment_id);


--
-- Name: idx_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_name ON public.categories USING btree (category_name);


--
-- Name: idx_categories_name_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_categories_name_parent ON public.categories USING btree (category_name, parent_category_id) WHERE (parent_category_id IS NOT NULL);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_category_id);


--
-- Name: idx_categories_root_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_categories_root_name ON public.categories USING btree (category_name) WHERE (parent_category_id IS NULL);


--
-- Name: idx_chart_of_accounts_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chart_of_accounts_establishment ON public.chart_of_accounts USING btree (establishment_id);


--
-- Name: idx_customer_display_sessions_transaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_display_sessions_transaction ON public.customer_display_sessions USING btree (transaction_id);


--
-- Name: idx_customer_display_settings_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_display_settings_establishment ON public.customer_display_settings USING btree (establishment_id);


--
-- Name: idx_customers_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_establishment ON public.customers USING btree (establishment_id);


--
-- Name: idx_daily_cash_counts_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_cash_counts_establishment ON public.daily_cash_counts USING btree (establishment_id);


--
-- Name: idx_employee_availability_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_availability_establishment ON public.employee_availability USING btree (establishment_id);


--
-- Name: idx_employee_permission_overrides_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_permission_overrides_establishment ON public.employee_permission_overrides USING btree (establishment_id);


--
-- Name: idx_employee_positions_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_positions_employee ON public.employee_positions USING btree (employee_id);


--
-- Name: idx_employee_schedule_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_schedule_establishment ON public.employee_schedule USING btree (establishment_id);


--
-- Name: idx_employee_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_sessions_active ON public.employee_sessions USING btree (establishment_id, is_active, employee_id);


--
-- Name: idx_employee_sessions_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_sessions_establishment ON public.employee_sessions USING btree (establishment_id);


--
-- Name: idx_employee_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_sessions_token ON public.employee_sessions USING btree (session_token);


--
-- Name: idx_employees_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_establishment ON public.employees USING btree (establishment_id);


--
-- Name: idx_establishments_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_establishments_code ON public.establishments USING btree (establishment_code);


--
-- Name: idx_establishments_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_establishments_subdomain ON public.establishments USING btree (subdomain);


--
-- Name: idx_fiscal_periods_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_periods_establishment ON public.fiscal_periods USING btree (establishment_id);


--
-- Name: idx_image_identifications_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_image_identifications_establishment ON public.image_identifications USING btree (establishment_id);


--
-- Name: idx_inventory_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_establishment ON public.inventory USING btree (establishment_id);


--
-- Name: idx_inventory_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_sku ON public.inventory USING btree (establishment_id, sku);


--
-- Name: idx_journal_entries_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_establishment ON public.journal_entries USING btree (establishment_id);


--
-- Name: idx_journal_entry_lines_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entry_lines_establishment ON public.journal_entry_lines USING btree (establishment_id);


--
-- Name: idx_master_calendar_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_calendar_establishment ON public.master_calendar USING btree (establishment_id);


--
-- Name: idx_metadata_log_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_metadata_log_product ON public.metadata_extraction_log USING btree (product_id);


--
-- Name: idx_order_items_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_establishment ON public.order_items USING btree (establishment_id);


--
-- Name: idx_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_date ON public.orders USING btree (establishment_id, order_date);


--
-- Name: idx_orders_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_establishment ON public.orders USING btree (establishment_id);


--
-- Name: idx_payment_methods_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_active ON public.payment_methods USING btree (is_active);


--
-- Name: idx_payment_methods_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_establishment ON public.payment_methods USING btree (establishment_id);


--
-- Name: idx_payment_transactions_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_transactions_establishment ON public.payment_transactions USING btree (establishment_id);


--
-- Name: idx_pending_return_items_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_return_items_establishment ON public.pending_return_items USING btree (establishment_id);


--
-- Name: idx_pending_return_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_return_items_product ON public.pending_return_items USING btree (product_id);


--
-- Name: idx_pending_return_items_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_return_items_return ON public.pending_return_items USING btree (return_id);


--
-- Name: idx_pending_returns_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_returns_date ON public.pending_returns USING btree (return_date);


--
-- Name: idx_pending_returns_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_returns_establishment ON public.pending_returns USING btree (establishment_id);


--
-- Name: idx_pending_returns_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_returns_order ON public.pending_returns USING btree (order_id);


--
-- Name: idx_pending_returns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_returns_status ON public.pending_returns USING btree (status);


--
-- Name: idx_product_metadata_brand; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_metadata_brand ON public.product_metadata USING btree (brand);


--
-- Name: idx_product_metadata_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_metadata_category ON public.product_metadata USING btree (category_id);


--
-- Name: idx_product_metadata_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_metadata_product ON public.product_metadata USING btree (product_id);


--
-- Name: idx_register_cash_settings_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_register_cash_settings_establishment ON public.register_cash_settings USING btree (establishment_id);


--
-- Name: idx_retained_earnings_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_retained_earnings_establishment ON public.retained_earnings USING btree (establishment_id);


--
-- Name: idx_roles_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_establishment ON public.roles USING btree (establishment_id);


--
-- Name: idx_schedule_changes_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_changes_period ON public.schedule_changes USING btree (period_id);


--
-- Name: idx_schedule_notifications_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_notifications_employee ON public.schedule_notifications USING btree (employee_id);


--
-- Name: idx_schedule_notifications_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_notifications_period ON public.schedule_notifications USING btree (period_id);


--
-- Name: idx_scheduled_shifts_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_shifts_employee_date ON public.scheduled_shifts USING btree (employee_id, shift_date);


--
-- Name: idx_scheduled_shifts_period_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_shifts_period_date ON public.scheduled_shifts USING btree (period_id, shift_date);


--
-- Name: idx_search_history_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_search_history_timestamp ON public.search_history USING btree (search_timestamp);


--
-- Name: idx_shipment_discrepancies_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_discrepancies_establishment ON public.shipment_discrepancies USING btree (establishment_id);


--
-- Name: idx_shipment_issues_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_issues_item ON public.shipment_issues USING btree (pending_item_id);


--
-- Name: idx_shipment_issues_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_issues_shipment ON public.shipment_issues USING btree (pending_shipment_id);


--
-- Name: idx_shipment_items_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_items_establishment ON public.shipment_items USING btree (establishment_id);


--
-- Name: idx_shipment_scan_log_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_scan_log_item ON public.shipment_scan_log USING btree (pending_item_id);


--
-- Name: idx_shipment_scan_log_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipment_scan_log_shipment ON public.shipment_scan_log USING btree (pending_shipment_id);


--
-- Name: idx_shipments_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipments_establishment ON public.shipments USING btree (establishment_id);


--
-- Name: idx_time_clock_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_clock_establishment ON public.time_clock USING btree (establishment_id);


--
-- Name: idx_transaction_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_items_product ON public.transaction_items USING btree (product_id);


--
-- Name: idx_transaction_items_transaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_items_transaction ON public.transaction_items USING btree (transaction_id);


--
-- Name: idx_transactions_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_employee ON public.transactions USING btree (employee_id);


--
-- Name: idx_transactions_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_establishment ON public.transactions USING btree (establishment_id);


--
-- Name: idx_transactions_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_order_id ON public.transactions USING btree (order_id);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);


--
-- Name: idx_vendors_establishment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_establishment ON public.vendors USING btree (establishment_id);


--
-- Name: idx_verification_sessions_shipment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_sessions_shipment ON public.verification_sessions USING btree (pending_shipment_id);


--
-- Name: approved_shipment_items approved_shipment_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipment_items
    ADD CONSTRAINT approved_shipment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: approved_shipment_items approved_shipment_items_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipment_items
    ADD CONSTRAINT approved_shipment_items_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.employees(employee_id);


--
-- Name: approved_shipment_items approved_shipment_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipment_items
    ADD CONSTRAINT approved_shipment_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.approved_shipments(shipment_id);


--
-- Name: approved_shipments approved_shipments_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipments
    ADD CONSTRAINT approved_shipments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.employees(employee_id);


--
-- Name: approved_shipments approved_shipments_pending_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipments
    ADD CONSTRAINT approved_shipments_pending_shipment_id_fkey FOREIGN KEY (pending_shipment_id) REFERENCES public.pending_shipments(pending_shipment_id);


--
-- Name: approved_shipments approved_shipments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approved_shipments
    ADD CONSTRAINT approved_shipments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id);


--
-- Name: audit_log audit_log_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: audit_log audit_log_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: cash_register_sessions cash_register_sessions_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.employees(employee_id);


--
-- Name: cash_register_sessions cash_register_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: cash_register_sessions cash_register_sessions_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: cash_register_sessions cash_register_sessions_reconciled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_reconciled_by_fkey FOREIGN KEY (reconciled_by) REFERENCES public.employees(employee_id);


--
-- Name: cash_transactions cash_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: cash_transactions cash_transactions_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: cash_transactions cash_transactions_register_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_register_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.cash_register_sessions(register_session_id);


--
-- Name: categories categories_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.categories(category_id);


--
-- Name: chart_of_accounts chart_of_accounts_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: chart_of_accounts chart_of_accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.chart_of_accounts(account_id);


--
-- Name: customer_display_sessions customer_display_sessions_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_display_sessions
    ADD CONSTRAINT customer_display_sessions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: customer_display_sessions customer_display_sessions_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_display_sessions
    ADD CONSTRAINT customer_display_sessions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: customer_display_settings customer_display_settings_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_display_settings
    ADD CONSTRAINT customer_display_settings_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: customers customers_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: daily_cash_counts daily_cash_counts_counted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_cash_counts
    ADD CONSTRAINT daily_cash_counts_counted_by_fkey FOREIGN KEY (counted_by) REFERENCES public.employees(employee_id);


--
-- Name: daily_cash_counts daily_cash_counts_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_cash_counts
    ADD CONSTRAINT daily_cash_counts_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: employee_availability employee_availability_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT employee_availability_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- Name: employee_availability employee_availability_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_availability
    ADD CONSTRAINT employee_availability_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: employee_permission_overrides employee_permission_overrides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permission_overrides
    ADD CONSTRAINT employee_permission_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(employee_id);


--
-- Name: employee_permission_overrides employee_permission_overrides_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permission_overrides
    ADD CONSTRAINT employee_permission_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- Name: employee_permission_overrides employee_permission_overrides_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permission_overrides
    ADD CONSTRAINT employee_permission_overrides_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: employee_permission_overrides employee_permission_overrides_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_permission_overrides
    ADD CONSTRAINT employee_permission_overrides_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(permission_id) ON DELETE CASCADE;


--
-- Name: employee_positions employee_positions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_positions
    ADD CONSTRAINT employee_positions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- Name: employee_schedule employee_schedule_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- Name: employee_schedule employee_schedule_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: employee_schedule employee_schedule_time_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_schedule
    ADD CONSTRAINT employee_schedule_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES public.time_clock(time_entry_id);


--
-- Name: employee_sessions employee_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_sessions
    ADD CONSTRAINT employee_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- Name: employee_sessions employee_sessions_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_sessions
    ADD CONSTRAINT employee_sessions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: employees employees_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: employees employees_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id);


--
-- Name: fiscal_periods fiscal_periods_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.employees(employee_id);


--
-- Name: fiscal_periods fiscal_periods_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: image_identifications image_identifications_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_identifications
    ADD CONSTRAINT image_identifications_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: image_identifications image_identifications_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.image_identifications
    ADD CONSTRAINT image_identifications_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: inventory inventory_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: inventory inventory_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id);


--
-- Name: journal_entries journal_entries_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: journal_entries journal_entries_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: journal_entry_lines journal_entry_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(account_id);


--
-- Name: journal_entry_lines journal_entry_lines_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: journal_entry_lines journal_entry_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(journal_entry_id) ON DELETE CASCADE;


--
-- Name: master_calendar master_calendar_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_calendar
    ADD CONSTRAINT master_calendar_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(employee_id);


--
-- Name: master_calendar master_calendar_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_calendar
    ADD CONSTRAINT master_calendar_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: metadata_extraction_log metadata_extraction_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_extraction_log
    ADD CONSTRAINT metadata_extraction_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id) ON DELETE CASCADE;


--
-- Name: order_items order_items_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);


--
-- Name: orders orders_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: orders orders_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: payment_transactions payment_transactions_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: payments payments_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: payments payments_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(payment_method_id);


--
-- Name: payments payments_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: pending_return_items pending_return_items_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_return_items
    ADD CONSTRAINT pending_return_items_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: pending_return_items pending_return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_return_items
    ADD CONSTRAINT pending_return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(order_item_id);


--
-- Name: pending_return_items pending_return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_return_items
    ADD CONSTRAINT pending_return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: pending_return_items pending_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_return_items
    ADD CONSTRAINT pending_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.pending_returns(return_id) ON DELETE CASCADE;


--
-- Name: pending_returns pending_returns_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns
    ADD CONSTRAINT pending_returns_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.employees(employee_id);


--
-- Name: pending_returns pending_returns_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns
    ADD CONSTRAINT pending_returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);


--
-- Name: pending_returns pending_returns_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns
    ADD CONSTRAINT pending_returns_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: pending_returns pending_returns_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns
    ADD CONSTRAINT pending_returns_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: pending_returns pending_returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_returns
    ADD CONSTRAINT pending_returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id);


--
-- Name: pending_shipment_items pending_shipment_items_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipment_items
    ADD CONSTRAINT pending_shipment_items_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: pending_shipment_items pending_shipment_items_pending_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipment_items
    ADD CONSTRAINT pending_shipment_items_pending_shipment_id_fkey FOREIGN KEY (pending_shipment_id) REFERENCES public.pending_shipments(pending_shipment_id) ON DELETE CASCADE;


--
-- Name: pending_shipment_items pending_shipment_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipment_items
    ADD CONSTRAINT pending_shipment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: pending_shipments pending_shipments_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipments
    ADD CONSTRAINT pending_shipments_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: pending_shipments pending_shipments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_shipments
    ADD CONSTRAINT pending_shipments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id);


--
-- Name: product_metadata product_metadata_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_metadata
    ADD CONSTRAINT product_metadata_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id);


--
-- Name: product_metadata product_metadata_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_metadata
    ADD CONSTRAINT product_metadata_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id) ON DELETE CASCADE;


--
-- Name: receipt_preferences receipt_preferences_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_preferences
    ADD CONSTRAINT receipt_preferences_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: register_cash_settings register_cash_settings_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.register_cash_settings
    ADD CONSTRAINT register_cash_settings_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: retained_earnings retained_earnings_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retained_earnings
    ADD CONSTRAINT retained_earnings_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: retained_earnings retained_earnings_fiscal_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retained_earnings
    ADD CONSTRAINT retained_earnings_fiscal_period_id_fkey FOREIGN KEY (fiscal_period_id) REFERENCES public.fiscal_periods(period_id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(permission_id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(role_id) ON DELETE CASCADE;


--
-- Name: roles roles_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: schedule_changes schedule_changes_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.employees(employee_id);


--
-- Name: schedule_changes schedule_changes_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.schedule_periods(period_id);


--
-- Name: schedule_changes schedule_changes_scheduled_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_changes
    ADD CONSTRAINT schedule_changes_scheduled_shift_id_fkey FOREIGN KEY (scheduled_shift_id) REFERENCES public.scheduled_shifts(scheduled_shift_id);


--
-- Name: schedule_notifications schedule_notifications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_notifications
    ADD CONSTRAINT schedule_notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: schedule_notifications schedule_notifications_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_notifications
    ADD CONSTRAINT schedule_notifications_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.schedule_periods(period_id);


--
-- Name: schedule_periods schedule_periods_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(employee_id);


--
-- Name: schedule_periods schedule_periods_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_periods
    ADD CONSTRAINT schedule_periods_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.employees(employee_id);


--
-- Name: scheduled_shifts scheduled_shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_shifts
    ADD CONSTRAINT scheduled_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: scheduled_shifts scheduled_shifts_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_shifts
    ADD CONSTRAINT scheduled_shifts_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.schedule_periods(period_id) ON DELETE CASCADE;


--
-- Name: search_history search_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_history
    ADD CONSTRAINT search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employees(employee_id);


--
-- Name: shipment_discrepancies shipment_discrepancies_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_discrepancies
    ADD CONSTRAINT shipment_discrepancies_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: shipment_discrepancies shipment_discrepancies_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_discrepancies
    ADD CONSTRAINT shipment_discrepancies_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: shipment_discrepancies shipment_discrepancies_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_discrepancies
    ADD CONSTRAINT shipment_discrepancies_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.employees(employee_id);


--
-- Name: shipment_discrepancies shipment_discrepancies_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_discrepancies
    ADD CONSTRAINT shipment_discrepancies_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.employees(employee_id);


--
-- Name: shipment_discrepancies shipment_discrepancies_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_discrepancies
    ADD CONSTRAINT shipment_discrepancies_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(shipment_id);


--
-- Name: shipment_issues shipment_issues_pending_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_issues
    ADD CONSTRAINT shipment_issues_pending_item_id_fkey FOREIGN KEY (pending_item_id) REFERENCES public.pending_shipment_items(pending_item_id);


--
-- Name: shipment_issues shipment_issues_pending_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_issues
    ADD CONSTRAINT shipment_issues_pending_shipment_id_fkey FOREIGN KEY (pending_shipment_id) REFERENCES public.pending_shipments(pending_shipment_id);


--
-- Name: shipment_issues shipment_issues_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_issues
    ADD CONSTRAINT shipment_issues_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.employees(employee_id);


--
-- Name: shipment_issues shipment_issues_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_issues
    ADD CONSTRAINT shipment_issues_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.employees(employee_id);


--
-- Name: shipment_items shipment_items_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: shipment_items shipment_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: shipment_items shipment_items_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_items
    ADD CONSTRAINT shipment_items_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(shipment_id) ON DELETE CASCADE;


--
-- Name: shipment_scan_log shipment_scan_log_pending_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_scan_log
    ADD CONSTRAINT shipment_scan_log_pending_item_id_fkey FOREIGN KEY (pending_item_id) REFERENCES public.pending_shipment_items(pending_item_id);


--
-- Name: shipment_scan_log shipment_scan_log_pending_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_scan_log
    ADD CONSTRAINT shipment_scan_log_pending_shipment_id_fkey FOREIGN KEY (pending_shipment_id) REFERENCES public.pending_shipments(pending_shipment_id);


--
-- Name: shipment_scan_log shipment_scan_log_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipment_scan_log
    ADD CONSTRAINT shipment_scan_log_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES public.employees(employee_id);


--
-- Name: shipments shipments_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.employees(employee_id);


--
-- Name: shipments shipments_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: shipments shipments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.employees(employee_id);


--
-- Name: shipments shipments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(vendor_id);


--
-- Name: time_clock time_clock_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_clock
    ADD CONSTRAINT time_clock_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id) ON DELETE CASCADE;


--
-- Name: time_clock time_clock_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_clock
    ADD CONSTRAINT time_clock_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: transaction_items transaction_items_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items
    ADD CONSTRAINT transaction_items_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: transaction_items transaction_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items
    ADD CONSTRAINT transaction_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.inventory(product_id);


--
-- Name: transaction_items transaction_items_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_items
    ADD CONSTRAINT transaction_items_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: transactions transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);


--
-- Name: transactions transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: transactions transactions_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: transactions transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE SET NULL;


--
-- Name: vendors vendors_establishment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_establishment_id_fkey FOREIGN KEY (establishment_id) REFERENCES public.establishments(establishment_id) ON DELETE CASCADE;


--
-- Name: verification_sessions verification_sessions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_sessions
    ADD CONSTRAINT verification_sessions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(employee_id);


--
-- Name: verification_sessions verification_sessions_pending_shipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_sessions
    ADD CONSTRAINT verification_sessions_pending_shipment_id_fkey FOREIGN KEY (pending_shipment_id) REFERENCES public.pending_shipments(pending_shipment_id);


--
-- PostgreSQL database dump complete
--

