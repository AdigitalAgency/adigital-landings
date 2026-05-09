import { useEffect, useRef, useState } from 'react';
import { LanguageAccordion } from '../components/LanguageAccordion';
import { StickyCTA } from '../components/StickyCTA';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Header } from '../components/Header';
import { ConversionFunnel } from '@adigital/shared';
import { supabase } from '../utils/supabaseClient';
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
    if (language || audience) setPrefilled({ language: language || '', audience: audience || '' });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Partial capture: saves lead immediately when user clicks "Next"
  async function handlePartialCapture(lead: any): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          name: lead.name,
          phone: lead.phone,
          status: 'new',
          booking_status: 'partial',
          tenant_id: TENANT_ID,
          agency_id: AGENCY_ID,
          custom_data: {
            audience: lead.audience || prefilled.audience,
            language: lead.language || prefilled.language,
            ...Object.fromEntries(
              Object.entries(lead).filter(([k]) => !['name', 'phone'].includes(k))
            ),
          },
          notes: '',
        }])
        .select('id')
        .single();
      if (error) throw error;
      return data?.id ?? null;
    } catch (err) {
      console.error('Partial capture error:', err);
      return null; // Don't block the user flow if save fails
    }
  }

  // Full booking: updates lead status and saves appointment
  async function handleComplete(leadId: string | null, date: Date, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hours, minutes, 0, 0);

    try {
      // Save appointment
      const { data: appt } = await supabase
        .from('appointments')
        .insert([{
          tenant_id: TENANT_ID,
          agency_id: AGENCY_ID,
          lead_id: leadId,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: SOEASY_SETTINGS.slot_duration_minutes,
          status: 'pending',
        }])
        .select('id')
        .single();

      // Update lead status
      if (leadId) {
        await supabase.from('leads').update({
          booking_status: 'booked',
          appointment_id: appt?.id,
        }).eq('id', leadId);
      }

      // Fire pixel events
      (window as any).gtag?.('event', 'conversion', { send_to: 'AW-CONVERSION_ID/LABEL' });
      (window as any).fbq?.('track', 'Lead');

    } catch (err) {
      console.error('Booking error:', err);
    }

    // Always redirect to thank-you regardless of DB success
    setTimeout(() => navigate('/thank-you'), 800);
  }

  // Common languages (same order for both)
  const commonLanguages = [
    { name: 'Αγγλικά', flag: '🇬🇧' }, { name: 'Γαλλικά', flag: '🇫🇷' },
    { name: 'Γερμανικά', flag: '🇩🇪' }, { name: 'Ισπανικά', flag: '🇪🇸' },
    { name: 'Ιταλικά', flag: '🇮🇹' }, { name: 'Κινέζικα', flag: '🇨🇳' },
    { name: 'Ρωσικά', flag: '🇷🇺' }, { name: 'Αραβικά', flag: '🇸🇦' },
    { name: 'Τουρκικά', flag: '🇹🇷' },
  ];
  // Εξειδικευμένα last for adults, Μελέτη για παιδιά last for children
  const adultLanguages = [...commonLanguages, { name: 'Εξειδικευμένα Πτυχία για ενήλικες', flag: '🎓' }];
  const childLanguages  = [...commonLanguages, { name: 'Μελέτη για παιδιά', flag: '📖' }];

  // Dynamic language options based on selected audience
  const audienceIsChild = prefilled.audience === 'Παιδί';
  const dynamicLanguageOptions = [
    'Αγγλικά', 'Γαλλικά', 'Γερμανικά', 'Ισπανικά', 'Ιταλικά', 'Κινέζικα', 'Ρωσικά', 'Αραβικά', 'Τουρκικά',
    ...(audienceIsChild ? ['Μελέτη για παιδιά'] : ['Εξειδικευμένα Πτυχία για ενήλικες']),
  ];

  // Build settings with prefilled audience/language pre-selection
  const funnelSettings = {
    ...SOEASY_SETTINGS,
    custom_fields: SOEASY_SETTINGS.custom_fields.map(f => ({
      ...f,
      // Dynamically update language options based on audience
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
            {/* Hero Funnel */}
            <div style={{ animation: 'fadeIn 0.8s ease-out 0.3s backwards' }}>
              <ConversionFunnel
                tenantId={TENANT_ID}
                agencyId={AGENCY_ID}
                settings={funnelSettings}
                onPartialCapture={handlePartialCapture}
                onComplete={handleComplete}
                onFieldChange={(id, val) => {
                  if (id === 'audience' || id === 'language') {
                    setPrefilled(prev => ({ ...prev, [id]: val }));
                  }
                }}
                accentColor="#ff8d01"
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

      {/* WHY US */}
      <section className="py-20 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #feea00 0%, #fef34d 100%)' }}>
        <div className="max-w-[1200px] mx-auto px-6 relative z-10">
          <h2 className="text-center mb-12 text-4xl md:text-5xl">Γιατί να επιλέξετε SoEasy Περιστερίου</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[{ icon: '👥', text: 'Ολιγομελή τμήματα (4–8 άτομα)' }, { icon: '⭐', text: 'Έμπειροι καθηγητές' }, { icon: '🏢', text: 'Σύγχρονες εγκαταστάσεις' }, { icon: '📈', text: 'Υψηλά ποσοστά επιτυχίας' }].map((item, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20 text-center hover:bg-white/20 transition-all duration-300">
                <div className="text-5xl mb-4">{item.icon}</div>
                <p className="text-lg">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-center mb-12 text-4xl md:text-5xl" style={{ color: 'var(--navy)' }}>Τι λένε οι μαθητές</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[{ name: 'Μαρία Π.', text: 'Η κόρη μου πήρε το Lower με άριστα!', achievement: 'Lower - Άριστα' }, { name: 'Γιώργος Κ.', text: 'Εξαιρετικό επίπεδο διδασκαλίας!', achievement: 'Goethe B2' }, { name: 'Ελένη Δ.', text: 'Έμαθα ισπανικά σε χρόνο ρεκόρ!', achievement: 'DELE B1' }].map((t, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl shadow-lg border border-border">
                <div className="mb-4 text-accent text-3xl">"</div>
                <p className="mb-4 opacity-80 italic">{t.text}</p>
                <div className="flex items-center justify-between">
                  <div><p className="font-medium">{t.name}</p><p className="text-sm text-primary">{t.achievement}</p></div>
                  <div className="text-2xl">⭐⭐⭐⭐⭐</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LANGUAGES */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-center mb-12 text-4xl md:text-5xl" style={{ color: 'var(--navy)' }}>Οι Γλώσσες που Προσφέρουμε</h2>
          <div className="grid lg:grid-cols-2 gap-8">
            <div><h3 className="mb-4 text-2xl" style={{ color: 'var(--navy)' }}>Γλώσσες για Ενήλικες</h3>
              <LanguageAccordion audience="adult" languages={adultLanguages} onCTAClick={(l, a) => scrollToForm(l, a)} /></div>
            <div><h3 className="mb-4 text-2xl" style={{ color: 'var(--navy)' }}>Γλώσσες για Παιδιά</h3>
              <LanguageAccordion audience="child" languages={childLanguages} onCTAClick={(l, a) => scrollToForm(l, a)} /></div>
          </div>
        </div>
      </section>

      {/* BOTTOM FUNNEL */}
      <section className="py-20 bg-background" ref={formRef}>
        <div className="max-w-[600px] mx-auto px-6">
          <h2 className="text-center mb-4 text-4xl md:text-5xl" style={{ color: 'var(--navy)' }}>Κλείστε Δωρεάν Ραντεβού</h2>
          <p className="text-center mb-8 opacity-70">Συμπληρώστε τη φόρμα και επιλέξτε ημέρα και ώρα που σας εξυπηρετεί</p>
          <ConversionFunnel
            tenantId={TENANT_ID}
            agencyId={AGENCY_ID}
            settings={funnelSettings}
            onPartialCapture={handlePartialCapture}
            onComplete={handleComplete}
            onFieldChange={(id, val) => {
              if (id === 'audience' || id === 'language') {
                setPrefilled(prev => ({ ...prev, [id]: val }));
              }
            }}
            accentColor="#ff8d01"
          />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(90deg, #feea00 0%, #ff8d01 100%)' }}>
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <h2 className="mb-8 text-navy text-4xl md:text-5xl font-bold">Έτοιμος να ξεκινήσεις;</h2>
          <button onClick={() => scrollToForm()} className="px-10 py-5 bg-[#2B2520] text-white rounded-lg shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 text-xl font-medium">
            Κλείσε τώρα το ραντεβού σου
          </button>
        </div>
      </section>

      <footer className="py-8 bg-foreground text-background text-center">
        <p className="opacity-70 mb-2">© 2026 SoEasy Περιστερίου - Μαθήματα Ξένων Γλωσσών</p>
        <p className="text-xs opacity-50">Designed & Developed by <a href="https://adigitalagency.gr" target="_blank" rel="noopener noreferrer" className="hover:text-primary">ADIGITAL Marketing Agency</a></p>
      </footer>
    </div>
  );
}
