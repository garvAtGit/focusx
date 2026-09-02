'use client';

import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  BookOpen, 
  Coffee, 
  Car, 
  Footprints,
  MoreVertical,
  Edit2
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';

export function CalendarPrototype() {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 6, 24)); // July 24, 2026

  // Dummy activity dates for the blue dots (e.g. July 2026)
  const activeDates = [3, 5, 12, 14, 18, 19, 21, 24, 26, 28, 29];

  // Dummy timeline data for the selected day
  const timelineEvents = [
    {
      type: 'location',
      title: 'Home',
      subtitle: 'Started at 8:15 AM',
      icon: <Home className="w-4 h-4 text-white" />,
      iconBg: 'bg-blue-500',
    },
    {
      type: 'action',
      title: 'Commuting',
      duration: '45 min',
      timeRange: '8:15 AM - 9:00 AM',
      icon: <Car className="w-4 h-4 text-gray-700" />,
    },
    {
      type: 'location',
      title: 'FocusX Library',
      subtitle: '9:00 AM - 1:15 PM',
      icon: <BookOpen className="w-4 h-4 text-white" />,
      iconBg: 'bg-indigo-500',
    },
    {
      type: 'action',
      title: 'Deep Work Session',
      duration: '4 hr 15 min',
      timeRange: '9:00 AM - 1:15 PM',
      icon: <Footprints className="w-4 h-4 text-gray-700" />, // Using footprint as a generic action icon
    },
    {
      type: 'location',
      title: 'Nico\'s Cafe',
      subtitle: '1:15 PM - 2:00 PM',
      icon: <Coffee className="w-4 h-4 text-white" />,
      iconBg: 'bg-orange-400',
    },
    {
      type: 'action',
      title: 'Lunch Break',
      duration: '45 min',
      timeRange: '1:15 PM - 2:00 PM',
      icon: <Footprints className="w-4 h-4 text-gray-700" />,
    },
    {
      type: 'location',
      title: 'FocusX Library',
      subtitle: '2:00 PM - 5:30 PM',
      icon: <BookOpen className="w-4 h-4 text-white" />,
      iconBg: 'bg-indigo-500',
    },
    {
      type: 'action',
      title: 'Study Session',
      duration: '3 hr 30 min',
      timeRange: '2:00 PM - 5:30 PM',
      icon: <Footprints className="w-4 h-4 text-gray-700" />,
    },
    {
      type: 'location',
      title: 'Home',
      subtitle: 'Arrived at 6:15 PM',
      icon: <Home className="w-4 h-4 text-white" />,
      iconBg: 'bg-blue-500',
    }
  ];

  // Calendar logic for July 2026
  // Starts on Wednesday (July 1st 2026 is a Wednesday)
  const startPadding = 3;
  const daysInMonth = 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="relative w-full max-w-[400px] h-[750px] bg-white overflow-hidden shadow-2xl sm:rounded-[40px] border-[8px] border-slate-900 font-sans flex flex-col">
      
      {/* App Bar */}
      <div className="flex items-center px-4 pt-12 pb-4 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <button 
          onClick={() => setIsCalendarOpen(true)}
          className="mx-auto flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <span className="font-medium text-[17px] text-gray-900">
            {format(selectedDate, 'MMM d') === format(new Date(2026, 6, 24), 'MMM d') ? 'Today' : 'Sat, Jul 24'}
          </span>
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </button>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-white pb-24 relative">
        {/* The continuous vertical blue line */}
        <div className="absolute left-[39px] top-8 bottom-12 w-[3px] bg-[#4285F4] rounded-full" />

        <div className="space-y-0">
          {timelineEvents.map((event, i) => {
            if (event.type === 'location') {
              return (
                <div key={i} className="flex items-start gap-4 py-3 relative z-10">
                  <div className="w-12 flex justify-center mt-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm z-10 ${event.iconBg}`}>
                      {event.icon}
                    </div>
                  </div>
                  <div className="flex-1 pt-1.5">
                    <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{event.title}</h3>
                    <p className="text-[13px] text-gray-500 mt-0.5">{event.subtitle}</p>
                  </div>
                  <button className="pt-1.5 text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              );
            } else {
              // Action type
              return (
                <div key={i} className="flex items-start gap-4 py-3 relative z-10">
                  <div className="w-12 flex justify-center mt-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center z-10">
                      {event.icon}
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="border border-blue-500 rounded-[20px] p-3 inline-block pr-6 bg-white/50 backdrop-blur-sm">
                      <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{event.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5 text-[13px] text-gray-500">
                        <span>{event.duration}</span>
                      </div>
                      <div className="text-[13px] text-gray-500 mt-0.5">
                        {event.timeRange}
                      </div>
                    </div>
                  </div>
                  <button className="pt-3 text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              );
            }
          })}
        </div>
      </div>

      {/* Floating Edit Button (like Google Maps bottom right) */}
      <button className="absolute bottom-6 right-6 w-14 h-14 bg-white border border-gray-200 shadow-[0_4px_12px_rgb(0,0,0,0.15)] rounded-full flex items-center justify-center text-blue-600 hover:bg-gray-50 transition-colors z-10">
        <Edit2 className="w-6 h-6" />
      </button>

      {/* Calendar Overlay Modal */}
      {isCalendarOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-2xl overflow-hidden pb-4">
            {/* Header */}
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-[28px] text-gray-700 tracking-tight">Sat, Jul 24</h2>
            </div>
            
            {/* Month Nav */}
            <div className="flex items-center justify-center px-4 py-2 gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-[14px] font-medium text-gray-700">July 2026</span>
              <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 px-4 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center text-[11px] font-medium text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-y-2 px-4">
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square flex flex-col items-center justify-center relative">
                  <span className="text-[13px] text-gray-300">
                    {30 - startPadding + i + 1} {/* Previous month dummy dates */}
                  </span>
                </div>
              ))}
              {days.map((day) => {
                const isActive = activeDates.includes(day);
                const isSelected = day === 24;

                return (
                  <div 
                    key={day}
                    onClick={() => setIsCalendarOpen(false)}
                    className="aspect-[1/1.1] flex flex-col items-center justify-center relative cursor-pointer group"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-medium transition-colors
                      ${isSelected ? 'bg-[#1a73e8] text-white' : 'text-[#1a73e8] group-hover:bg-blue-50'}
                    `}>
                      {day}
                    </div>
                    {isActive && !isSelected && (
                      <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#1a73e8]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
