-- ============================================================================
-- DATABASE TRIGGERS FOR ACCOUNTING SYSTEM
-- ============================================================================

-- ============================================================================
-- 1. TRANSACTION BALANCE VALIDATION TRIGGER
-- ============================================================================

-- Function to validate transaction balance (debits = credits)
CREATE OR REPLACE FUNCTION validate_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debits DECIMAL(19,4);
    total_credits DECIMAL(19,4);
BEGIN
    -- Calculate totals for the transaction
    SELECT 
        COALESCE(SUM(debit_amount), 0),
        COALESCE(SUM(credit_amount), 0)
    INTO total_debits, total_credits
    FROM transaction_lines
    WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id);
    
    -- Check if debits equal credits (allow small rounding differences)
    IF ABS(total_debits - total_credits) > 0.01 THEN
        RAISE EXCEPTION 'Transaction is not balanced. Debits: %, Credits: %. Difference: %', 
            total_debits, total_credits, ABS(total_debits - total_credits);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger before posting a transaction
CREATE TRIGGER trigger_validate_transaction_balance
    BEFORE INSERT OR UPDATE ON transaction_lines
    FOR EACH ROW
    EXECUTE FUNCTION validate_transaction_balance();

-- Trigger to validate when transaction is marked as posted
CREATE OR REPLACE FUNCTION validate_post_transaction()
RETURNS TRIGGER AS $$
DECLARE
    total_debits DECIMAL(19,4);
    total_credits DECIMAL(19,4);
BEGIN
    IF NEW.is_posted = TRUE AND OLD.is_posted = FALSE THEN
        -- Validate balance before allowing post
        SELECT 
            COALESCE(SUM(debit_amount), 0),
            COALESCE(SUM(credit_amount), 0)
        INTO total_debits, total_credits
        FROM transaction_lines
        WHERE transaction_id = NEW.id;
        
        IF ABS(total_debits - total_credits) > 0.01 THEN
            RAISE EXCEPTION 'Cannot post unbalanced transaction. Debits: %, Credits: %', 
                total_debits, total_credits;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_post_transaction
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    WHEN (NEW.is_posted = TRUE AND OLD.is_posted = FALSE)
    EXECUTE FUNCTION validate_post_transaction();

-- ============================================================================
-- 2. AUTOMATIC TRANSACTION NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS TRIGGER AS $$
DECLARE
    date_prefix VARCHAR(8);
    seq_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    -- Generate date prefix (YYYYMMDD)
    date_prefix := TO_CHAR(NEW.transaction_date, 'YYYYMMDD');
    
    -- Get next sequence number for today
    -- Note: In production, you might want a more sophisticated numbering system
    -- that resets daily or uses a separate sequence per day
    seq_num := nextval('transaction_number_seq');
    
    -- Format: TRX-YYYYMMDD-####
    new_number := 'TRX-' || date_prefix || '-' || LPAD(seq_num::TEXT, 4, '0');
    
    -- Ensure uniqueness (handle collisions)
    WHILE EXISTS (SELECT 1 FROM transactions WHERE transaction_number = new_number) LOOP
        seq_num := nextval('transaction_number_seq');
        new_number := 'TRX-' || date_prefix || '-' || LPAD(seq_num::TEXT, 4, '0');
    END LOOP;
    
    NEW.transaction_number := new_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_transaction_number
    BEFORE INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.transaction_number IS NULL OR NEW.transaction_number = '')
    EXECUTE FUNCTION generate_transaction_number();

-- ============================================================================
-- 3. INVOICE NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    seq_num := nextval('invoice_number_seq');
    new_number := 'INV-' || LPAD(seq_num::TEXT, 6, '0');
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM invoices WHERE invoice_number = new_number) LOOP
        seq_num := nextval('invoice_number_seq');
        new_number := 'INV-' || LPAD(seq_num::TEXT, 6, '0');
    END LOOP;
    
    NEW.invoice_number := new_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
    EXECUTE FUNCTION generate_invoice_number();

-- ============================================================================
-- 4. BILL NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    seq_num := nextval('bill_number_seq');
    new_number := 'BILL-' || LPAD(seq_num::TEXT, 6, '0');
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM bills WHERE bill_number = new_number) LOOP
        seq_num := nextval('bill_number_seq');
        new_number := 'BILL-' || LPAD(seq_num::TEXT, 6, '0');
    END LOOP;
    
    NEW.bill_number := new_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_bill_number
    BEFORE INSERT ON bills
    FOR EACH ROW
    WHEN (NEW.bill_number IS NULL OR NEW.bill_number = '')
    EXECUTE FUNCTION generate_bill_number();

-- ============================================================================
-- 5. PAYMENT NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    seq_num := nextval('payment_number_seq');
    new_number := 'PAY-' || LPAD(seq_num::TEXT, 6, '0');
    
    WHILE EXISTS (SELECT 1 FROM payments WHERE payment_number = new_number) LOOP
        seq_num := nextval('payment_number_seq');
        new_number := 'PAY-' || LPAD(seq_num::TEXT, 6, '0');
    END LOOP;
    
    NEW.payment_number := new_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_payment_number
    BEFORE INSERT ON payments
    FOR EACH ROW
    WHEN (NEW.payment_number IS NULL OR NEW.payment_number = '')
    EXECUTE FUNCTION generate_payment_number();

