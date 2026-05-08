import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval, isBefore, startOfDay } from 'date-fns';
import { el } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export const BookingCalendar = ({ onSchedule, availableTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '17:00', '18:00', '19:00', '20:00'], accentColor = '#ff8d01' }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedTime, setSelectedTime] = useState(null);
    const [step, setStep] = useState('date');
    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
    });
    const handleDateClick = (day) => {
        if (isBefore(day, startOfDay(new Date())))
            return;
        setSelectedDate(day);
        setStep('time');
    };
    const handleTimeSelect = (time) => {
        setSelectedTime(time);
        onSchedule(selectedDate, time);
        setStep('success');
    };
    return (_jsxs("div", { className: "w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 transition-all duration-500 hover:shadow-orange-100/50", children: [_jsxs("div", { className: "p-6 text-white relative overflow-hidden", style: { background: `linear-gradient(135deg, ${accentColor} 0%, #2B2520 100%)` }, children: [_jsxs("div", { className: "relative z-10", children: [_jsx("h3", { className: "text-2xl font-bold mb-1", children: "\u039A\u03BB\u03B5\u03AF\u03C3\u03C4\u03B5 \u03A1\u03B1\u03BD\u03C4\u03B5\u03B2\u03BF\u03CD" }), _jsx("p", { className: "opacity-80 text-sm", children: "\u0395\u03C0\u03B9\u03BB\u03AD\u03BE\u03C4\u03B5 \u03C4\u03B7\u03BD \u03BA\u03B1\u03C4\u03AC\u03BB\u03BB\u03B7\u03BB\u03B7 \u03C3\u03C4\u03B9\u03B3\u03BC\u03AE \u03B3\u03B9\u03B1 \u03B5\u03C3\u03AC\u03C2" })] }), _jsx(CalendarIcon, { className: "absolute -right-4 -bottom-4 w-32 h-32 opacity-10 text-white rotate-12" })] }), _jsxs("div", { className: "p-6", children: [step === 'date' && (_jsxs("div", { className: "animate-in fade-in slide-in-from-bottom-4 duration-500", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("span", { className: "font-bold text-gray-800 text-lg", children: format(currentMonth, 'MMMM yyyy', { locale: el }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setCurrentMonth(subMonths(currentMonth, 1)), className: "p-2 hover:bg-gray-100 rounded-full transition-colors", children: _jsx(ChevronLeft, { className: "w-5 h-5 text-gray-600" }) }), _jsx("button", { onClick: () => setCurrentMonth(addMonths(currentMonth, 1)), className: "p-2 hover:bg-gray-100 rounded-full transition-colors", children: _jsx(ChevronRight, { className: "w-5 h-5 text-gray-600" }) })] })] }), _jsx("div", { className: "grid grid-cols-7 gap-1 mb-2", children: ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'].map(day => (_jsx("div", { className: "text-center text-xs font-bold text-gray-400 py-2 uppercase tracking-wider", children: day }, day))) }), _jsx("div", { className: "grid grid-cols-7 gap-1", children: days.map((day, idx) => {
                                    const isPast = isBefore(day, startOfDay(new Date()));
                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                    const isSelected = isSameDay(day, selectedDate);
                                    return (_jsxs("button", { disabled: isPast, onClick: () => handleDateClick(day), className: cn("aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 relative group", !isCurrentMonth && "text-gray-300", isPast && "text-gray-200 cursor-not-allowed", isCurrentMonth && !isPast && "text-gray-700 hover:bg-orange-50 hover:text-orange-600", isSelected && "bg-orange-500 text-white shadow-lg scale-110 z-10"), style: isSelected ? { backgroundColor: accentColor } : {}, children: [format(day, 'd'), isSameDay(day, new Date()) && !isSelected && (_jsx("div", { className: "absolute bottom-1.5 w-1 h-1 bg-orange-500 rounded-full" }))] }, idx));
                                }) })] })), step === 'time' && (_jsxs("div", { className: "animate-in fade-in slide-in-from-right-4 duration-500", children: [_jsxs("button", { onClick: () => setStep('date'), className: "flex items-center text-sm text-gray-500 mb-6 hover:text-gray-800 transition-colors", children: [_jsx(ChevronLeft, { className: "w-4 h-4 mr-1" }), "\u03A0\u03AF\u03C3\u03C9 \u03C3\u03C4\u03BF \u03B7\u03BC\u03B5\u03C1\u03BF\u03BB\u03CC\u03B3\u03B9\u03BF"] }), _jsxs("h4", { className: "font-bold text-gray-800 mb-4 flex items-center", children: [_jsx(Clock, { className: "w-5 h-5 mr-2 text-orange-500" }), "\u0394\u03B9\u03B1\u03B8\u03AD\u03C3\u03B9\u03BC\u03B5\u03C2 \u038F\u03C1\u03B5\u03C2 \u03B3\u03B9\u03B1 ", format(selectedDate, 'd MMMM', { locale: el })] }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: availableTimes.map(time => (_jsx("button", { onClick: () => handleTimeSelect(time), className: "py-3 px-4 rounded-xl border border-gray-100 text-sm font-medium hover:border-orange-500 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 active:scale-95", children: time }, time))) })] })), step === 'success' && (_jsxs("div", { className: "py-12 text-center animate-in zoom-in duration-500", children: [_jsx("div", { className: "w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6", children: _jsx(CheckCircle2, { className: "w-10 h-10 text-green-500" }) }), _jsx("h4", { className: "text-2xl font-bold text-gray-800 mb-2", children: "\u03A4\u03BF \u03C1\u03B1\u03BD\u03C4\u03B5\u03B2\u03BF\u03CD \u03BA\u03BB\u03B5\u03AF\u03C3\u03C4\u03B7\u03BA\u03B5!" }), _jsxs("p", { className: "text-gray-500 mb-8", children: ["\u0398\u03B1 \u03BB\u03AC\u03B2\u03B5\u03C4\u03B5 \u03C3\u03CD\u03BD\u03C4\u03BF\u03BC\u03B1 \u03B5\u03C0\u03B9\u03B2\u03B5\u03B2\u03B1\u03AF\u03C9\u03C3\u03B7 ", _jsx("br", {}), "\u03C3\u03C4\u03BF ", _jsx("strong", { children: format(selectedDate, 'd MMMM', { locale: el }) }), " \u03C3\u03C4\u03B9\u03C2 ", _jsx("strong", { children: selectedTime }), "."] }), _jsx("button", { onClick: () => setStep('date'), className: "px-8 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95", children: "\u039A\u03BB\u03B5\u03AF\u03C3\u03B9\u03BC\u03BF" })] }))] })] }));
};
