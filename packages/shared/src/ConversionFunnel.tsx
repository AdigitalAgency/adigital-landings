import React, { useState, useCallback, useEffect } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay,
  eachDayOfInterval, isBefore, startOfDay,
} from 'date-fns';
import { el } from 'el-GR'; // Use Greek locale
import {
  ChevronLeft, ChevronRight, Clock, CheckCircle2,
  Loader2, AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'email';
  options?: string[];
  required: boolean;
  placeholder?: string;
  defaultValue?: string; // Support for prefilling
}

export interface WorkingDay {
  enabled: boolean;
  start: string;
  end: string;
}

export interface BookingSettings {
  slot_duration_minutes: number;
  buffer_minutes: number;
  max_appointments_per_day: number;
  cancellation_hours: number;
  working_hours: {
    mon: WorkingDay; tue: WorkingDay; wed: WorkingDay;
    thu: WorkingDay; fri: WorkingDay; sat: WorkingDay; sun: WorkingDay;
  };
  custom_fields: CustomField[];
  accent_color: string;
  welcome_message: string;
  success_message: string;
}

export interface FunnelLead {
  name: string;
  phone: string;
  [key: string]: string;
}

export interface ConversionFunnelProps {
  tenantId: string;
  agencyId: string;
  settings?: Partial<BookingSettings>;
  onPartialCapture?: (lead: FunnelLead) => Promise<string | null>;
  onComplete?: (leadId: string | null, date: Date, time: string) => Promise<void>;
  accentColor?: string;
}

const DEFAULT_SETTINGS: BookingSettings = {
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
  custom_fields: [],
  accent_color: '#ff8d01',
  welcome_message: 'Κλείστε ένα δωρεάν ραντεβού',
  success_message: 'Το ραντεβού σας κλείστηκε επιτυχώς!',
};

const DAY_MAP: Record<number, keyof BookingSettings['working_hours']> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function generateTimeSlots(day: Date, settings: BookingSettings): string[] {
  const dayKey = DAY_MAP[day.getDay()];
  const workingDay = settings.working_hours[dayKey];
  if (!workingDay.enabled) return [];

  const slots: string[] = [];
  const [startH, startM] = workingDay.start.split(':').map(Number);
  const [endH, endM] = workingDay.end.split(':').map(Number);

  let current = new Date(day);
  current.setHours(startH, startM, 0, 0);
  const end = new Date(day);
  end.setHours(endH, endM, 0, 0);

  const slotMs = settings.slot_duration_minutes * 60 * 1000;
  const bufferMs = settings.buffer_minutes * 60 * 1000;

  while (current.getTime() + slotMs <= end.getTime()) {
    slots.push(format(current, 'HH:mm'));
    current = new Date(current.getTime() + slotMs + bufferMs);
  }
  return slots;
}

