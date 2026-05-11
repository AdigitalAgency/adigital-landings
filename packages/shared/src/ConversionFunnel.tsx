import React, { useState, useCallback, useEffect } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay,
  eachDayOfInterval, isBefore, startOfDay, isToday,
} from 'date-fns';
import { el } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, Loader2 } from 'lucide-react';

export interface CustomField {
  id: string; label: string; type: 'text' | 'select' | 'number' | 'email';
  options?: string[]; required: boolean; placeholder?: string; defaultValue?: string;
}
export interface WorkingDay { enabled: boolean; start: string; end: string; }
export interface BookingSettings {
  slot_duration_minutes: number; buffer_minutes: number;
  max_appointments_per_day: number; cancellation_hours: number;
  working_hours: { mon: WorkingDay; tue: WorkingDay; wed: WorkingDay; thu: WorkingDay; fri: WorkingDay; sat: WorkingDay; sun: WorkingDay; };
  custom_fields: CustomField[]; accent_color: string; welcome_message: string; success_message: string;
}
export interface FunnelLead { name: string; phone: string; [key: string]: string; }
export interface ConversionFunnelProps {
  tenantId: string;
  agencyId: string;
  settings?: Partial<BookingSettings>;
  onPartialCapture?: (lead: FunnelLead) => Promise<string | null>;
  onComplete?: (leadId: string | null, date: Date, time: string) => Promise<void>;
  onFieldChange?: (id: string, value: string) => void;
  onDateSelect?: (date: Date) => Promise<string[]>; // returns booked slot times for that date
  accentColor?: string;
}

const DEFAULT_SETTINGS: BookingSettings = {
  slot_duration_minutes: 60, buffer_minutes: 15, max_appointments_per_day: 8, cancellation_hours: 24,
  working_hours: {
    mon: { enabled: true, start: '09:00', end: '18:00' }, tue: { enabled: true, start: '09:00', end: '18:00' },
    wed: { enabled: true, start: '09:00', end: '18:00' }, thu: { enabled: true, start: '09:00', end: '18:00' },
    fri: { enabled: true, start: '09:00', end: '17:00' }, sat: { enabled: false, start: '10:00', end: '14:00' },
    sun: { enabled: false, start: '00:00', end: '00:00' },
  },
  custom_fields: [], accent_color: '#ff8d01',
  welcome_message: 'Κλείστε ένα δωρεάν ραντεβού', success_message: 'Το ραντεβού σας κλείστηκε επιτυχώς!',
};

const DAY_MAP: Record<number, keyof BookingSettings['working_hours']> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

function generateTimeSlots(day: Date, settings: BookingSettings): string[] {
  const dayKey = DAY_MAP[day.getDay()];
  const workingDay = settings.working_hours[dayKey];
  if (!workingDay.enabled) return [];
  const slots: string[] = [];
  const [startH, startM] = workingDay.start.split(':').map(Number);
  const [endH, endM] = workingDay.end.split(':').map(Number);
  let current = new Date(day); current.setHours(startH, startM, 0, 0);
  const end = new Date(day); end.setHours(endH, endM, 0, 0);
  const slotMs = settings.slot_duration_minutes * 60 * 1000;
  const bufferMs = settings.buffer_minutes * 60 * 1000;
  while (current.getTime() + slotMs <= end.getTime()) {
    slots.push(format(current, 'HH:mm'));
    current = new Date(current.getTime() + slotMs + bufferMs);
  }
  return slots;
}

function isDayAvailable(day: Date, settings: BookingSettings): boolean {
  if (isBefore(day, startOfDay(new Date()))) return false;
  const dayKey = DAY_MAP[day.getDay()];
  return settings.working_hours[dayKey]?.enabled ?? false;
}

