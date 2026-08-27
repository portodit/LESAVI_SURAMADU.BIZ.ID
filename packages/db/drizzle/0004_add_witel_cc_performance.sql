-- Add witel_cc column to performance_data
ALTER TABLE performance_data ADD COLUMN IF NOT EXISTS witel_cc TEXT;
