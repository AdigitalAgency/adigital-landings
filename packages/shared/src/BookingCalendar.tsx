import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isBefore,
  startOfDay
} from 'date-fns';
import { el } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BookingCalendarProps {
  onSchedule: (date: Date, time: string) => void;
  availableTimes?: string[];
  accentColor?: string;
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ 
  onSchedule, 
  availableTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '17:00', '18:00', '19:00', '20:00'],
  accentColor = '#ff8d01'
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<'date' | 'time' | 'confirm' | 'success'>('date');

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const handleDateClick = (day: Date) => {
    if (isBefore(day, startOfDay(new Date()))) return;
    setSelectedDate(day);
    setSelectedTime(null); // reset time on date change
    setStep('time');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm'); // go to confirm step instead of directly submitting
  };

  const handleConfirm = () => {
    if (selectedTime) {
      onSchedule(selectedDate, selectedTime);
      setStep('success');
    }
  };


  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 transition-all duration-500 hover:shadow-orange-100/50">
      {/* Header */}
      <div 
        className="p-6 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, #2B2520 100%)` }}
      >
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-1">Κλείστε Ραντεβού</h3>
          <p className="opacity-80 text-sm">Επιλέξτε την κατάλληλη στιγμή για εσάς</p>
        </div>
        <CalendarIcon className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 text-white rotate-12" />
      </div>

      <div className="p-6">
        {step === 'date' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-gray-800 text-lg">
                {format(currentMonth, 'MMMM yyyy', { locale: el })}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button 
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'].map(day => (
                <div key={day} className="text-center text-xs font-bold text-gray-400 py-2 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const isPast = isBefore(day, startOfDay(new Date()));
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <button
                    key={idx}
                    disabled={isPast}
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 relative group",
                      !isCurrentMonth && "text-gray-300",
                      isPast && "text-gray-200 cursor-not-allowed",
                      isCurrentMonth && !isPast && "text-gray-700 hover:bg-orange-50 hover:text-orange-600",
                      isSelected && "bg-orange-500 text-white shadow-lg scale-110 z-10"
                    )}
                    style={isSelected ? { backgroundColor: accentColor } : {}}
                  >
                    {format(day, 'd')}
                    {isSameDay(day, new Date()) && !isSelected && (
                      <div className="absolute bottom-1.5 w-1 h-1 bg-orange-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'time' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <button 
              onClick={() => setStep('date')}
              className="flex items-center text-sm text-gray-500 mb-6 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Πίσω στο ημερολόγιο
            </button>
            
            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" style={{ color: accentColor }} />
              Διαθέσιμες Ώρες για {format(selectedDate, 'd MMMM', { locale: el })}
            </h4>

            <div className="grid grid-cols-3 gap-3">
              {availableTimes.map(time => (
                <button
                  key={time}
                  onClick={() => handleTimeSelect(time)}
                  className={cn(
                    "py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-200 active:scale-95",
                    selectedTime === time
                      ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm"
                      : "border-gray-100 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-600"
                  )}
                  style={selectedTime === time ? { borderColor: accentColor, color: accentColor } : {}}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <button 
              onClick={() => setStep('time')}
              className="flex items-center text-sm text-gray-500 mb-6 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Αλλαγή ώρας
            </button>

            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-6">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Σύνοψη Ραντεβού</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
                  <CalendarIcon className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ημερομηνία</p>
                  <p className="font-bold text-gray-800">{format(selectedDate, 'EEEE, d MMMM yyyy', { locale: el })}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
                  <Clock className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ώρα</p>
                  <p className="font-bold text-gray-800">{selectedTime}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              className="w-full py-3.5 rounded-xl text-white font-bold text-base shadow-lg active:scale-95 transition-all"
              style={{ backgroundColor: accentColor }}
            >
              ✓ Επιβεβαίωση Ραντεβού
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              Αν θέλετε να αλλάξετε, πατήστε "Αλλαγή ώρας" παραπάνω
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 text-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h4 className="text-2xl font-bold text-gray-800 mb-2">Το ραντεβού κλείστηκε!</h4>
            <p className="text-gray-500 mb-8">
              Θα λάβετε σύντομα επιβεβαίωση <br />
              στο <strong>{format(selectedDate, 'd MMMM', { locale: el })}</strong> στις <strong>{selectedTime}</strong>.
            </p>
            <button 
              onClick={() => setStep('date')}
              className="px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
            >
              Κλείσιμο
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