// ── Styles (inlined to avoid Tailwind purge issues) ─────────────────────────
const S = {
  card: {
    background: '#fff', borderRadius: '24px', border: '1.5px solid #F5EFE7',
    boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 10px 40px rgba(255,141,1,0.08), 0 0 0 1px rgba(255,141,1,0.06)',
    padding: '40px', fontFamily: 'inherit',
  } as React.CSSProperties,
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B6560', marginBottom: '6px', marginLeft: '2px' } as React.CSSProperties,
  input: {
    width: '100%', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #EDE8E2',
    background: '#FDFAF7', fontSize: '15px', color: '#2B2520', outline: 'none',
    transition: 'all 0.2s', boxSizing: 'border-box',
  } as React.CSSProperties,
  inputFocus: { borderColor: '#ff8d01', background: '#fff', boxShadow: '0 0 0 3px rgba(255,141,1,0.12)' } as React.CSSProperties,
  selectWrap: { position: 'relative' } as React.CSSProperties,
  selectArrow: {
    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
    pointerEvents: 'none', color: '#A8A29E',
  } as React.CSSProperties,
  btn: {
    width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
    color: '#fff', fontWeight: 700, fontSize: '17px', cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(255,141,1,0.3)', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  } as React.CSSProperties,
  footer: {
    marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #F3EEE8',
    textAlign: 'center', fontSize: '11px', color: '#B8AFA8', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '6px',
  } as React.CSSProperties,
};

export const ConversionFunnel: React.FC<ConversionFunnelProps> = ({
  tenantId, agencyId, settings: settingsOverride, onPartialCapture, onComplete, onFieldChange, onDateSelect, accentColor,
}) => {
  const settings: BookingSettings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  const accent = accentColor || settings.accent_color;

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FunnelLead>({ name: '', phone: '' });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const [calendarStep, setCalendarStep] = useState<'pick' | 'confirm'>('pick');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Sync prefilled values from parent settings changes
  useEffect(() => {
    const updates: Record<string, string> = {};
    settings.custom_fields.forEach(f => {
      if (f.defaultValue !== undefined && f.defaultValue !== '') {
        updates[f.id] = f.defaultValue as string;
      }
    });
    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates } as FunnelLead));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOverride]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const validatePhone = (phone: string): boolean => {
    // Accepts Greek mobile/landline and international formats
    const cleaned = phone.replace(/\s/g, '');
    return /^(\+?\d{10,15}|6\d{9}|2\d{9})$/.test(cleaned);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(formData.phone)) {
      setPhoneError('Παρακαλώ εισάγετε έγκυρο τηλεφωνικό αριθμό (π.χ. 6901234567)');
      return;
    }
    setPhoneError(null);
    setIsSubmitting(true);
    try {
      const id = onPartialCapture ? await onPartialCapture(formData) : null;
      setLeadId(id);
      setStep(1);
    } catch (err: any) {
      setSubmitError(err?.message || 'Σφάλμα. Δοκιμάστε ξανά.');
    } finally { setIsSubmitting(false); }
  };

  // Step 1: user picks a time → show confirm panel (don't submit yet)
  const handleTimeSelect = (time: string) => {
    setPendingTime(time);
    setCalendarStep('confirm');
  };

  // Step 2: user confirms → actually submit
  const handleConfirmBooking = async () => {
    if (!selectedDate || !pendingTime) return;
    setSelectedTime(pendingTime);
    setIsSubmitting(true);
    try {
      await onComplete?.(leadId, selectedDate, pendingTime);
      setStep(2);
    } catch (err: any) {
      setSubmitError(err?.message || 'Σφάλμα κράτησης.');
    } finally { setIsSubmitting(false); }
  };

  const handleChangeTime = () => {
    setPendingTime(null);
    setCalendarStep('pick');
  };

  const timeSlots = selectedDate
    ? generateTimeSlots(selectedDate, settings).filter(t => !bookedSlots.includes(t))
    : [];
  const inputStyle = (id: string) => ({ ...S.input, ...(focusedField === id ? S.inputFocus : {}) });

  const updateField = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value } as FunnelLead));
    if (onFieldChange) onFieldChange(id, value);
  };

  return (
    <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto', fontFamily: 'Manrope, sans-serif' }}>
      <div style={S.card}>

        {/* STEP 1: FORM */}
        {step === 0 && (
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={S.label}>Όνομα</label>
              <input
                required type="text" placeholder="Το όνομά σας"
                value={formData.name} onChange={e => updateField('name', e.target.value)}
                onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)}
                style={inputStyle('name')}
              />
            </div>

            <div>
              <label style={S.label}>Τηλέφωνο</label>
              <input
                required type="tel" placeholder="π.χ. 6901234567"
                value={formData.phone}
                onChange={e => {
                  updateField('phone', e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
                onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField(null)}
                style={{
                  ...inputStyle('phone'),
                  ...(phoneError ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.12)' } : {})
                }}
              />
              {phoneError && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', marginLeft: '2px', fontWeight: 600 }}>
                  {phoneError}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {settings.custom_fields.map(field => (
                <div key={field.id}>
                  <label style={S.label}>{field.label}</label>
                  {field.type === 'select' ? (
                    <div style={S.selectWrap}>
                      <select
                        required={field.required} value={formData[field.id] || ''}
                        onChange={e => updateField(field.id, e.target.value)}
                        onFocus={() => setFocusedField(field.id)} onBlur={() => setFocusedField(null)}
                        style={{ ...inputStyle(field.id), appearance: 'none', paddingRight: '40px', cursor: 'pointer' }}
                      >
                        <option value="">Επιλέξτε...</option>
                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <div style={S.selectArrow}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <input
                      required={field.required} type={field.type}
                      value={formData[field.id] || ''} onChange={e => updateField(field.id, e.target.value)}
                      onFocus={() => setFocusedField(field.id)} onBlur={() => setFocusedField(null)}
                      style={inputStyle(field.id)}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit" disabled={isSubmitting}
              style={{ ...S.btn, backgroundColor: accent, marginTop: '4px',
                transform: isSubmitting ? 'none' : undefined,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(255,141,1,0.4)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(255,141,1,0.3)'; }}
            >
              {isSubmitting ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Αποστολή'}
            </button>
          </form>
        )}

        {/* STEP 2: CALENDLY-STYLE CALENDAR */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px' }}>Επιλέξτε Ημερομηνία</h3>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F3F0EC', borderRadius: '100px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, color: '#6B6560' }}>
                <Clock size={12} /> {settings.slot_duration_minutes} λεπτά
              </div>
            </div>

            {/* Month Nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', color: '#2B2520' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F0EC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ fontWeight: 800, fontSize: '16px', color: '#1a1a1a', textTransform: 'capitalize' }}>
                {format(currentMonth, 'MMMM yyyy', { locale: el })}
              </span>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', color: '#2B2520' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F3F0EC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Calendar Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {['ΔΕ','ΤΡ','ΤΕ','ΠΕ','ΠΑ','ΣΑ','ΚΥ'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#A8A29E', padding: '8px 0', letterSpacing: '0.05em' }}>{d}</div>
              ))}
              {days.map((day, idx) => {
                const available = isDayAvailable(day, settings);
                const inMonth = isSameMonth(day, currentMonth);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);

                if (!inMonth) return <div key={idx} />;

                let bgColor = 'transparent';
                let color = '#D1CDC7';
                let cursor = 'not-allowed';
                let fontWeight = 400;

                if (available) {
                  bgColor = selected ? accent : '#EEF2FF';
                  color = selected ? '#fff' : '#2563EB';
                  cursor = 'pointer';
                  fontWeight = 700;
                }

                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3px 0' }}>
                    <button
                      disabled={!available}
                      onClick={async () => {
                        setSelectedDate(day);
                        setCalendarStep('pick');
                        setPendingTime(null);
                        setBookedSlots([]);
                        if (onDateSelect) {
                          const booked = await onDateSelect(day);
                          setBookedSlots(booked);
                        }
                      }}
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%', border: 'none',
                        background: bgColor, color, cursor, fontWeight,
                        fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', position: 'relative',
                        boxShadow: selected ? `0 4px 12px ${accent}50` : 'none',
                        outline: today && !selected ? `2px solid ${accent}` : 'none',
                        outlineOffset: '2px',
                      }}
                      onMouseEnter={e => { if (available && !selected) e.currentTarget.style.background = '#DBEAFE'; }}
                      onMouseLeave={e => { if (available && !selected) e.currentTarget.style.background = '#EEF2FF'; }}
                    >
                      {format(day, 'd')}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Time Slots */}
            {selectedDate && calendarStep === 'pick' && (
              <div style={{ borderTop: '1px solid #F0EAE3', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#4A443F', margin: 0 }}>
                  Διαθέσιμες ώρες — <span style={{ color: accent }}>{format(selectedDate, 'EEEE d MMMM', { locale: el })}</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {timeSlots.map(time => (
                    <button key={time} onClick={() => handleTimeSelect(time)} disabled={isSubmitting}
                      style={{
                        padding: '12px 8px', borderRadius: '12px', border: `1.5px solid #E8E0D5`,
                        background: '#fff', color: '#2B2520', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; e.currentTarget.style.background = '#FFF8F0'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E0D5'; e.currentTarget.style.color = '#2B2520'; e.currentTarget.style.background = '#fff'; }}
                    >
                      {time}
                    </button>
                  ))}
                  {timeSlots.length === 0 && (
                    <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#A8A29E', fontSize: '14px' }}>Δεν υπάρχουν διαθέσιμες ώρες.</p>
                  )}
                </div>
              </div>
            )}

            {/* CONFIRM PANEL - shown after picking a time */}
            {calendarStep === 'confirm' && pendingTime && selectedDate && (
              <div style={{ borderTop: '1px solid #F0EAE3', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#FFF8F0', border: `1.5px solid ${accent}30`, borderRadius: '16px', padding: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>Σύνοψη Ραντεβού</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#A8A29E', margin: '0 0 2px' }}>Ημερομηνία</p>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0, textTransform: 'capitalize' }}>
                        {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: el })}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Clock size={16} color={accent} />
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#A8A29E', margin: '0 0 2px' }}>Ώρα</p>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{pendingTime}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting}
                  style={{ ...S.btn, backgroundColor: accent }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  {isSubmitting ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : '✓ Επιβεβαίωση Ραντεβού'}
                </button>

                <button onClick={handleChangeTime}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', margin: '0 auto' }}
                  onMouseEnter={e => (e.currentTarget.style.color = accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = '#A8A29E')}
                >
                  <ChevronLeft size={14} /> Αλλαγή ώρας
                </button>
              </div>
            )}

            <button onClick={() => setStep(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', margin: '0 auto' }}
              onMouseEnter={e => (e.currentTarget.style.color = accent)}
              onMouseLeave={e => (e.currentTarget.style.color = '#A8A29E')}
            >
              <ChevronLeft size={14} /> Επιστροφή στη φόρμα
            </button>
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={44} color="#22c55e" />
            </div>
            <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 12px' }}>{settings.success_message}</h3>
            <p style={{ color: '#6B6560', fontSize: '15px', lineHeight: 1.6, margin: '0 0 32px' }}>
              Το ραντεβού σας καταχωρήθηκε για<br/>
              <strong style={{ color: '#1a1a1a' }}>
                {selectedDate && format(selectedDate, 'EEEE d MMMM', { locale: el })} στις {selectedTime}
              </strong>
            </p>
            <button onClick={() => window.location.reload()} style={{ padding: '14px 36px', borderRadius: '12px', border: 'none', background: '#1a1a1a', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>
              Κλείσιμο
            </button>
          </div>
        )}

        <div style={S.footer}>
          <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e' }} />
          Τα στοιχεία σας είναι ασφαλή
        </div>
      </div>
    </div>
  );
};
