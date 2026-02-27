-- Card definitions per service: JSON array of StateCardMapping[]
-- Allows Studio to override the static card registry on a per-service basis.
ALTER TABLE services ADD COLUMN card_definitions_json TEXT;
