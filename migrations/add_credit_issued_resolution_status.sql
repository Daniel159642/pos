-- Allow resolution_status 'credit_issued' on shipment_discrepancies for vendor credit accounting.
-- Run this if your shipment_discrepancies has CHECK(resolution_status IN ('reported', 'investigating', 'resolved', 'written_off')).
ALTER TABLE shipment_discrepancies
  DROP CONSTRAINT IF EXISTS shipment_discrepancies_resolution_status_check;
ALTER TABLE shipment_discrepancies
  ADD CONSTRAINT shipment_discrepancies_resolution_status_check
  CHECK (resolution_status IN ('reported', 'investigating', 'resolved', 'written_off', 'credit_issued'));
