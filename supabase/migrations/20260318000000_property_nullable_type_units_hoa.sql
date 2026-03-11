-- Make type, Number of Units, and Has HOA nullable on pi_properties.

ALTER TABLE pi_properties ALTER COLUMN type DROP NOT NULL;
ALTER TABLE pi_properties ALTER COLUMN "Number of Units" DROP NOT NULL;
ALTER TABLE pi_properties ALTER COLUMN "Has HOA" DROP NOT NULL;
