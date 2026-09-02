export function endOfDayIST(date: Date, daysToAdd: number = 0) {
  // Shift the real UTC time forward by 5.5 hours so that the UTC date/time 
  // matches the exact IST date/time.
  const istTime = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  
  // Now we can safely use UTC methods to manipulate the "local" date
  istTime.setUTCDate(istTime.getUTCDate() + daysToAdd);
  istTime.setUTCHours(23, 59, 59, 999);
  
  // Shift back by 5.5 hours to return a true UTC timestamp that corresponds 
  // to 23:59:59 in IST.
  return new Date(istTime.getTime() - 5.5 * 60 * 60 * 1000);
}

export function startOfDayIST(date: Date) {
  const istTime = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  istTime.setUTCHours(0, 0, 0, 0);
  return new Date(istTime.getTime() - 5.5 * 60 * 60 * 1000);
}

export function formatStandardDate(dateInput: Date | string | number): string {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Invalid Date";
  return new Intl.DateTimeFormat('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }).format(date);
}

export function formatStandardDateTime(dateInput: Date | string | number): string {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Invalid Date";
  const datePart = formatStandardDate(date);
  const timePart = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
  return `${datePart}, ${timePart}`;
}
