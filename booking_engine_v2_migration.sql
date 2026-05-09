-- ============================================================
-- BOOKING ENGINE v2.0 — Full Migration Script
-- Run this in Supabase SQL Editor once the outage is resolved
-- ============================================================

-- 1. TENANT PRODUCTS TABLE
-- Allows Master Admin to activate/deactivate products per tenant
CREATE TABLE IF NOT EXISTS public.tenant_products (
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL, -- 'crm', 'booking', 'website_builder'
  is_active    BOOLEAN DEFAULT false,
  activated_at TIMESTAMP WITH TIME ZONE,
  activated_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (tenant_id, product_slug)
);

-- 2. CREATE APPOINTMENTS TABLE (if not exists)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, cancelled, completed, no_show
    notes TEXT,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BOOKING SETTINGS TABLE
-- One row per tenant — stores all booking configuration
CREATE TABLE IF NOT EXISTS public.booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- ---- Time Configuration ----
  slot_duration_minutes  INTEGER DEFAULT 60  CHECK (slot_duration_minutes > 0),
  buffer_minutes         INTEGER DEFAULT 15  CHECK (buffer_minutes >= 0),
  max_appointments_per_day INTEGER DEFAULT 8 CHECK (max_appointments_per_day > 0),
  cancellation_hours     INTEGER DEFAULT 24  CHECK (cancellation_hours >= 0),

  -- ---- Working Hours (per day) ----
  working_hours JSONB DEFAULT '{
    "mon": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "tue": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "wed": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "thu": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "fri": {"enabled": true,  "start": "09:00", "end": "17:00"},
    "sat": {"enabled": false, "start": "10:00", "end": "14:00"},
    "sun": {"enabled": false, "start": "00:00", "end": "00:00"}
  }'::jsonb,

  -- ---- Custom Fields for Step 1 of the funnel ----
  custom_fields JSONB DEFAULT '[]'::jsonb,

  -- ---- Notification Settings ----
  notify_email_on_booking  BOOLEAN DEFAULT true,
  notify_sms_on_booking    BOOLEAN DEFAULT false,
  notify_reminder_hours    INTEGER DEFAULT 24,
  notification_email       TEXT,
  notification_phone       TEXT,

  -- SendGrid
  sendgrid_api_key         TEXT,
  sendgrid_from_email      TEXT,
  sendgrid_from_name       TEXT,

  -- Twilio
  twilio_account_sid       TEXT,
  twilio_auth_token        TEXT,
  twilio_from_number       TEXT,

  -- ---- Branding ----
  accent_color TEXT DEFAULT '#ff8d01',
  welcome_message TEXT DEFAULT 'Κλείστε ένα δωρεάν ραντεβού',
  success_message TEXT DEFAULT 'Το ραντεβού σας κλείστηκε επιτυχώς!',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ALTER LEADS TABLE
-- Add booking_status for the multi-step funnel
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'new'
    CHECK (booking_status IN ('new', 'partial', 'booked', 'cancelled', 'completed', 'no_show')),
  ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id);

-- 5. SEED: Enable 'crm' product for all existing tenants
INSERT INTO public.tenant_products (tenant_id, product_slug, is_active, activated_at)
SELECT id, 'crm', true, NOW()
FROM public.tenants
ON CONFLICT (tenant_id, product_slug) DO NOTHING;

-- 6. SEED: Default booking_settings for SoEasy tenant
INSERT INTO public.booking_settings (
  tenant_id,
  custom_fields,
  notification_email,
  notify_email_on_booking
)
SELECT
  t.id,
  '[
    {"id":"audience","label":"Για ποιον είναι","type":"select","options":["Παιδί","Ενήλικας"],"required":true},
    {"id":"language","label":"Γλώσσα ενδιαφέροντος","type":"select","options":["Αγγλικά","Γαλλικά","Γερμανικά","Ισπανικά","Ιταλικά","Κινέζικα"],"required":false}
  ]'::jsonb,
  'info@soeasyperisteriou.gr',
  true
FROM public.tenants t
WHERE t.slug = 'soeasy'
ON CONFLICT (tenant_id) DO NOTHING;

-- 7. RLS POLICIES for new tables
ALTER TABLE public.tenant_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Super admin sees everything
CREATE POLICY "super_admin_all_tenant_products" ON public.tenant_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Tenant user sees only their own booking_settings
CREATE POLICY "tenant_own_booking_settings" ON public.booking_settings
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Tenant user sees only their own appointments
CREATE POLICY "tenant_own_appointments" ON public.appointments
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Anon can READ booking_settings (needed for the public landing page funnel)
CREATE POLICY "anon_read_booking_settings" ON public.booking_settings
  FOR SELECT USING (true);

-- Anon can INSERT appointments (needed for booking on landing page)
CREATE POLICY "anon_insert_appointments" ON public.appointments
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.tenant_products IS 'Tracks which products are active per tenant, controlled by Master Admin';
COMMENT ON TABLE public.booking_settings IS 'Per-tenant booking calendar configuration including slots, hours, custom fields and notifications';
COMMENT ON TABLE public.appointments IS 'Booking appointments for leads per tenant';