export const ConversionFunnel: React.FC<ConversionFunnelProps> = ({
  tenantId,
  agencyId,
  settings: settingsOverride,
  onPartialCapture,
  onComplete,
  accentColor,
}) => {
  const settings: BookingSettings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  const accent = accentColor || settings.accent_color;

  // State
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [leadId, setLeadId] = useState<string | null>(null);
  
  // Initialize form with default values from settings (prefilling)
  const [formData, setFormData] = useState<FunnelLead>(() => {
    const initial: FunnelLead = { name: '', phone: '' };
    settings.custom_fields.forEach(f => {
      if (f.defaultValue) initial[f.id] = f.defaultValue;
    });
    return initial;
  });

  // Sync state if settings change (for prefilling from external buttons)
  useEffect(() => {
    settings.custom_fields.forEach(f => {
      if (f.defaultValue) {
        setFormData(prev => ({ ...prev, [f.id]: f.defaultValue || prev[f.id] }));
      }
    });
  }, [settings.custom_fields]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Υποχρεωτικό';
    if (!formData.phone.trim()) newErrors.phone = 'Υποχρεωτικό';
    settings.custom_fields.forEach(f => { if (f.required && !formData[f.id]?.trim()) newErrors[f.id] = 'Υποχρεωτικό'; });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, settings.custom_fields]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const id = onPartialCapture ? await onPartialCapture(formData) : null;
      setLeadId(id);
      setStep(1);
    } catch (err: any) {
      setSubmitError(err?.message || 'Σφάλμα');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeSelect = async (time: string) => {
    if (!selectedDate) return;
    setSelectedTime(time);
    setIsSubmitting(true);
    try {
      await onComplete?.(leadId, selectedDate, time);
      setStep(2);
    } catch (err: any) {
      setSubmitError(err?.message || 'Σφάλμα');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeSlots = selectedDate ? generateTimeSlots(selectedDate, settings) : [];

  return (
    <div className="w-full max-w-xl mx-auto font-sans" style={{ perspective: '1000px' }}>
      <div className="bg-white rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.12)] border border-white/50 overflow-hidden">
        
        <div className="p-8 md:p-12">
          
          {/* STEP 1: CLEAN FORM (Image 1) */}
          {step === 0 && (
            <form onSubmit={handleFormSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#6B6560] ml-1">Όνομα</label>
                <input
                  required type="text" placeholder="Το όνομά σας"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-6 py-4.5 rounded-2xl border transition-all outline-none text-lg ${errors.name ? 'border-red-500' : 'border-[#F0EBE5] bg-[#FCFAF8] focus:bg-white focus:border-[#ff8d01] focus:shadow-[0_0_0_4px_rgba(255,141,1,0.1)]'}`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-bold text-[#6B6560] ml-1">Τηλέφωνο</label>
                <input
                  required type="tel" placeholder="Το τηλέφωνό σας"
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                  className={`w-full px-6 py-4.5 rounded-2xl border transition-all outline-none text-lg ${errors.phone ? 'border-red-500' : 'border-[#F0EBE5] bg-[#FCFAF8] focus:bg-white focus:border-[#ff8d01] focus:shadow-[0_0_0_4px_rgba(255,141,1,0.1)]'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                {settings.custom_fields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-[13px] font-bold text-[#6B6560] ml-1">{field.label}</label>
                    {field.type === 'select' ? (
                      <div className="relative">
                        <select
                          required={field.required} value={formData[field.id] || ''}
                          onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                          className="w-full px-6 py-4.5 rounded-2xl border border-[#F0EBE5] bg-[#FCFAF8] text-[#2B2520] appearance-none focus:bg-white focus:border-[#ff8d01] outline-none transition-all pr-10"
                        >
                          <option value="">Επιλέξτε...</option>
                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#A8A29E]">
                          <ChevronRight size={18} className="rotate-90" />
                        </div>
                      </div>
                    ) : (
                      <input
                        required={field.required} type={field.type}
                        value={formData[field.id] || ''} onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                        className="w-full px-6 py-4.5 rounded-2xl border border-[#F0EBE5] bg-[#FCFAF8] focus:bg-white focus:border-[#ff8d01] outline-none transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit" disabled={isSubmitting}
                className="w-full py-5 px-8 rounded-2xl text-white font-black text-xl shadow-[0_15px_40px_rgba(255,141,1,0.3)] hover:shadow-[0_20px_50px_rgba(255,141,1,0.4)] transform hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 mt-4"
                style={{ backgroundColor: accent }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Αποστολή'}
              </button>
            </form>
          )}

          {/* STEP 2: GRID CALENDAR (Image 4) */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h3 className="text-3xl font-black text-[#2B2520] mb-2">Επιλέξτε Ημερομηνία & Ώρα</h3>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F3F0EC] rounded-full text-xs font-bold text-[#6B6560]">
                  <Clock size={12} /> {settings.slot_duration_minutes} λεπτά
                </div>
              </div>

              <div className="flex items-center justify-between px-2">
                <h4 className="text-xl font-black text-[#2B2520] capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: el })}
                </h4>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 hover:bg-[#F3F0EC] rounded-full transition-all">
                    <ChevronLeft size={24} />
                  </button>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 hover:bg-[#F3F0EC] rounded-full transition-all">
                    <ChevronRight size={24} />
                  </button>
                </div>
              </div>

              {/* Force Grid Layout with Inline Styles to bypass any Tailwind issues */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)', 
                gap: '8px',
                textAlign: 'center' 
              }}>
                {['ΔΕ', 'ΤΡ', 'ΤΕ', 'ΠΕ', 'ΠΑ', 'ΣΑ', 'ΚΥ'].map(d => (
                  <div key={d} className="text-[11px] font-black text-[#A8A29E] py-2 uppercase tracking-widest">{d}</div>
                ))}
                {days.map((day, idx) => {
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isPast = isBefore(day, startOfDay(new Date()));
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <button
                        disabled={isPast || !isCurrentMonth}
                        onClick={() => setSelectedDate(day)}
                        style={{
                          width: '44px',
                          height: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '9999px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          transition: 'all 0.2s',
                          border: 'none',
                          cursor: (isPast || !isCurrentMonth) ? 'not-allowed' : 'pointer',
                          backgroundColor: isSelected ? accent : 'transparent',
                          color: isSelected ? 'white' : (isPast || !isCurrentMonth) ? '#D1CDC7' : '#2B2520',
                          opacity: isCurrentMonth ? 1 : 0,
                          pointerEvents: isCurrentMonth ? 'auto' : 'none',
                          boxShadow: isSelected ? `0 10px 25px ${accent}40` : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected && isCurrentMonth && !isPast) {
                            e.currentTarget.style.backgroundColor = '#F3F0EC';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {format(day, 'd')}
                      </button>
                    </div>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="space-y-6 pt-10 border-t border-[#F3F0EC]">
                  <p className="text-center font-bold text-[#4A443F]">
                    Διαθεσιμότητα για <span className="text-[#ff8d01]">{format(selectedDate, 'EEEE d MMMM', { locale: el })}</span>
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {timeSlots.map(time => (
                      <button
                        key={time} onClick={() => handleTimeSelect(time)}
                        className="py-4 rounded-2xl border border-[#E8E0D5] text-base font-black text-[#2B2520] hover:border-[#ff8d01] hover:text-[#ff8d01] hover:bg-[#ff8d01]/5 transition-all shadow-sm"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <button onClick={() => setStep(0)} className="text-sm font-bold text-[#A8A29E] hover:text-[#ff8d01] transition-colors flex items-center gap-1 mx-auto mt-4">
                <ChevronLeft size={16} /> Επιστροφή στη φόρμα
              </button>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 2 && (
            <div className="py-12 text-center">
              <div className="w-24 h-24 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 size={48} className="text-[#22c55e]" />
              </div>
              <h3 className="text-3xl font-black text-[#2B2520] mb-3">{settings.success_message}</h3>
              <p className="text-lg text-[#6B6560] leading-relaxed mb-10">
                Το ραντεβού σας έχει καταχωρηθεί για τις<br />
                <strong className="text-[#2B2520] text-xl">
                  {selectedDate && format(selectedDate, 'EEEE d MMMM', { locale: el })} στις {selectedTime}
                </strong>
              </p>
              <button onClick={() => window.location.reload()} className="px-10 py-4 bg-[#2B2520] text-white rounded-2xl font-black hover:bg-black transition-all shadow-xl">
                Κλείσιμο
              </button>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-[#F3F0EC] text-center">
            <p className="text-[#A8A29E] text-[12px] font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              ΤΑ ΣΤΟΙΧΕΙΑ ΣΑΣ ΕΙΝΑΙ ΑΣΦΑΛΗ ΚΑΙ ΔΕΝ ΚΟΙΝΟΠΟΙΟΥΝΤΑΙ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
