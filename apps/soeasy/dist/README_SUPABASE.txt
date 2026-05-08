-- SQL script to create the leads table in Supabase
-- Go to the SQL Editor in Supabase and run this:

CREATE TABLE leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  audience TEXT,
  language TEXT,
  status TEXT DEFAULT 'new',
  notes TEXT,
  monthly_subscription NUMERIC,
  start_date DATE,
  is_deleted BOOLEAN DEFAULT false
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions for now (you can restrict this later)
CREATE POLICY "Allow all actions" ON leads FOR ALL USING (true);
