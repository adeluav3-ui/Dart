-- ============================================================
-- 040 – Backfill wallet refund entries for already-cancelled orders
--
-- Orders cancelled before migration 039 was applied have no refund
-- entry in ledger_entries. This inserts the missing rows, skipping
-- any order that already has a refund entry (safe to re-run).
-- ============================================================

INSERT INTO ledger_entries (order_id, party_type, party_id, amount, kind, note)
SELECT
  o.id,
  'customer',
  o.customer_id,
  o.total + COALESCE(o.wallet_applied_kobo, 0),
  'refund',
  'Order cancelled — full refund (backfill)'
FROM orders o
WHERE o.status = 'cancelled'
  AND (o.total > 0 OR o.wallet_applied_kobo > 0)
  AND NOT EXISTS (
    SELECT 1 FROM ledger_entries le
    WHERE le.order_id = o.id
      AND le.kind    = 'refund'
  );
