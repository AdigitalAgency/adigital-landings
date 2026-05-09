import React, { useState, useCallback } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay,
  eachDayOfInterval, isBefore, startOfDay,
} from 'date-fns';
import { el } from 'date-fns/locale';
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

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FunnelLead>({ name: '', phone: '' });
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
    <div className="w-full max-w-xl mx-auto font-sans">
      <div className="bg-white rounded-[24px] shadow-[0_10px_50px_rgba(0,0,0,0.1)] border border-[#F3F0EC] overflow-hidden">
        
        <div className="p-8 md:p-10">
          
          {/* STEP 1: CLEAN FORM (Image 1) */}
          {step === 0 && (
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#4A443F] ml-1">Όνομα</label>
                <input
                  required type="text" placeholder="Το όνομά σας"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-5 py-4 rounded-xl border transition-all outline-none ${errors.name ? 'border-red-500' : 'border-[#E8E0D5] focus:border-[#ff8d01]'}`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#4A443F] ml-1">Τηλέφωνο</label>
                <input
                  required type="tel" placeholder="Το τηλέφωνό σας"
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                  className={`w-full px-5 py-4 rounded-xl border transition-all outline-none ${errors.phone ? 'border-red-500' : 'border-[#E8E0D5] focus:border-[#ff8d01]'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {settings.custom_fields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-semibold text-[#4A443F] ml-1">{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        required={field.required} value={formData[field.id] || ''}
                        onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl border border-[#E8E0D5] bg-white text-[#2B2520] appearance-none focus:border-[#ff8d01] outline-none"
                      >
                        <option value="">Επιλέξτε...</option>
                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        required={field.required} type={field.type}
                        value={formData[field.id] || ''} onChange={e => setFormData({...formData, [field.id]: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl border border-[#E8E0D5] focus:border-[#ff8d01] outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit" disabled={isSubmitting}
                className="w-full py-4 px-6 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: accent }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Αποστολή'}
              </button>
            </form>
          )}

          {/* STEP 2: GRID CALENDAR (Image 4) */}
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-[#2B2520] mb-1">Επιλέξτε Ημερομηνία & Ώρα</h3>
                <p className="text-sm text-[#A8A29E]">Διάρκεια: {settings.slot_duration_minutes} λεπτά</p>
              </div>

              <div className="flex items-center justify-between px-2 mb-4">
                <h4 className="text-lg font-bold text-[#2B2520] capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: el })}
                </h4>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-[#F3F0EC] rounded-full transition-colors">
                    <ChevronLeft size={20} className="text-[#4A443F]" />
                  </button>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-[#F3F0EC] rounded-full transition-colors">
                    <ChevronRight size={20} className="text-[#4A443F]" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['ΔΕ', 'ΤΡ', 'ΤΕ', 'ΠΕ', 'ΠΑ', 'ΣΑ', 'ΚΥ'].map(d => (
                  <div key={d} className="text-[10px] font-bold text-[#A8A29E] py-2 uppercase tracking-widest">{d}</div>
                ))}
                {days.map((day, idx) => {
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isPast = isBefore(day, startOfDay(new Date()));
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  
                  return (
                    <button
                      key={idx} disabled={isPast || !isCurrentMonth}
                      onClick={() => setSelectedDate(day)}
                      className={`aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-all
                        ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
                        ${isSelected ? 'bg-[#ff8d01] text-white shadow-lg' : isPast ? 'text-[#D1CDC7] cursor-not-allowed' : 'text-[#2B2520] hover:bg-[#F3F0EC]'}
                      `}
                      style={isSelected ? { backgroundColor: accent } : {}}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="space-y-4 pt-6 border-t border-[#F3F0EC] animate-in fade-in duration-300">
                  <p className="text-sm font-bold text-[#4A443F]">
                    Διαθεσιμότητα για {format(selectedDate, 'EEEE d MMMM', { locale: el })}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map(time => (
                      <button
                        key={time} onClick={() => handleTimeSelect(time)}
                        className="py-3 px-2 rounded-xl border border-[#E8E0D5] text-sm font-bold text-[#2B2520] hover:border-[#ff8d01] hover:text-[#ff8d01] hover:bg-[#ff8d01]/5 transition-all"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <button onClick={() => setStep(0)} className="text-sm text-[#A8A29E] hover:text-[#4A443F] transition-colors flex items-center gap-1 mx-auto">
                <ChevronLeft size={14} /> Επιστροφή στη φόρμα
              </button>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 2 && (
            <div className="py-10 text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 rounded-full bg-[#22c55e]/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-[#22c55e]" />
              </div>
              <h3 className="text-2xl font-bold text-[#2B2520] mb-2">{settings.success_message}</h3>
              <p className="text-[#6B6560] mb-8">
                Το ραντεβού σας έχει καταχωρηθεί για τις<br />
                <strong className="text-[#2B2520]">
                  {selectedDate && format(selectedDate, 'EEEE d MMMM', { locale: el })} στις {selectedTime}
                </strong>
              </p>
              <button onClick={() => window.location.reload()} className="px-8 py-3 bg-[#2B2520] text-white rounded-xl font-bold hover:bg-black transition-all">
                Κλείσιμο
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#F3F0EC] text-center">
            <p className="text-[#A8A29E] text-[11px] font-medium flex items-center justify-center gap-1.5 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              Τα στοιχεία σας είναι ασφαλή και δεν κοινοποιούνται
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
