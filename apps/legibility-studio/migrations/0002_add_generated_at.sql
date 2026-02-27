-- Add generated_at and interaction_type columns to services table
ALTER TABLE services ADD COLUMN generated_at TEXT;
ALTER TABLE services ADD COLUMN interaction_type TEXT;
