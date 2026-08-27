-- Add witel_am and witel_cc columns to sales_funnel
ALTER TABLE sales_funnel ADD COLUMN IF NOT EXISTS witel_am TEXT;
ALTER TABLE sales_funnel ADD COLUMN IF NOT EXISTS witel_cc TEXT;
