-- Change default commission rate from 10% to 5% and update all existing vendors
ALTER TABLE vendors ALTER COLUMN commission_rate SET DEFAULT 0.05;

UPDATE vendors SET commission_rate = 0.05 WHERE commission_rate = 0.10;
