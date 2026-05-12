import { useEffect, useRef, useState } from 'react';
import { LanguageAccordion } from '../components/LanguageAccordion';
import { StickyCTA } from '../components/StickyCTA';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Header } from '../components/Header';
import { ConversionFunnel } from '@adigital/shared';
import { supabase } from '../utils/supabaseClient';
import { notificationService } from '../utils/notificationService';
import { useNavigate } from 'react-router-dom';

// SoEasy Tenant Config
const TENANT_ID  = 'bfda7c95-4642-4757-ad8a-4be04937dbb9';
const AGENCY_ID  = 'cb0a7802-baef-4809-aee5-50c3caafbfbc';

const SOEASY_SETTINGS = {
  slot_duration_minutes: 60,
  buffer_minutes: 15,
  max_appointments_per_day: 8,
  cancellation_hours: 24,
  working_hours: {
    mon: { enabled: true,  start: '09:00', end: '18:00' },
    tue: { enabled: true,  start: '09:00', end: '18:00' },
    wed: { enabled: true,  start: '09:00', end: '18:00' },
    thu: { enabled: true,  start: '09:00', end: '18:00' },
    fri: { enabled: true,  start: '09:00', end: '17:00' },
    sat: { enabled: false, start: '10:00', end: '14:00' },
    sun: { enabled: false, start: '00:00', end: '00:00' },
  },
  custom_fields: [
    { id: 'audience', label: 'Για ποιον είναι', type: 'select' as const,
      options: ['Παιδί', 'Ενήλικας'], required: true },
    { id: 'language', label: 'Γλώσσα ενδιαφέροντος', type: 'select' as const,
      options: ['Αγγλικά', 'Γαλλικά', 'Γερμανικά', 'Ισπανικά', 'Ιταλικά', 'Κινέζικα'], required: false },
  ],
  accent_color: '#ff8d01',
  welcome_message: 'Κλείστε Δωρεάν Ραντεβού',
  success_message: 'Το ραντεβού σας κλείστηκε!',
};

