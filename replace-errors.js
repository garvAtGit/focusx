const fs = require('fs');
let content = fs.readFileSync('src/app/actions/student-actions.ts', 'utf8');

// List of exact strings to replace outside of transactions
const replacements = [
  ['throw new Error("Unauthorized")', 'return { error: "Unauthorized" }'],
  ['throw new Error("Student not found")', 'return { error: "Student not found" }'],
  ['throw new Error("Library not found")', 'return { error: "Library not found" }'],
  ['throw new Error("Invalid booking")', 'return { error: "Invalid booking" }'],
  ['throw new Error("Booking is not pending payment")', 'return { error: "Booking is not pending payment" }'],
  ['throw new Error("No library found.")', 'return { error: "No library found." }'],
  ['throw new Error("Invalid new plan")', 'return { error: "Invalid new plan" }'],
  ['throw new Error("Please select a seat for this reserved (fixed-seat) plan.")', 'return { error: "Please select a seat for this reserved (fixed-seat) plan." }'],
  ['throw new Error("Cannot extend: Seat is already booked for the extended duration")', 'return { error: "Cannot extend: Seat is already booked for the extended duration" }'],
  ['throw new Error("Cannot renew: Seat is already booked for the extended duration")', 'return { error: "Cannot renew: Seat is already booked for the extended duration" }'],
  ['    throw e;', '    return { error: e.message || "Operation failed" };']
];

replacements.forEach(([from, to]) => {
  // Global replace but simple string match (split and join)
  content = content.split(from).join(to);
});

fs.writeFileSync('src/app/actions/student-actions.ts', content, 'utf8');
