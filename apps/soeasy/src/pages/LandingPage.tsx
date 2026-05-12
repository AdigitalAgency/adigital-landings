import { useEffect, useRef, useState } from 'react';
import { LanguageAccordion } from '../components/LanguageAccordion';
import { StickyCTA } from '../components/StickyCTA';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Header } from '../components/Header';
import { ConversionFunnel } from '@adigital/shared';
import { supabase } from '../utils/supabaseClient';
import { notificationService } from '../utils/notificationService';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

// SoEasy Tenant Config
const TENANT_ID  = '919d700e-436d-4950-84c4-754f9a0c78a0';
const AGENCY_ID  = '1e37039a-6379-40da-b788-b4b1a6ccf31a';

const SOEASY_SETTINGS = {
  slot_duration_minutes: 60,
  buffer_minutes: 0,
  working_hours: {
    mon: { enabled: true, start: '09:00', end: '21:00' },
    tue: { enabled: true, start: '09:00', end: '21:00' },
    wed: { enabled: true, start: '09:00', end: '21:00' },
    thu: { enabled: true, start: '09:00', end: '21:00' },
    fri: { enabled: true, start: '09:00', end: '21:00' },
    sat: { enabled: false, start: '10:00', end: '14:00' },
    sun: { enabled: false, start: '00:00', end: '00:00' },
  },
  custom_fields: [
    { id: 'audience', label: 'Για ποιον είναι', type: 'select' as const, options: ['Παιδί', 'Ενήλικας'], required: true },
    { id: 'language', label: 'Γλώσσα ενδιαφέροντος', type: 'select' as const, options: ['Αγγλικά', 'Γαλλικά', 'Γερμανικά', 'Ισπανικά', 'Ιταλικά', 'Κινέζικα'], required: false },
  ]
};