-- ============================================================================
-- 6. BILL PAYMENT NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_bill_payment_number()
RETURNS TRIGGER AS $$
DECLARE
    seq_num INTEGER;
    new_number VARCHAR(50);
BEGIN
    seq_num := nextval('bill_payment_number_seq');
    new_number := 'BP-' || LPAD(seq_num::TEXT, 6, '0');
    
    WHILE EXISTS (SELECT 1 FROM bill_payments WHERE payment_number = new_number) LOOP
        seq_num := nextval('bill_payment_number_seq');
        new_number := 'BP-' || LPAD(seq_num::TEXT, 6, '0');
    END LOOP;
    
    NEW.payment_number := new_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_bill_payment_number
    BEFORE INSERT ON bill_payments
    FOR EACH ROW
    WHEN (NEW.payment_number IS NULL OR NEW.payment_number = '')
    EXECUTE FUNCTION generate_bill_payment_number();

-- ============================================================================
-- 7. AUDIT TRAIL TRIGGERS
-- ============================================================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    user_id_val INTEGER;
BEGIN
    -- Get user_id from current session or use NULL
    -- In production, you'd get this from session context
    user_id_val := current_setting('app.user_id', TRUE)::INTEGER;
    
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        INSERT INTO audit_log (
            table_name, record_id, action, old_values, user_id, timestamp
        ) VALUES (
            TG_TABLE_NAME, OLD.id, 'delete', old_data, user_id_val, CURRENT_TIMESTAMP
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        INSERT INTO audit_log (
            table_name, record_id, action, old_values, new_values, user_id, timestamp
        ) VALUES (
            TG_TABLE_NAME, NEW.id, 'update', old_data, new_data, user_id_val, CURRENT_TIMESTAMP
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
        INSERT INTO audit_log (
            table_name, record_id, action, new_values, user_id, timestamp
        ) VALUES (
            TG_TABLE_NAME, NEW.id, 'create', new_data, user_id_val, CURRENT_TIMESTAMP
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for major tables
CREATE TRIGGER audit_accounts
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_transactions
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_transaction_lines
    AFTER INSERT OR UPDATE OR DELETE ON transaction_lines
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_customers
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_vendors
    AFTER INSERT OR UPDATE OR DELETE ON vendors
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_bills
    AFTER INSERT OR UPDATE OR DELETE ON bills
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_items
    AFTER INSERT OR UPDATE OR DELETE ON items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- 8. UPDATED_AT TIMESTAMP TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at
    BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. INVOICE/BILL BALANCE CALCULATION TRIGGERS
-- ============================================================================

-- Update invoice balance when payment is applied
CREATE OR REPLACE FUNCTION update_invoice_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_applied DECIMAL(19,4);
    invoice_total DECIMAL(19,4);
BEGIN
    -- Calculate total amount applied to invoice
    SELECT COALESCE(SUM(amount_applied), 0)
    INTO total_applied
    FROM payment_applications
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Get invoice total
    SELECT total_amount
    INTO invoice_total
    FROM invoices
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Update invoice
    UPDATE invoices
    SET 
        amount_paid = total_applied,
        balance_due = invoice_total - total_applied,
        status = CASE
            WHEN total_applied = 0 THEN 'sent'
            WHEN total_applied >= invoice_total THEN 'paid'
            WHEN total_applied > 0 THEN 'partial'
            ELSE status
        END,
        paid_date = CASE WHEN total_applied >= invoice_total THEN CURRENT_DATE ELSE NULL END
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_balance
    AFTER INSERT OR UPDATE OR DELETE ON payment_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_balance();

-- Update bill balance when payment is applied
CREATE OR REPLACE FUNCTION update_bill_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_applied DECIMAL(19,4);
    bill_total DECIMAL(19,4);
BEGIN
    SELECT COALESCE(SUM(amount_applied), 0)
    INTO total_applied
    FROM bill_payment_applications
    WHERE bill_id = COALESCE(NEW.bill_id, OLD.bill_id);
    
    SELECT total_amount
    INTO bill_total
    FROM bills
    WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
    
    UPDATE bills
    SET 
        amount_paid = total_applied,
        balance_due = bill_total - total_applied,
        status = CASE
            WHEN total_applied = 0 THEN 'open'
            WHEN total_applied >= bill_total THEN 'paid'
            WHEN total_applied > 0 THEN 'partial'
            ELSE status
        END,
        paid_date = CASE WHEN total_applied >= bill_total THEN CURRENT_DATE ELSE NULL END
    WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bill_balance
    AFTER INSERT OR UPDATE OR DELETE ON bill_payment_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_balance();

-- ============================================================================
-- 10. INVENTORY QUANTITY UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_inventory_quantity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update quantity_on_hand when inventory transaction is created
    IF TG_OP = 'INSERT' THEN
        UPDATE items
        SET quantity_on_hand = quantity_on_hand + NEW.quantity_change
        WHERE id = NEW.item_id;
        
        -- Update average cost if needed
        IF NEW.transaction_type = 'purchase' THEN
            UPDATE items
            SET average_cost = (
                (average_cost * quantity_on_hand - NEW.quantity_change * NEW.unit_cost + NEW.total_cost) / 
                NULLIF(quantity_on_hand, 0)
            )
            WHERE id = NEW.item_id AND quantity_on_hand > 0;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE items
        SET quantity_on_hand = quantity_on_hand - OLD.quantity_change
        WHERE id = OLD.item_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_quantity
    AFTER INSERT OR DELETE ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_quantity();
