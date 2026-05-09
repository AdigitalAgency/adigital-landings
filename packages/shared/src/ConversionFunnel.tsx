import React, { useState, useCallback } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
  eachDayOfInterval, isBefore, startOfDay, addMinutes, parse,
  isAfter, isSunday, isSaturday
} from 'date-fns';
import { el } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Clock, Calendar, CheckCircle2,
  User, Phone, ArrowRight, Loader2, AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'email';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface WorkingDay {
  enabled: boolean;
  start: string; // "09:00"
  end: string;   // "18:00"
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
  [key: string]: string; // custom field values
}

export interface ConversionFunnelProps {
  tenantId: string;
  agencyId: string;
  settings?: Partial<BookingSettings>;
  onPartialCapture?: (lead: FunnelLead) => Promise<string | null>; // returns lead_id
  onComplete?: (leadId: string | null, date: Date, time: string) => Promise<void>;
  accentColor?: string;
}

// ─── Default Settings ─────────────────────────────────────────────────────────

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

const DAY_LABELS = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

// ─── Utility ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

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

function isDayAvailable(day: Date, settings: BookingSettings): boolean {
  if (isBefore(day, startOfDay(new Date()))) return false;
  const dayKey = DAY_MAP[day.getDay()];
  return settings.working_hours[dayKey]?.enabled ?? false;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total, accent }: { current: number; total: number; accent: string }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
            style={{
              backgroundColor: i < current ? accent : i === current ? accent : '#e5e7eb',
              color: i <= current ? '#fff' : '#9ca3af',
              transform: i === current ? 'scale(1.15)' : 'scale(1)',
              boxShadow: i === current ? `0 0 0 4px ${accent}30` : 'none',
            }}
          >
            {i < current ? <CheckCircle2 size={16} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className="w-12 h-0.5 transition-all duration-500"
              style={{ backgroundColor: i < current ? accent : '#e5e7eb' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0=form, 1=calendar, 2=success
  const [leadId, setLeadId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FunnelLead>({ name: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [calStep, setCalStep] = useState<'date' | 'time'>('date');

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  // ── Validate Step 0 ─────────────────────────────────────────────────────────
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Το όνομα είναι υποχρεωτικό';
    if (!formData.phone.trim()) newErrors.phone = 'Το τηλέφωνο είναι υποχρεωτικό';
    else if (!/^[0-9+\s\-()]{8,}$/.test(formData.phone)) newErrors.phone = 'Μη έγκυρο τηλέφωνο';

    settings.custom_fields.forEach(field => {
      if (field.required && !formData[field.id]?.trim()) {
        newErrors[field.id] = `Το πεδίο "${field.label}" είναι υποχρεωτικό`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, settings.custom_fields]);

  // ── Submit Step 0 (Partial Capture) ─────────────────────────────────────────
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Fire partial capture — save lead IMMEDIATELY before showing calendar
      const id = onPartialCapture ? await onPartialCapture(formData) : null;
      setLeadId(id);
      setStep(1);
    } catch (err: any) {
      setSubmitError(err?.message || 'Σφάλμα. Δοκιμάστε ξανά.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submit Booking ───────────────────────────────────────────────────────────
  const handleTimeSelect = async (time: string) => {
    if (!selectedDate) return;
    setSelectedTime(time);
    setIsSubmitting(true);
    try {
      await onComplete?.(leadId, selectedDate, time);
      setStep(2);
    } catch (err: any) {
      setSubmitError(err?.message || 'Σφάλμα κράτησης. Δοκιμάστε ξανά.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timeSlots = selectedDate ? generateTimeSlots(selectedDate, settings) : [];

  // ─── RENDER: Wrapper ─────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
      {/* Header */}
      <div
        className="p-6 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accent} 0%, #2B2520 100%)` }}
      >
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-1">{settings.welcome_message}</h3>
          <p className="opacity-75 text-sm">
            {step === 0 && 'Βήμα 1 από 2: Τα στοιχεία σας'}
            {step === 1 && 'Βήμα 2 από 2: Επιλογή ημέρας & ώρας'}
            {step === 2 && settings.success_message}
          </p>
        </div>
        <Calendar className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 text-white rotate-12" />
      </div>

      <div className="p-6">
        <StepIndicator current={step} total={3} accent={accent} />

        {/* ── STEP 0: Contact Form ─────────────────────────────────────────── */}
        {step === 0 && (
          <form onSubmit={handleFormSubmit} className="space-y-4 animate-in fade-in duration-300">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Ονοματεπώνυμο *
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Το όνομά σας"
                  value={lead.name}
                  onChange={(e) => setLead({ ...lead, name: e.target.value })}
                  className="w-full px-5 py-4 rounded-xl border border-[#E8E0D5] bg-white text-[#2B2520] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all"
                  style={{ '--tw-ring-color': accent } as any}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#4A443F] ml-1">Τηλέφωνο</label>
                <input
                  required
                  type="tel"
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  {field.label} {field.required && '*'}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={formData[field.id] || ''}
                    onChange={e => setFormData(p => ({ ...p, [field.id]: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all bg-white",
                      errors[field.id] ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"
                    )}
                  >
                    <option value="">Επιλέξτε...</option>
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={formData[field.id] || ''}
                    onChange={e => setFormData(p => ({ ...p, [field.id]: e.target.value }))}
                    placeholder={field.placeholder || ''}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all",
                      errors[field.id] ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-orange-400"
                    )}
                  />
                )}
                {errors[field.id] && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />{errors[field.id]}
                  </p>
                )}
              </div>
            ))}

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <AlertCircle size={16} />{submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>Επόμενο <ArrowRight size={18} /></>}
            </button>

            <p className="text-center text-xs text-gray-400">
              🔒 Τα στοιχεία σας είναι ασφαλή και δεν κοινοποιούνται
            </p>
          </form>
        )}

        {/* ── STEP 1: Calendar ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="animate-in fade-in duration-300">
            {calStep === 'date' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-bold text-gray-800">
                    {format(currentMonth, 'MMMM yyyy', { locale: el })}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                      <ChevronLeft size={18} className="text-gray-600" />
                    </button>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                      <ChevronRight size={18} className="text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-gray-400 py-1 uppercase">{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, idx) => {
                    const available = isDayAvailable(day, settings);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                    const isToday = isSameDay(day, new Date());

                    return (
                      <button
                        key={idx}
                        disabled={!available || !isCurrentMonth}
                        onClick={() => { setSelectedDate(day); setCalStep('time'); }}
                        className={cn(
                          "aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 relative",
                          !isCurrentMonth && "opacity-20 cursor-default",
                          !available && isCurrentMonth && "text-gray-300 cursor-not-allowed line-through",
                          available && isCurrentMonth && !isSelected && "text-gray-700 hover:text-white cursor-pointer",
                          isSelected && "text-white shadow-lg scale-110 z-10",
                        )}
                        style={{
                          backgroundColor: isSelected ? accent : undefined,
                        }}
                        onMouseEnter={e => {
                          if (available && isCurrentMonth && !isSelected) {
                            (e.target as HTMLElement).style.backgroundColor = accent;
                            (e.target as HTMLElement).style.color = 'white';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            (e.target as HTMLElement).style.backgroundColor = '';
                            (e.target as HTMLElement).style.color = '';
                          }
                        }}
                      >
                        {format(day, 'd')}
                        {isToday && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: accent }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setStep(0)}
                  className="mt-4 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft size={14} /> Επιστροφή στη φόρμα
                </button>
              </div>
            )}

            {calStep === 'time' && selectedDate && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <button onClick={() => setCalStep('date')}
                  className="flex items-center text-sm text-gray-500 mb-4 hover:text-gray-800 transition-colors">
                  <ChevronLeft size={14} className="mr-1" />
                  {format(selectedDate, 'EEEE d MMMM', { locale: el })}
                </button>

                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock size={18} style={{ color: accent }} />
                  Διαθέσιμες ώρες
                </h4>

                {timeSlots.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>Δεν υπάρχουν διαθέσιμες ώρες.</p>
                    <button onClick={() => setCalStep('date')} className="mt-2 text-sm underline">
                      Επιλέξτε άλλη μέρα
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map(time => (
                      <button
                        key={time}
                        disabled={isSubmitting}
                        onClick={() => handleTimeSelect(time)}
                        className="py-3 px-2 rounded-xl border border-gray-200 text-sm font-medium transition-all duration-200 active:scale-95 hover:text-white hover:border-transparent disabled:opacity-50"
                        onMouseEnter={e => {
                          const el = e.target as HTMLElement;
                          el.style.backgroundColor = accent;
                          el.style.borderColor = accent;
                          el.style.color = 'white';
                        }}
                        onMouseLeave={e => {
                          const el = e.target as HTMLElement;
                          el.style.backgroundColor = '';
                          el.style.borderColor = '';
                          el.style.color = '';
                        }}
                      >
                        {isSubmitting && selectedTime === time ? <Loader2 size={14} className="animate-spin mx-auto" /> : time}
                      </button>
                    ))}
                  </div>
                )}

                {submitError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {submitError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Success ──────────────────────────────────────────────── */}
        {step === 2 && selectedDate && selectedTime && (
          <div className="py-8 text-center animate-in zoom-in duration-500">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: `${accent}20` }}
            >
              <CheckCircle2 size={40} style={{ color: accent }} />
            </div>
            <h4 className="text-2xl font-bold text-gray-800 mb-2">{settings.success_message}</h4>
            <p className="text-gray-500 mb-2">
              <strong>{format(selectedDate, 'EEEE, d MMMM yyyy', { locale: el })}</strong>
            </p>
            <p className="text-gray-500 mb-6">
              Ώρα: <strong>{selectedTime}</strong>
              {settings.slot_duration_minutes && (
                <span className="text-gray-400 text-sm ml-1">
                  ({settings.slot_duration_minutes} λεπτά)
                </span>
              )}
            </p>
            <div
              className="inline-block px-6 py-3 rounded-xl text-white text-sm font-medium"
              style={{ backgroundColor: accent }}
            >
              ✓ Θα λάβετε επιβεβαίωση σύντομα
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