export default function LandingPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const [prefilled, setPrefilled] = useState({ language: '', audience: '' });
  const [dbSettings, setDbSettings] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .maybeSingle();
      if (data) setDbSettings(data);
    }
    loadSettings();
  }, []);

  const scrollToForm = (language?: string, audience?: string) => {
    if (language || audience) {
      setPrefilled({ language: language || '', audience: audience || '' });
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  async function getGoogleBusyTimes(date: Date) {
    try {
      const timeMin = new Date(date);
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(date);
      timeMax.setHours(23, 59, 59, 999);

      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: {
          action: 'get_busy',
          tenant_id: TENANT_ID,
          time_min: timeMin.toISOString(),
          time_max: timeMax.toISOString()
        }
      });
      if (error) return [];
      const calendars = data?.calendars || {};
      return Object.values(calendars).flatMap((cal: any) => cal.busy || []);
    } catch (err) {
      return [];
    }
  }

  async function handleComplete(leadId: string | null, date: Date, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);
    const slotDuration = dbSettings?.slot_duration_minutes ?? SOEASY_SETTINGS.slot_duration_minutes;

    try {
      const apptId = crypto.randomUUID();
      await supabase.from('appointments').insert([{
        id: apptId, tenant_id: TENANT_ID, agency_id: AGENCY_ID, lead_id: leadId,
        scheduled_at: scheduledAt.toISOString(), duration_minutes: slotDuration, status: 'pending',
      }]);

      if (leadId) {
        await supabase.rpc('confirm_lead_booking', { p_lead_id: leadId, p_appt_id: apptId });
      }

      // Google Sync
      const endAt = new Date(scheduledAt.getTime() + slotDuration * 60000);
      await supabase.functions.invoke('sync-google-calendar', {
        body: {
          action: 'create_event',
          tenant_id: TENANT_ID,
          event_data: {
            summary: `Ραντεβού: ${formData.name || 'Πελάτης'}`,
            description: `Γλώσσα: ${formData.language || 'N/A'}\nAudience: ${formData.audience || 'N/A'}\nΤηλ: ${formData.phone || 'N/A'}`,
            start: scheduledAt.toISOString(), end: endAt.toISOString(), email: formData.email
          }
        }
      });

      // Notifications
      const dateStr = scheduledAt.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = scheduledAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
      notificationService.sendEmail(TENANT_ID, 'admin@soeasy.gr', 'Νέο Ραντεβού!', `Έχετε ένα νέο ραντεβού για τις ${dateStr} ${timeStr}.`);
      if (formData.email) notificationService.sendEmail(TENANT_ID, formData.email, 'Επιβεβαίωση Ραντεβού - SoEasy', `Το ραντεβού σας επιβεβαιώθηκε για τις ${dateStr} ${timeStr}.`);
      if (formData.phone) notificationService.sendSMS(TENANT_ID, formData.phone, `SoEasy: Το ραντεβού σας επιβεβαιώθηκε για τις ${dateStr} ${timeStr}.`);

    } catch (err) {
      console.error('Booking error:', err);
    }
    setTimeout(() => navigate('/thank-you'), 800);
  }

  const getAvailableSlots = async (date: Date) => {
    const dayKey = format(date, 'eee', { locale: enUS }).toLowerCase() as keyof typeof SOEASY_SETTINGS.working_hours;
    const dayConfig = dbSettings?.working_hours?.[dayKey] || SOEASY_SETTINGS.working_hours[dayKey];
    if (!dayConfig || !dayConfig.enabled) return [];

    const slots = [];
    let current = new Date(date);
    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);
    current.setHours(startH, startM, 0, 0);
    const end = new Date(date);
    end.setHours(endH, endM, 0, 0);

    const slotDuration = dbSettings?.slot_duration_minutes ?? SOEASY_SETTINGS.slot_duration_minutes;
    const buffer = dbSettings?.buffer_minutes ?? SOEASY_SETTINGS.buffer_minutes;

    const [dbBusy, googleBusy] = await Promise.all([
      supabase.from('appointments').select('scheduled_at').eq('tenant_id', TENANT_ID).gte('scheduled_at', current.toISOString()).lte('scheduled_at', end.toISOString()).neq('status', 'cancelled'),
      getGoogleBusyTimes(date)
    ]);

    const takenDbSlots = (dbBusy.data || []).map(a => format(new Date(a.scheduled_at), 'HH:mm'));

    while (current < end) {
      const timeLabel = format(current, 'HH:mm');
      const slotEnd = new Date(current.getTime() + slotDuration * 60000);
      const isGoogleBusy = googleBusy.some((busy: any) => (current < new Date(busy.end) && slotEnd > new Date(busy.start)));
      if (!takenDbSlots.includes(timeLabel) && !isGoogleBusy) slots.push(timeLabel);
      current = new Date(current.getTime() + (slotDuration + buffer) * 60000);
    }
    return slots;
  };

  const adultLanguages = [
    { name: 'Εξειδικευμένα Πτυχία για ενήλικες', flag: '🎓' }, { name: 'Αγγλικά', flag: '🇬🇧' }, { name: 'Γαλλικά', flag: '🇫🇷' }, { name: 'Γερμανικά', flag: '🇩🇪' }, { name: 'Ισπανικά', flag: '🇪🇸' }, { name: 'Ιταλικά', flag: '🇮🇹' }, { name: 'Κινέζικα', flag: '🇨🇳' },
  ];
  const childLanguages = [
    { name: 'Αγγλικά', flag: '🇬🇧' }, { name: 'Γαλλικά', flag: '🇫🇷' }, { name: 'Γερμανικά', flag: '🇩🇪' }, { name: 'Ισπανικά', flag: '🇪🇸' }, { name: 'Ιταλικά', flag: '🇮🇹' }, { name: 'Κινέζικα', flag: '🇨🇳' },
  ];

  const funnelSettings = {
    ...SOEASY_SETTINGS,
    ...(dbSettings ? { slot_duration_minutes: dbSettings.slot_duration_minutes, buffer_minutes: dbSettings.buffer_minutes, working_hours: dbSettings.working_hours } : {}),
    custom_fields: SOEASY_SETTINGS.custom_fields.map(f => ({
      ...f,
      defaultValue: f.id === 'audience' ? prefilled.audience : f.id === 'language' ? prefilled.language : '',
    })),
  };

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <Header onCTAClick={() => scrollToForm()} />
      <StickyCTA />

      {/* SECTION 1 - HERO */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-br from-[#FAF7F3] to-[#E8E0D5]">
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-in fade-in duration-700">
              <h1 className="text-4xl md:text-6xl font-bold text-[#2B2520] mb-6 leading-tight">
                Μαθήματα Ξένων Γλωσσών στο Περιστέρι για Παιδιά & Ενήλικες
              </h1>
              <p className="text-lg md:text-xl opacity-80 mb-8">
                Αγγλικά, Ισπανικά, Γερμανικά, Ιταλικά με έμπειρους καθηγητές και αποδεδειγμένα αποτελέσματα
              </p>
              <button onClick={() => scrollToForm()} className="px-8 py-4 bg-[#ff8d01] text-white rounded-lg shadow-lg hover:scale-105 transition-all font-bold">
                Κλείσε Δωρεάν Ραντεβού
              </button>
            </div>
            <div className="hidden lg:block animate-in zoom-in duration-700">
              <img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800" alt="Students" className="rounded-3xl shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 - SEGMENTATION */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl shadow-lg border bg-gradient-to-br from-white to-[#FAF7F3]">
              <div className="text-4xl mb-4">📚</div>
              <h2 className="text-3xl font-bold mb-4">Μαθήματα για Παιδιά</h2>
              <ul className="space-y-3 mb-6 opacity-80">
                <li>• Αγγλικά από μικρή ηλικία</li>
                <li>• Προετοιμασία για πιστοποιήσεις</li>
                <li>• Διαδραστική εκμάθηση</li>
              </ul>
              <button onClick={() => scrollToForm(undefined, 'Παιδί')} className="px-6 py-3 bg-[#feea00] rounded-lg font-bold">Ενδιαφέρομαι για παιδί</button>
            </div>
            <div className="p-8 rounded-2xl shadow-lg border bg-gradient-to-br from-white to-[#E8E0D5]">
              <div className="text-4xl mb-4">🎓</div>
              <h2 className="text-3xl font-bold mb-4">Μαθήματα για Ενήλικες</h2>
              <ul className="space-y-3 mb-6 opacity-80">
                <li>• Ισπανικά, Γερμανικά, Ιταλικά</li>
                <li>• Για επαγγελματικούς λόγους</li>
                <li>• Ευέλικτα προγράμματα</li>
              </ul>
              <button onClick={() => scrollToForm(undefined, 'Ενήλικας')} className="px-6 py-3 bg-[#ff8d01] text-white rounded-lg font-bold">Ενδιαφέρομαι ως ενήλικας</button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 - WHY US */}
      <section className="py-20 bg-[#feea00]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-12">Γιατί να επιλέξετε SoEasy Περιστερίου</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[{ icon: '👥', text: 'Ολιγομελή τμήματα' }, { icon: '⭐', text: 'Έμπειροι καθηγητές' }, { icon: '🏢', text: 'Σύγχρονες εγκαταστάσεις' }, { icon: '📈', text: 'Υψηλά ποσοστά επιτυχίας' }].map((item, idx) => (
              <div key={idx} className="bg-white/20 backdrop-blur-sm p-6 rounded-xl border border-white/30">
                <div className="text-5xl mb-4">{item.icon}</div>
                <p className="font-bold">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 - EXPERIENCE GALLERY */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">Η εμπειρία στο SoEasy</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <ImageWithFallback src="https://images.unsplash.com/photo-1758270704524-596810e891b5" alt="Class" className="rounded-xl shadow-lg aspect-video object-cover" />
            <ImageWithFallback src="https://images.unsplash.com/photo-1746862932830-f9f695774594" alt="Rooms" className="rounded-xl shadow-lg aspect-video object-cover" />
            <ImageWithFallback src="https://images.unsplash.com/photo-1758270704021-361c165d68fd" alt="Learning" className="rounded-xl shadow-lg aspect-video object-cover" />
          </div>
        </div>
      </section>

      {/* SECTION 5 - PROCESS */}
      <section className="py-20 bg-gradient-to-br from-[#FAF7F3] to-[#D4A574]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-16">Πώς ξεκινάς</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {['Συμπληρώνεις τη φόρμα', 'Σε καλούμε εντός 24 ωρών', 'Κλείνουμε ραντεβού', 'Ξεκινάς μαθήματα', 'Παραλαμβάνεις το Πτυχίο σου'].map((text, idx) => (
              <div key={idx}>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#ff8d01] flex items-center justify-center text-2xl font-bold text-white shadow-lg">{idx + 1}</div>
                <p className="font-medium">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 - LANGUAGES */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-12">Οι Γλώσσες που Προσφέρουμε</h2>
          <div className="grid lg:grid-cols-2 gap-8">
            <LanguageAccordion audience="adult" languages={adultLanguages} onCTAClick={scrollToForm} />
            <LanguageAccordion audience="child" languages={childLanguages} onCTAClick={scrollToForm} />
          </div>
        </div>
      </section>

      {/* SECTION 7 - FUNNEL */}
      <section className="py-20 bg-white" ref={formRef}>
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-4">Κλείστε Δωρεάν Ραντεβού</h2>
          <p className="text-center opacity-60 mb-12">Συμπληρώστε τη φόρμα και επιλέξτε την ώρα που σας εξυπηρετεί</p>
          <ConversionFunnel
            tenantId={TENANT_ID} agencyId={AGENCY_ID} settings={funnelSettings}
            onStepChange={(step, data) => data && setFormData((p: any) => ({ ...p, ...data }))}
            getAvailableSlots={getAvailableSlots} onComplete={handleComplete}
          />
        </div>
      </section>

      <footer className="py-12 bg-[#1A1814] text-white/40 text-center text-sm border-t border-white/5">
        <p>© 2026 SoEasy Περιστερίου - Μαθήματα Ξένων Γλωσσών</p>
        <p className="mt-2 text-xs">Designed & Developed by ADIGITAL Marketing Agency</p>
      </footer>
    </div>
  );
}
