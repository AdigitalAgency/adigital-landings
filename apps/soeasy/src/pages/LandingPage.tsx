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
    { id: 'audience', label: 'Για ποιον', type: 'select', options: ['Παιδί', 'Ενήλικας'], required: true },
    { id: 'language', label: 'Γλώσσα', type: 'select', options: [], required: true },
  ],
};

export default function LandingPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const [dbSettings, setDbSettings] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ name: '', phone: '', audience: '', language: '' });
  const [prefilled, setPrefilled] = useState({ language: '', audience: '' });

  useEffect(() => {
    fetchDbSettings();
  }, []);

  async function fetchDbSettings() {
    const { data } = await supabase
      .from('booking_settings')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();
    if (data) setDbSettings(data);
  }

  const scrollToForm = (language?: string, audience?: string) => {
    let mappedAudience = audience;
    if (audience === 'adult') mappedAudience = 'Ενήλικας';
    if (audience === 'child') mappedAudience = 'Παιδί';

    if (language || mappedAudience) {
      setPrefilled({ 
        language: language || '', 
        audience: mappedAudience || '' 
      });
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // CRM Integration: Saves lead as soon as step 1 is completed
  async function handlePartialCapture(data: any) {
    try {
      console.log('Capturing lead:', data);
      setFormData(data);
      const leadId = crypto.randomUUID();
      const { error } = await supabase.from('leads').insert([{
        id: leadId,
        tenant_id: TENANT_ID,
        agency_id: AGENCY_ID,
        name: data.name,
        phone: data.phone,
        status: 'new',
        source: 'Landing Page',
        metadata: { ...data, captured_at: new Date().toISOString() }
      }]);
      
      if (error) throw error;
      return leadId;
    } catch (err) {
      console.error('Partial capture failed:', err);
      return null;
    }
  }

  // CRM Integration: Fetches booked slots for the calendar
  async function getBookedSlots(date: Date) {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);

    const { data } = await supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('tenant_id', TENANT_ID)
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString())
      .neq('status', 'cancelled');

    return (data || []).map(a => format(new Date(a.scheduled_at), 'HH:mm'));
  }

  // Final Booking: saves appointment and notifies
  async function handleComplete(leadId: string | null, date: Date, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const slotDuration = dbSettings?.slot_duration_minutes ?? SOEASY_SETTINGS.slot_duration_minutes;

    try {
      const apptId = crypto.randomUUID();
      await supabase.from('appointments').insert([{
        id: apptId,
        tenant_id: TENANT_ID,
        agency_id: AGENCY_ID,
        lead_id: leadId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: slotDuration,
        status: 'appointment',
      }]);

      if (leadId) {
        await supabase.rpc('confirm_lead_booking', { p_lead_id: leadId, p_appt_id: apptId });
      }

      // Notification Logic
      const dateStr = scheduledAt.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = scheduledAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

      notificationService.sendEmail(TENANT_ID, 'admin@soeasy.gr', 'Νέο Ραντεβού!', `Έχετε ένα νέο ραντεβού για τις ${dateStr} ${timeStr}.`);
      
      setTimeout(() => navigate('/thank-you'), 800);
    } catch (err) {
      console.error('Booking failed:', err);
    }
  }

  const commonLanguages = [
    { name: 'Αγγλικά', flag: '🇬🇧' }, { name: 'Γαλλικά', flag: '🇫🇷' },
    { name: 'Γερμανικά', flag: '🇩🇪' }, { name: 'Ισπανικά', flag: '🇪🇸' },
    { name: 'Ιταλικά', flag: '🇮🇹' }, { name: 'Κινέζικα', flag: '🇨🇳' },
    { name: 'Ρωσικά', flag: '🇷🇺' }, { name: 'Αραβικά', flag: '🇸🇦' },
    { name: 'Τουρκικά', flag: '🇹🇷' },
  ];
  const adultLanguages = [...commonLanguages, { name: 'Εξειδικευμένα Πτυχία για ενήλικες', flag: '🎓' }];
  const childLanguages  = [...commonLanguages, { name: 'Μελέτη για παιδιά', flag: '📖' }];

  const dynamicLanguageOptions = [
    'Αγγλικά', 'Γαλλικά', 'Γερμανικά', 'Ισπανικά', 'Ιταλικά', 'Κινέζικα', 'Ρωσικά', 'Αραβικά', 'Τουρκικά',
    ...(prefilled.audience === 'Παιδί' ? ['Μελέτη για παιδιά'] : ['Εξειδικευμένα Πτυχία για ενήλικες']),
  ];

  const funnelSettings = {
    ...SOEASY_SETTINGS,
    ...(dbSettings ? {
      slot_duration_minutes: dbSettings.slot_duration_minutes,
      buffer_minutes: dbSettings.buffer_minutes,
      working_hours: dbSettings.working_hours,
    } : {}),
    custom_fields: SOEASY_SETTINGS.custom_fields.map(f => ({
      ...f,
      options: f.id === 'language' ? dynamicLanguageOptions : f.options,
      defaultValue: f.id === 'audience' ? prefilled.audience : f.id === 'language' ? prefilled.language : '',
    })),
  };

  return (
    <div className=\"min-h-screen bg-white\" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <Header onCTAClick={() => scrollToForm()} />
      <StickyCTA />

      {/* SECTION 1 - HERO */}
      <section className=\"relative py-20 md:py-32 overflow-hidden bg-gradient-to-br from-[#FAF7F3] to-[#E8E0D5]\">
        <div className=\"max-w-[1200px] mx-auto px-6 relative z-10\">
          <div className=\"grid lg:grid-cols-2 gap-12 items-center\">
            <div>
              <h1 className=\"text-4xl md:text-6xl font-extrabold text-[#2B2520] mb-6 leading-tight\">
                Μαθήματα Ξένων Γλωσσών στο Περιστέρι για Παιδιά & Ενήλικες
              </h1>
              <p className=\"text-xl text-[#2B2520]/70 mb-8\">
                Αγγλικά, Ισπανικά, Γερμανικά, Ιταλικά με έμπειρους καθηγητές και αποδεδειγμένα αποτελέσματα.
              </p>
              <button 
                onClick={() => scrollToForm()}
                className=\"px-8 py-4 bg-[#ff8d01] text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all\"
              >
                Κλείσε Δωρεάν Ραντεβού
              </button>
            </div>
            <div className=\"relative\">
              <div className=\"bg-white/40 backdrop-blur-md p-2 rounded-3xl border border-white/20 shadow-2xl\">
                <ConversionFunnel
                  tenantId={TENANT_ID}
                  agencyId={AGENCY_ID}
                  settings={funnelSettings}
                  onPartialCapture={handlePartialCapture}
                  onComplete={handleComplete}
                  onDateSelect={getBookedSlots}
                  onFieldChange={(id, val) => {
                    if (id === 'audience' || id === 'language') {
                      setPrefilled(prev => ({ ...prev, [id]: val }));
                    }
                  }}
                  accentColor=\"#ff8d01\"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 - SEGMENTATION */}
      <section className=\"py-24 bg-white\">
        <div className=\"max-w-[1200px] mx-auto px-6\">
          <div className=\"grid md:grid-cols-2 gap-8\">
            <div className=\"p-8 rounded-3xl border bg-gradient-to-br from-white to-[#FAF7F3] shadow-lg\">
              <div className=\"text-5xl mb-4\">📚</div>
              <h2 className=\"text-3xl font-bold mb-4\">Μαθήματα για Παιδιά</h2>
              <ul className=\"space-y-3 mb-8 text-[#2B2520]/70\">
                <li className=\"flex items-center gap-2\"><span>•</span> Αγγλικά από μικρή ηλικία</li>
                <li className=\"flex items-center gap-2\"><span>•</span> Προετοιμασία για πιστοποιήσεις</li>
                <li className=\"flex items-center gap-2\"><span>•</span> Διαδραστική εκμάθηση</li>
              </ul>
              <button 
                onClick={() => scrollToForm(undefined, 'child')}
                className=\"w-full py-4 bg-[#feea00] rounded-xl font-bold hover:shadow-md transition-all\"
              >
                Ενδιαφέρομαι για παιδί
              </button>
            </div>
            <div className=\"p-8 rounded-3xl border bg-gradient-to-br from-white to-[#E8E0D5] shadow-lg\">
              <div className=\"text-5xl mb-4\">🎓</div>
              <h2 className=\"text-3xl font-bold mb-4\">Μαθήματα για Ενήλικες</h2>
              <ul className=\"space-y-3 mb-8 text-[#2B2520]/70\">
                <li className=\"flex items-center gap-2\"><span>•</span> Ισπανικά, Γερμανικά, Ιταλικά</li>
                <li className=\"flex items-center gap-2\"><span>•</span> Για επαγγελματικούς λόγους</li>
                <li className=\"flex items-center gap-2\"><span>•</span> Ευέλικτα προγράμματα</li>
              </ul>
              <button 
                onClick={() => scrollToForm(undefined, 'adult')}
                className=\"w-full py-4 bg-[#ff8d01] text-white rounded-xl font-bold hover:shadow-md transition-all\"
              >
                Ενδιαφέρομαι ως ενήλικας
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 - WHY US */}
      <section id=\"why-us\" className=\"py-24 bg-[#feea00]\">
        <div className=\"max-w-[1200px] mx-auto px-6\">
          <h2 className=\"text-4xl md:text-5xl font-bold text-center mb-16 text-[#2B2520]\">
            Γιατί να επιλέξετε SoEasy Περιστερίου
          </h2>
          <div className=\"grid sm:grid-cols-2 lg:grid-cols-4 gap-8\">
            {[
              { icon: '👥', text: 'Ολιγομελή τμήματα (4–8 άτομα)' },
              { icon: '⭐', text: 'Έμπειροι καθηγητές' },
              { icon: '🏢', text: 'Σύγχρονες εγκαταστάσεις' },
              { icon: '📈', text: 'Υψηλά ποσοστά επιτυχίας' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/20 backdrop-blur-md p-8 rounded-2xl border border-white/30 text-center">
                <div className="text-5xl mb-4">{item.icon}</div>
                <p className="font-bold text-lg">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 - TESTIMONIALS */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-[#2B2520]">
            Τι λένε οι μαθητές και οι γονείς
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Μαρία Π.',
                text: 'Η κόρη μου πήρε το Lower με άριστα! Οι καθηγητές είναι εξαιρετικοί και το περιβάλλον πολύ φιλικό.',
                achievement: 'Lower - Άριστα',
              },
              {
                name: 'Γιώργος Κ.',
                text: 'Τέλεια προετοιμασία για τα γερμανικά! Εξαιρετικό επίπεδο διδασκαλίας και πολύ καλή οργάνωση.',
                achievement: 'Goethe B2',
              },
              {
                name: 'Ελένη Δ.',
                text: 'Ευέλικτα προγράμματα που ταιριάζουν στο πρόγραμμά μου. Έμαθα ισπανικά σε χρόνο ρεκόρ!',
                achievement: 'DELE B1',
              },
            ].map((testimonial, idx) => (
              <div key={idx} className="bg-[#FAF7F3] p-8 rounded-2xl shadow-sm border border-[#E8E0D5]">
                <div className="mb-4 text-[#ff8d01] text-4xl">"</div>
                <p className="mb-6 text-[#2B2520]/80 italic leading-relaxed">{testimonial.text}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#2B2520]">{testimonial.name}</p>
                    <p className="text-sm text-[#ff8d01] font-medium">{testimonial.achievement}</p>
                  </div>
                  <div className="text-xl">⭐⭐⭐⭐⭐</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 - EXPERIENCE GALLERY */}
      <section className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16">Η εμπειρία στο SoEasy</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <ImageWithFallback src="https://images.unsplash.com/photo-1758270704524-596810e891b5" alt="Class" className="rounded-2xl shadow-xl aspect-square object-cover" />
            <ImageWithFallback src="https://images.unsplash.com/photo-1746862932830-f9f695774594" alt="Rooms" className="rounded-2xl shadow-xl aspect-square object-cover" />
            <ImageWithFallback src="https://images.unsplash.com/photo-1758270704021-361c165d68fd" alt="Learning" className="rounded-2xl shadow-xl aspect-square object-cover" />
          </div>
        </div>
      </section>

      {/* SECTION 5 - PROCESS */}
      <section id=\"process\" className=\"py-24 bg-gradient-to-br from-[#FAF7F3] to-[#D4A574]\">
        <div className=\"max-w-[1200px] mx-auto px-6\">
          <h2 className=\"text-4xl font-bold text-center mb-20 text-[#2B2520]\">Πώς ξεκινάς</h2>
          <div className=\"grid sm:grid-cols-2 lg:grid-cols-5 gap-8\">
            {[
              { step: '1', text: 'Συμπληρώνεις τη φόρμα' },
              { step: '2', text: 'Σε καλούμε εντός 24 ωρών' },
              { step: '3', text: 'Κλείνουμε ραντεβού' },
              { step: '4', text: 'Ξεκινάς μαθήματα' },
              { step: '5', text: 'Παραλαμβάνεις το Πτυχίο σου' },
            ].map((item, idx) => (
              <div key={idx} className=\"text-center\">
                <div className=\"w-16 h-16 mx-auto mb-6 rounded-full bg-[#ff8d01] flex items-center justify-center text-2xl font-bold text-white shadow-xl\">
                  {item.step}
                </div>
                <p className=\"font-bold text-[#2B2520]\">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 - LANGUAGES */}
      <section id=\"languages\" className=\"py-24 bg-[#F8F9FA]\">
        <div className=\"max-w-[1200px] mx-auto px-6\">
          <h2 className=\"text-4xl font-bold text-center mb-16\">Οι Γλώσσες που Προσφέρουμε</h2>
          <div className=\"grid lg:grid-cols-2 gap-12\">
            <div>
              <h3 className=\"text-2xl font-bold mb-6 text-[#2B2520]\">Γλώσσες για Ενήλικες</h3>
              <LanguageAccordion audience=\"adult\" languages={adultLanguages} onCTAClick={scrollToForm} />
            </div>
            <div>
              <h3 className=\"text-2xl font-bold mb-6 text-[#2B2520]\">Γλώσσες για Παιδιά</h3>
              <LanguageAccordion audience=\"child\" languages={childLanguages} onCTAClick={scrollToForm} />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 - FINAL FORM */}
      <section className="py-24 bg-white" ref={formRef} id="lead-form">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-4">Κλείσε Δωρεάν Ραντεβού Αξιολόγησης</h2>
          <p className="text-center text-[#2B2520]/60 mb-16">Θα επικοινωνήσουμε μαζί σας για να σχεδιάσουμε τη δική σας εκπαιδευτική πορεία.</p>
          <div className="max-w-xl mx-auto">
            <ConversionFunnel
              tenantId={TENANT_ID}
              agencyId={AGENCY_ID}
              settings={funnelSettings}
              onPartialCapture={handlePartialCapture}
              onComplete={handleComplete}
              onDateSelect={getBookedSlots}
              onFieldChange={(id, val) => {
                if (id === 'audience' || id === 'language') {
                  setPrefilled(prev => ({ ...prev, [id]: val }));
                }
              }}
              accentColor=\"#ff8d01\"
            />
          </div>
        </div>
      </section>

      <footer className=\"py-12 bg-[#1A1814] text-white/40 text-center text-sm border-t border-white/5\">
        <p>© 2026 SoEasy Περιστερίου - Μαθήματα Ξένων Γλωσσών</p>
        <p className=\"mt-2 text-xs text-white/20 font-light\">Designed & Developed by ADIGITAL Marketing Agency</p>
      </footer>
    </div>
  );
}
