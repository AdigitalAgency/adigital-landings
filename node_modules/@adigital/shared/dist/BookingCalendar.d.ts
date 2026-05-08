import React from 'react';
interface BookingCalendarProps {
    onSchedule: (date: Date, time: string) => void;
    availableTimes?: string[];
    accentColor?: string;
}
export declare const BookingCalendar: React.FC<BookingCalendarProps>;
export {};
