const { pool } = require("./db");

const migration = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS psychologists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  specialty VARCHAR(255) DEFAULT '',
  session_rate NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'psychologist')),
  psychologist_id UUID REFERENCES psychologists(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  psychologist_id UUID REFERENCES psychologists(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  psychologist_id UUID REFERENCES psychologists(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial')),
  expected_amount NUMERIC(10,2) DEFAULT 0,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  is_recurring BOOLEAN DEFAULT false,
  recurring_plan_id UUID,
  invoice_id UUID,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  psychologist_id UUID REFERENCES psychologists(id) ON DELETE SET NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time VARCHAR(10) NOT NULL,
  amount NUMERIC(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  psychologist_id UUID REFERENCES psychologists(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  session_ids JSONB DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  date DATE,
  type VARCHAR(10) DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  payment_method VARCHAR(50) DEFAULT '',
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  balance NUMERIC(12,2) DEFAULT 0,
  type VARCHAR(20) DEFAULT 'checking' CHECK (type IN ('checking', 'savings', 'credit_card'))
);

-- Ensure columns exist if tables were created before
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'psychologist' CHECK (role IN ('admin', 'psychologist'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='psychologist_id') THEN
    ALTER TABLE users ADD COLUMN psychologist_id UUID REFERENCES psychologists(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='recurring_plan_id') THEN
    ALTER TABLE sessions ADD COLUMN recurring_plan_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='invoice_id') THEN
    ALTER TABLE sessions ADD COLUMN invoice_id UUID;
  END IF;
END $$;
`;

async function run() {
  console.log("Running migrations...");
  await pool.query(migration);
  console.log("Migrations completed!");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
