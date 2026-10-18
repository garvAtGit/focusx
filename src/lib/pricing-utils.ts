export function calculateBookingTotal(booking: any) {
  if (!booking.plan) return 0;
  
  if (booking.bookingIntent?.expectedAmountPaise !== undefined) {
    return Math.round(booking.bookingIntent.expectedAmountPaise / 100);
  }
  
  const basePrice = booking.plan.discount 
    ? booking.plan.price - (booking.plan.price * booking.plan.discount / 100) 
    : booking.plan.price;
    
  let lockerCost = 0;
  let premiumCost = 0;
  
  if (booking.seat) {
    if (booking.hasLocker && booking.seat.lockerPriceDaily) {
      lockerCost = booking.seat.lockerPriceDaily * booking.plan.validityDays;
    }
    if (booking.seat.type === 'PREMIUM' && booking.seat.premiumPriceDaily) {
      premiumCost = booking.seat.premiumPriceDaily * booking.plan.validityDays;
      if (booking.seat.syncPremiumOffers !== false && booking.plan.discount) {
        premiumCost -= (premiumCost * booking.plan.discount / 100);
      }
    }
  } else if (booking.standaloneLocker) {
    // Standalone lockers are fixed price for 28 days
    lockerCost = (booking.standaloneLocker.price / 28) * booking.plan.validityDays;
  }
  
  return Math.round(basePrice + lockerCost + premiumCost);
}
