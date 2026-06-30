-- Enable RLS on tables
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;

-- Grant base permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON organisations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON screens TO authenticated;

-- Allow anonymous users to read screens (for TV player)
GRANT SELECT ON screens TO anon;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own organisation" ON organisations;
DROP POLICY IF EXISTS "Users can update their own organisation" ON organisations;
DROP POLICY IF EXISTS "Users can read screens in their organisation" ON screens;
DROP POLICY IF EXISTS "Users can create screens in their organisation" ON screens;
DROP POLICY IF EXISTS "Users can update screens in their organisation" ON screens;
DROP POLICY IF EXISTS "Users can delete screens in their organisation" ON screens;
DROP POLICY IF EXISTS "Anonymous users can read screens by PIN" ON screens;

-- Organisations RLS: Users can only read their own organisation
CREATE POLICY "Users can read their own organisation"
    ON organisations FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own organisation"
    ON organisations FOR UPDATE
    USING (auth.uid() = owner_id);

-- Screens RLS: Users can only access screens in their organisation
CREATE POLICY "Users can read screens in their organisation"
    ON screens FOR SELECT
    USING (
        org_id IN (
            SELECT id FROM organisations WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create screens in their organisation"
    ON screens FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT id FROM organisations WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update screens in their organisation"
    ON screens FOR UPDATE
    USING (
        org_id IN (
            SELECT id FROM organisations WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete screens in their organisation"
    ON screens FOR DELETE
    USING (
        org_id IN (
            SELECT id FROM organisations WHERE owner_id = auth.uid()
        )
    );

-- Anonymous access: Anyone can read screens by PIN (for TV player)
CREATE POLICY "Anonymous users can read screens by PIN"
    ON screens FOR SELECT
    USING (true);
