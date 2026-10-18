const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', '(student)', 'library', '[id]', 'LibraryClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The rewrite logic:
// We want to replace the `return (` block.

const newReturnBlock = `  return (
    <div className="min-h-screen bg-background pb-32">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-2xl rounded-3xl p-8 max-w-sm w-full text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-heading font-black text-foreground">Booking Confirmed!</h2>
            <p className="text-muted-foreground">Your seat has been successfully reserved. You can view all details in your dashboard.</p>
            <button 
              onClick={() => router.push('/student/dashboard')}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity mt-4"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <div className="text-sm font-medium text-muted-foreground mb-4">
          Home / {library.city} / <span className="text-foreground font-bold">{library.name}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-4xl font-heading font-bold text-foreground mb-3">{library.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
              {(library.name === "Kripa Library" || library.name === "Gyan Vatika Library") && (
                <span className="flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded text-xs border border-success/20"><Check className="w-3 h-3" /> Verified</span>
              )}
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {library.locality || library.address.split(',')[0]} {library.metroStation ? \`· \${library.metroDistance} km from \${library.metroStation}\` : ''}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {library.openingTime || "08:00"} – {library.closingTime || "22:00"}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
              <Share className="w-4 h-4" /> Share
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
              <Heart className={\`w-4 h-4 \${isSaved ? 'fill-foreground text-foreground' : ''}\`} /> {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Top Full Width Photos */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <LibraryPhotoGallery images={photos} libraryName={library.name} />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 flex flex-col lg:grid lg:grid-cols-3 gap-y-12 lg:gap-x-12 relative">
        
        {/* Left Column 1: About */}
        <div className="order-1 lg:col-span-2 lg:col-start-1 lg:row-start-1 space-y-12">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold font-heading tracking-tight">About</h2>
            <div className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" /> {library.openingTime || "08:00"} - {library.closingTime || "22:00"}</span>
              {library.managerPhone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-primary" /> {library.managerPhone}</span>}
              {library.seatsAvailable && <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> {library.seatsAvailable} Seats Available</span>}
            </div>
            {library.description && (
              <p className="text-foreground leading-relaxed">
                {library.description}
              </p>
            )}
          </section>
        </div>

        {/* Right Column: Sticky Booking Widget */}
        <div className="order-2 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:row-span-2" id="booking-widget">
          <div className="lg:sticky lg:top-8 bg-card border border-border shadow-2xl rounded-3xl p-6 space-y-6">
            <h3 className="text-2xl font-black font-heading tracking-tight text-foreground">
              {selectedPlan ? (
                <span>₹{totalAmount.toFixed(0)}</span>
              ) : (
                "Select a plan"
              )}
            </h3>

            <div className="space-y-3">
              <label className="text-sm font-bold text-foreground flex items-center justify-between">
                <span>1. Choose a Plan</span>
              </label>

              {/* Filters */}
              <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
                <button 
                  onClick={() => setPlanFilter("ALL")}
                  className={\`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors \${planFilter === "ALL" ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}\`}
                >
                  All Plans
                </button>
                {availableHours.map((hr: any) => (
                  <button 
                    key={hr === null ? "FULL" : hr}
                    onClick={() => setPlanFilter(hr)}
                    className={\`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors \${planFilter === hr ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}\`}
                  >
                    {hr === null ? "Full Day" : \`\${hr} hr\`}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                {filteredPlans.map((plan: any) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  const finalPrice = plan.discount ? plan.price - (plan.price * plan.discount / 100) : plan.price;
                  return (
                    <div 
                      key={plan.id} 
                      onClick={() => {
                        setSelectedPlan(plan);
                        if (plan.type === "FLEXIBLE") {
                          setSelectedSeat(null);
                        }
                      }}
                      className={\`p-4 border-2 rounded-2xl cursor-pointer transition-all \${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-border/80'}\`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-foreground">{plan.name}</span>
                        <span className="font-bold text-foreground">₹{finalPrice.toFixed(0)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{plan.validityDays} Days • {plan.durationHours ? \`\${plan.durationHours} hr access\` : 'Full Day access'}</div>
                      {plan.discount && plan.discount > 0 && (
                        <div className="mt-2 text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded w-max">
                          {plan.discount}% OFF
                        </div>
                      )}
                    </div>
                  )
                })}
                {filteredPlans.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No plans found.</div>
                )}
              </div>
              
              {/* Recommendations */}
              {selectedPlan && recommendedPlans.length > 0 && (
                <div className="pt-4 border-t border-border mt-4">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                    Recommended Upgrades ({selectedPlan.durationHours ? \`\${selectedPlan.durationHours} hr\` : 'Full Day'})
                  </label>
                  <div className="space-y-2">
                    {recommendedPlans.map((plan: any) => {
                      const finalPrice = plan.discount ? plan.price - (plan.price * plan.discount / 100) : plan.price;
                      return (
                        <div 
                          key={plan.id} 
                          onClick={() => {
                            setSelectedPlan(plan);
                            if (plan.type === "FLEXIBLE") {
                              setSelectedSeat(null);
                            }
                          }}
                          className={\`p-4 border-2 rounded-2xl cursor-pointer transition-all border-border hover:border-primary/50 bg-muted/20 hover:bg-primary/5\`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-foreground">{plan.name}</span>
                            <span className="font-bold text-foreground">₹{finalPrice.toFixed(0)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{plan.validityDays} Days • {plan.durationHours ? \`\${plan.durationHours} hr access\` : 'Full Day access'}</div>
                          {plan.discount && plan.discount > 0 && (
                            <div className="mt-2 text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded w-max">
                              {plan.discount}% OFF
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <label className="text-sm font-bold text-foreground flex justify-between items-center">
                <span>2. Select a Seat</span>
              </label>
            </div>

            {/* Seat Selection Inline */}
            <div className="mt-2">
              {!selectedPlan ? (
                <div className="bg-muted/30 border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
                  Please select a plan first to see available seats.
                </div>
              ) : isFlexible ? (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center text-foreground font-medium flex flex-col items-center gap-2">
                  <Check className="w-8 h-8 text-primary" />
                  Flexible Plan
                  <p className="text-xs text-muted-foreground font-normal">You can skip seat selection!</p>
                </div>
              ) : (
                <div className="bg-muted/30 border border-border rounded-2xl p-4 overflow-auto">
                  <div className="w-max mx-auto flex flex-col gap-2">
                    {Array.from({ length: maxY + 1 }).map((_, y) => (
                      <div key={y} className="flex gap-2">
                        {Array.from({ length: maxX + 1 }).map((_, x) => {
                          const seat = library.seats.find((s:any) => s.gridX === x && s.gridY === y);
                          if (!seat) return <div key={x} className="w-10 h-10"></div>;

                          const isOccupied = occupiedSeatIds.includes(seat.id);
                          const isSelected = selectedSeat?.id === seat.id;
                          
                          let seatClass = "bg-background border-border hover:border-primary cursor-pointer text-foreground";
                          
                          const isDisabled = isOccupied || seat.type === 'NON_RESERVABLE';

                          if (isDisabled) {
                            seatClass = "bg-muted border-border/50 text-muted-foreground opacity-50 cursor-not-allowed";
                          } else if (isSelected) {
                            seatClass = "bg-primary border-primary text-primary-foreground ring-2 ring-primary/20";
                          }

                          return (
                            <div 
                              key={seat.id} 
                              onClick={() => {
                                if (!isDisabled) {
                                  setSelectedSeat(seat);
                                  if (seat.hasLocker) {
                                    setSelectedStandaloneLockerId("");
                                  }
                                }
                              }}
                              className={\`relative w-10 h-10 rounded-lg border-2 flex items-center justify-center font-bold text-xs transition-all shadow-sm \${seatClass}\`}
                            >
                              {seat.name}
                              {seat.hasLocker && (
                                <div className="absolute -top-1.5 -right-1.5 bg-foreground text-background p-0.5 rounded-full shadow-sm">
                                  <Lock className="w-2.5 h-2.5" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                    <div className="mt-4 mx-auto w-full text-center py-1.5 bg-border/50 rounded-md text-muted-foreground text-[10px] tracking-widest uppercase font-bold border border-border">
                      Front Desk
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Locker Add-on UI */}
            {selectedPlan && (seatHasMandatoryLocker || library.standaloneLockers?.length > 0) && (
              <div className={\`p-4 rounded-xl border \${seatHasMandatoryLocker ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'} space-y-3\`}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Lock className={\`w-4 h-4 \${seatHasMandatoryLocker ? 'text-primary' : 'text-muted-foreground'}\`} />
                  </div>
                  <div className="flex-1 space-y-2">
                    {seatHasMandatoryLocker ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-foreground">Attached Locker</span>
                          <span className="font-bold text-sm">+₹{lockerCost.toFixed(0)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Included with this seat.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-foreground">Optional Locker</span>
                          {selectedStandaloneLockerId && <span className="font-bold text-sm text-primary">+₹{lockerCost.toFixed(0)}</span>}
                        </div>
                        <select 
                          value={selectedStandaloneLockerId}
                          onChange={(e) => setSelectedStandaloneLockerId(e.target.value)}
                          className="w-full text-sm rounded-lg border border-border bg-background p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">No locker needed</option>
                          {library.standaloneLockers.map((locker: any) => (
                            <option key={locker.id} value={locker.id}>
                              {locker.name} - ₹{locker.price}/mo
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method Toggle */}
            <div className="space-y-3 pt-4 border-t border-border">
              <label className="text-sm font-bold text-foreground">3. Payment Method</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMode("ONLINE")}
                  className={\`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all border-2 \${paymentMode === "ONLINE" ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-border/80'}\`}
                >
                  Pay Online
                </button>
                <button
                  onClick={() => setPaymentMode("RECEPTION")}
                  className={\`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all border-2 \${paymentMode === "RECEPTION" ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-border/80'}\`}
                >
                  Pay at Reception
                </button>
              </div>
            </div>

            {selectedPlan && (
              <div className="flex justify-between items-center text-sm font-medium mt-4 bg-muted/30 p-4 rounded-xl border border-border">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Valid From</span>
                  <span className="text-foreground">{startDate.toLocaleDateString()}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider font-bold mb-1">Valid Till</span>
                  <span className="text-foreground">{endDate.toLocaleDateString()}</span>
                </div>
              </div>
            )}

            <button 
              onClick={handleCheckout}
              disabled={!selectedPlan || (!isFlexible && !selectedSeat) || isProcessing}
              className="w-full bg-primary text-primary-foreground font-bold text-lg py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg mt-4"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {isProcessing ? "Processing..." : (paymentMode === "ONLINE" ? \`Pay ₹\${totalAmount.toFixed(0)}\` : \`Book for ₹\${totalAmount.toFixed(0)}\`)}
            </button>
            
            <p className="text-center text-xs text-muted-foreground">
              {paymentMode === "ONLINE" ? "Secure payments by Razorpay." : "Your booking will be confirmed after payment at reception."}
            </p>
          </div>
        </div>

        {/* Left Column 2: Facilities & Map */}
        <div className="order-3 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2 space-y-12">
          <hr className="border-border hidden lg:block" />

          {/* Facilities */}
          <section>
            <h2 className="text-2xl font-bold font-heading tracking-tight mb-6">What this place offers</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-8">
              {library.facilities.map((fac: string) => (
                <div key={fac} className="flex items-center gap-3 text-foreground font-medium text-sm">
                  <Check className="w-5 h-5 text-primary shrink-0" /> {fac}
                </div>
              ))}
            </div>
          </section>

          <hr className="border-border" />

          {/* Map Location */}
          <section>
            <h2 className="text-2xl font-bold font-heading tracking-tight mb-6">Location</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <iframe 
                src={mapEmbedUrl} 
                width="100%" 
                height="350" 
                style={{ border: 0 }} 
                allowFullScreen={false} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-foreground text-sm">{library.address}</h3>
                  <p className="text-muted-foreground text-xs mt-1">{library.locality}, {library.city}</p>
                </div>
                <a 
                  href={library.googleMapsUrl || \`https://maps.google.com/?q=\${encodeURIComponent(library.address)}\`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm shrink-0 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <Navigation className="w-4 h-4" /> Get Directions
                </a>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 z-40 lg:hidden flex justify-between items-center shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.1)]">
        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Starting from</div>
          <div className="text-lg font-black text-foreground">
            ₹{library.plans?.length > 0 ? Math.min(...library.plans.map((p: any) => p.price)) : 0} 
            <span className="text-sm font-medium text-muted-foreground font-sans"> / month</span>
          </div>
        </div>
        <button 
          onClick={() => {
            const widget = document.getElementById('booking-widget');
            if (widget) {
              const yOffset = -20; 
              const y = widget.getBoundingClientRect().top + window.pageYOffset + yOffset;
              window.scrollTo({top: y, behavior: 'smooth'});
            }
          }} 
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-90 shadow-lg"
        >
          Select Seats
        </button>
      </div>

    </div>
  )
}`;

const startIndex = content.indexOf('  return (');
if (startIndex !== -1) {
  content = content.substring(0, startIndex) + newReturnBlock + '\n}\n';
  fs.writeFileSync(filePath, content);
  console.log('Successfully refactored LibraryClient.tsx');
} else {
  console.log('Could not find the return block.');
}