export default function LandingPage() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const [prefilled, setPrefilled] = useState({ language: '', audience: '' });
  const [formData, setFormData] = useState<any>({});
  const [dbSettings, setDbSettings] = useState<any>(null); // loaded from Supabase

  // Load booking settings from Supabase on mount
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

  useEffect(() => {
    let scrolled50 = false;
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent >= 50 && !scrolled50) {
        scrolled50 = true;
        (window as any).gtag?.('event', 'scroll', { percent: 50 });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Partial capture: saves lead immediately
  async function handlePartialCapture(data: any) {
    try {
      if (!TENANT_ID || !AGENCY_ID) {
        console.warn("Tenant or Agency ID not provided");
        return;
      }
      
      const leadId = crypto.randomUUID();
      const { error } = await supabase
        .from('leads')
        .insert([{
          id: leadId,
          tenant_id: TENANT_ID,
          agency_id: AGENCY_ID,
          name: data.name,
          phone: data.phone,
          status: 'new', // Αρχικό status: Νέα επαφή
          source: 'website', // Προέλευση: Website (φόρμα)
          booking_status: 'partial',
          probability: 'high',
          custom_data: {
            audience: data.audience || prefilled.audience,
            language: data.language || prefilled.language,
            ...Object.fromEntries(
              Object.entries(data).filter(([k]) => !['name', 'phone'].includes(k))
            ),
          },
          notes: '',
        }]);

      if (error) throw error;
      
      // GTM Event
      (window as any).dataLayer?.push({
        event: 'lead_capture_step1',
        lead_id: leadId,
        source: 'website'
      });

      return leadId;
    } catch (err) {
      console.error('Partial capture error:', err);
      return null;
    }
  }

  // Full booking: updates lead status and saves appointment
  async function handleComplete(leadId: string | null, date: Date, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const slotDuration = dbSettings?.slot_duration_minutes ?? SOEASY_SETTINGS.slot_duration_minutes;

    try {
      const apptId = crypto.randomUUID();
      const { error: apptError } = await supabase
        .from('appointments')
        .insert([{
          id: apptId,
          tenant_id: TENANT_ID,
          agency_id: AGENCY_ID,
          lead_id: leadId,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: slotDuration,
          status: 'pending',
        }]);

      if (apptError) console.error('Appointment insert error:', apptError);

      if (leadId) {
        const { error: rpcError } = await supabase.rpc('confirm_lead_booking', {
          p_lead_id: leadId,
          p_appt_id: apptId
        });
        if (rpcError) console.error('RPC confirm_lead_booking error:', rpcError);
      }

      (window as any).gtag?.('event', 'conversion', { send_to: 'AW-CONVERSION_ID/LABEL' });
      (window as any).fbq?.('track', 'Lead');
      
      // GTM Event
      (window as any).dataLayer?.push({
        event: 'appointment_complete',
        lead_id: leadId,
        appointment_date: scheduledAt.toISOString()
      });

      // Trigger Notifications
      const dateStr = scheduledAt.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = scheduledAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });

      // 1. Notify Admin
      notificationService.sendEmail(
        TENANT_ID,
        'admin@soeasy.gr', // Should get this from settings
        'Νέο Ραντεβού!',
        `Έχετε ένα νέο ραντεβού για τις ${dateStr} ${timeStr}.`
      );

      // 2. Notify Lead (if phone/email provided in previous step)
      if (formData.email) {
        notificationService.sendEmail(
          TENANT_ID,
          formData.email,
          'Επιβεβαίωση Ραντεβού - SoEasy',
          `Το ραντεβού σας επιβεβαιώθηκε για τις ${dateStr} ${timeStr}. Σας περιμένουμε!`
        );
      }
      
      if (formData.phone) {
        notificationService.sendSMS(
          TENANT_ID,
          formData.phone,
          `SoEasy: Το ραντεβού σας επιβεβαιώθηκε για τις ${dateStr} ${timeStr}.`
        );
      }

    } catch (err) {
      console.error('Booking error:', err);
    }

    setTimeout(() => navigate('/thank-you'), 800);
  }

  // Fetch booked time slots for a given date (so calendar shows them as unavailable)
  async function getBookedSlots(date: Date): Promise<string[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('appointments')
      .select('scheduled_at')
      .eq('tenant_id', TENANT_ID)
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString())
      .neq('status', 'cancelled');

    return (data || []).map(a => {
      const d = new Date(a.scheduled_at);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
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

  const audienceIsChild = prefilled.audience === 'Παιδί';
  const dynamicLanguageOptions = [
    'Αγγλικά', 'Γαλλικά', 'Γερμανικά', 'Ισπανικά', 'Ιταλικά', 'Κινέζικα', 'Ρωσικά', 'Αραβικά', 'Τουρκικά',
    ...(audienceIsChild ? ['Μελέτη για παιδιά'] : ['Εξειδικευμένα Πτυχία για ενήλικες']),
  ];

  // Merge DB settings (from Supabase) with defaults — DB takes priority
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
    <div className="min-h-screen" style={{ fontFamily: 'Manrope, sans-serif' }}>
      <Header onCTAClick={() => scrollToForm()} />
      <StickyCTA />

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        h1, h2, h3 { font-family: 'Manrope', sans-serif; }
      `}</style>

      {/* HERO */}
      <section className="relative py-20 md:py-32 overflow-hidden" style={{ background: 'linear-gradient(135deg, #FAF7F3 0%, #E8E0D5 100%)' }}>
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div style={{ animation: 'fadeIn 0.8s ease-out' }}>
              <h1 className="mb-6" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: '1.2', fontWeight: 700, color: '#2B2520' }}>
                Μαθήματα Ξένων Γλωσσών στο Περιστέρι για Παιδιά & Ενήλικες
              </h1>
              <p className="text-lg md:text-xl mb-8 opacity-80" style={{ animation: 'fadeIn 0.8s ease-out 0.2s backwards' }}>
                Αγγλικά, Ισπανικά, Γερμανικά, Ιταλικά με έμπειρους καθηγητές και αποδεδειγμένα αποτελέσματα
              </p>
              <button onClick={() => scrollToForm()} className="px-8 py-4 bg-primary text-primary-foreground rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" style={{ animation: 'fadeIn 0.8s ease-out 0.4s backwards' }}>
                Κλείσε Δωρεάν Ραντεβού
              </button>
            </div>
            {/* Hero Image */}
            <div className="bg-white p-4 rounded-3xl shadow-2xl overflow-hidden transform hover:scale-[1.02] transition-all duration-500" style={{ animation: 'fadeIn 0.8s ease-out 0.3s backwards' }}>
              <ImageWithFallback 
                src="/hero-reception.png" 
                alt="SoEasy Peristeri Reception" 
                className="w-full h-[400px] object-cover rounded-2xl"
              />
            </div>
          </div>
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-32 bg-background" style={{ clipPath: 'polygon(0 50%, 100% 0, 100% 100%, 0 100%)' }} />
      </section>

      {/* SEGMENTATION */}
      <section className="py-20 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { emoji: '📚', title: 'Μαθήματα για Παιδιά', items: ['Αγγλικά από μικρή ηλικία', 'Προετοιμασία για πιστοποιήσεις', 'Διαδραστική εκμάθηση'], cta: 'Ενδιαφέρομαι για παιδί', audience: 'Παιδί', bg: '#FAF7F3' },
              { emoji: '🎓', title: 'Μαθήματα για Ενήλικες', items: ['Ισπανικά, Γερμανικά, Ιταλικά', 'Για επαγγελματικούς λόγους', 'Ευέλικτα προγράμματα'], cta: 'Ενδιαφέρομαι ως ενήλικας', audience: 'Ενήλικας', bg: '#E8E0D5' },
            ].map(({ emoji, title, items, cta, audience, bg }) => (
              <div key={title} className="bg-white p-8 rounded-2xl shadow-lg border border-border hover:shadow-xl transition-all duration-300" style={{ background: `linear-gradient(135deg, #ffffff 0%, ${bg} 100%)` }}>
                <div className="mb-4 text-4xl">{emoji}</div>
                <h2 className="mb-4 text-3xl" style={{ color: '#2B2520' }}>{title}</h2>
                <ul className="space-y-3 mb-6 text-foreground/80">
                  {items.map(i => <li key={i} className="flex items-start gap-2"><span className="text-primary mt-1">•</span><span>{i}</span></li>)}
                </ul>
                <button onClick={() => scrollToForm(undefined, audience)} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg">
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 - WHY US */}
      <section id="why-us" className="py-20 bg-[#feea00]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-12">Γιατί να επιλέξετε SoEasy Περιστερίου</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '👥', text: 'Ολιγομελή τμήματα (4–8 άτομα)' },
              { icon: '⭐', text: 'Έμπειροι καθηγητές' },
              { icon: '🏢', text: 'Σύγχρονες εγκαταστάσεις' },
              { icon: '📈', text: 'Υψηλά ποσοστά επιτυχίας' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/20 backdrop-blur-md p-8 rounded-2xl border border-white/30 text-center hover:bg-white/30 transition-all duration-300">
                <div className="text-5xl mb-4">{item.icon}</div>
                <p className="font-bold text-lg">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 - TESTIMONIALS */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-center mb-12 text-4xl md:text-5xl text-[#2B2520]">Τι λένε οι μαθητές και οι γονείς</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: 'Μαρία Π.', text: 'Η κόρη μου πήρε το Lower με άριστα! Οι καθηγητές είναι εξαιρετικοί και το περιβάλλον πολύ φιλικό.', achievement: 'Lower - Άριστα' },
              { name: 'Γιώργος Κ.', text: 'Τέλεια προετοιμασία για τα γερμανικά! Εξαιρετικό επίπεδο διδασκαλίας και πολύ καλή οργάνωση.', achievement: 'Goethe B2' },
              { name: 'Ελένη Δ.', text: 'Ευέλικτα προγράμματα που ταιριάζουν στο πρόγραμμά μου. Έμαθα ισπανικά σε χρόνο ρεκόρ!', achievement: 'DELE B1' },
            ].map((t, idx) => (
              <div key={idx} className="bg-[#FAF7F3] p-8 rounded-2xl shadow-lg border border-[#E8E0D5]">
                <div className="mb-4 text-[#ff8d01] text-4xl">"</div>
                <p className="mb-6 text-[#2B2520]/80 italic leading-relaxed">{t.text}</p>
                <div className="flex items-center justify-between">
                  <div><p className="font-bold text-[#2B2520]">{t.name}</p><p className="text-sm text-[#ff8d01] font-medium">{t.achievement}</p></div>
                  <div className="text-xl">⭐⭐⭐⭐⭐</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 - EXPERIENCE GALLERY */}
      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="mb-12 text-4xl md:text-5xl font-bold">Η εμπειρία στο SoEasy</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <ImageWithFallback src="/gallery-1.png" alt="Class Kids" className="rounded-2xl shadow-xl aspect-square object-cover" />
            <ImageWithFallback src="/gallery-2.png" alt="Classroom" className="rounded-2xl shadow-xl aspect-square object-cover" />
            <ImageWithFallback src="/gallery-3.png" alt="Lab" className="rounded-2xl shadow-xl aspect-square object-cover" />
          </div>
        </div>
      </section>

      {/* SECTION 6 - PROCESS */}
      <section id="process" className="py-24 bg-gradient-to-br from-[#FAF7F3] to-[#D4A574]">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-16">Πώς ξεκινάς</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {['Συμπληρώνεις τη φόρμα', 'Σε καλούμε εντός 24 ωρών', 'Κλείνουμε ραντεβού', 'Ξεκινάς μαθήματα', 'Παραλαμβάνεις το Πτυχίο σου'].map((text, idx) => (
              <div key={idx}>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#ff8d01] flex items-center justify-center text-2xl font-bold text-white shadow-lg">{idx + 1}</div>
                <p className="font-bold text-[#2B2520]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 7 - LANGUAGES */}
      <section id="languages" className="py-20 bg-muted/30">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-center mb-12 text-4xl md:text-5xl">Οι Γλώσσες που Προσφέρουμε</h2>
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h3 className="mb-4 text-2xl font-bold">Γλώσσες για Ενήλικες</h3>
              <LanguageAccordion audience="adult" languages={adultLanguages} onCTAClick={scrollToForm} />
            </div>
            <div>
              <h3 className="mb-4 text-2xl font-bold">Γλώσσες για Παιδιά</h3>
              <LanguageAccordion audience="child" languages={childLanguages} onCTAClick={scrollToForm} />
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM FUNNEL */}
      <section className="py-20 bg-background" ref={formRef} id="lead-form">
        <div className="max-w-[600px] mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Κλείστε Δωρεάν Ραντεβού</h2>
          <p className="opacity-70 mb-8">Συμπληρώστε τη φόρμα και επιλέξτε ημέρα και ώρα που σας εξυπηρετεί</p>
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
            onStepChange={(step, data) => {
              if (data) setFormData((prev: any) => ({ ...prev, ...data }));
            }}
            accentColor="#ff8d01"
          />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(90deg, #feea00 0%, #ff8d01 100%)' }}>
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="mb-8 text-navy text-4xl md:text-5xl font-bold uppercase tracking-tight">ΕΤΟΙΜΟΣ ΝΑ ΞΕΚΙΝΗΣΕΙΣ;</h2>
          <button onClick={() => scrollToForm()} className="px-10 py-5 bg-[#2B2520] text-white rounded-lg shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 text-xl font-black uppercase tracking-wider">
            ΚΛΕΙΣΕ ΤΩΡΑ ΤΟ ΡΑΝΤΕΒΟΥ ΣΟΥ
          </button>
        </div>
      </section>

      {/* MAP & CONTACT */}
      <section className="py-24 bg-white border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-black mb-8 text-navy uppercase tracking-tight">ΕΛΑ ΝΑ ΜΑΣ ΔΕΙΣ ΑΠΟ ΚΟΝΤΑ</h2>
              <div className="space-y-6 text-lg">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  </div>
                  <div>
                    <p className="font-black text-xs text-primary uppercase tracking-widest mb-1">ΔΙΕΥΘΥΝΣΗ</p>
                    <p className="text-navy font-bold">Δελφών 28, Περιστέρι 121 31</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  </div>
                  <div>
                    <p className="font-black text-xs text-primary uppercase tracking-widest mb-1">ΤΗΛΕΦΩΝΟ</p>
                    <a href="tel:2104441909" className="text-navy font-bold hover:text-primary transition-colors">21 0444 1909</a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  </div>
                  <div>
                    <p className="font-black text-xs text-primary uppercase tracking-widest mb-1">EMAIL</p>
                    <a href="mailto:peristeri@soeasy.gr" className="text-navy font-bold hover:text-primary transition-colors">peristeri@soeasy.gr</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-[400px] rounded-3xl overflow-hidden shadow-2xl border border-border">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3144.33177651795!2d23.6766779!3d38.0163914!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14a1a2b2256c703b%3A0x677b5a88c0379929!2sDelfon%2028%2C%20Peristeri%20121%2031%2C%20Greece!5e0!3m2!1sen!2sgr!4v1683897120000!5m2!1sen!2sgr" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-foreground text-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <p className="opacity-70 mb-2 font-bold uppercase tracking-widest text-xs">© 2026 SOEASY ΠΕΡΙΣΤΕΡΙΟΥ - ΜΑΘΗΜΑΤΑ ΞΕΝΩΝ ΓΛΩΣΣΩΝ</p>
              <p className="text-[10px] opacity-30 uppercase font-black tracking-tighter">Designed & Developed by <a href="https://adigitalagency.gr" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">ADIGITAL Marketing Agency</a></p>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://www.facebook.com/soeasyperisteri/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-all hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
              <a href="https://www.instagram.com/soeasy_peristeri/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-all hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="https://www.tiktok.com/@soeasyperisteriou" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-all hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
