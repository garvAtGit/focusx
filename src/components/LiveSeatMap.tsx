"use client";

import { useMemo } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Grid, Lock } from "lucide-react";
import { toast } from "react-hot-toast";

export interface LiveSeat {
  id: string;
  name: string;
  type: string;
  gridX: number;
  gridY: number;
  hasLocker?: boolean;
}

export type LiveSeatOccupant = {
  studentId?: string;
  name: string;
  phone?: string | null;
  profilePhotoUrl: string | null;
  isLiveInside?: boolean;
  isReserved?: boolean;
  planName?: string | null;
  endTime?: string;
};

interface LiveSeatMapProps {
  library: {
    seats?: LiveSeat[] | null;
  };
  occupiedSeatIds: string[];
  targetSeatId?: string | null; // Highlight specific seat
  isFlexible?: boolean; // Highlight all available seats
  interactive?: boolean; // Whether seats can be clicked
  adminMode?: boolean; // If true, all seats are clickable to view details
  selectedSeat?: Pick<LiveSeat, "id"> | null;
  selectedPlan?: unknown;
  onSeatSelect?: (seat: LiveSeat, occupant?: LiveSeatOccupant | null) => void;
  compactMode?: boolean;
  occupantData?: Record<string, LiveSeatOccupant>;
  unreservedLiveStudents?: LiveSeatOccupant[];
}

export default function LiveSeatMap({ 
  library, 
  occupiedSeatIds = [], 
  targetSeatId,
  isFlexible,
  interactive = false,
  adminMode = false,
  selectedSeat,
  onSeatSelect,
  compactMode = false,
  occupantData,
  unreservedLiveStudents = []
}: LiveSeatMapProps) {
  
  const maxX = Math.max(...(library.seats?.map((seat) => seat.gridX) || [0]), 0);
  const maxY = Math.max(...(library.seats?.map((seat) => seat.gridY) || [0]), 0);

  // Dynamically map unreserved live students to available unreserved seats
  // Sequence: top row (Row A / lowest gridY) from left to right (lowest gridX), then next rows
  const dynamicUnreservedMap = useMemo(() => {
    if (!unreservedLiveStudents || unreservedLiveStudents.length === 0 || !library.seats) {
      return new Map<string, LiveSeatOccupant>();
    }

    // Filter available unreserved seats:
    // - Not EMPTY or NON_RESERVABLE
    // - Not occupied by a reserved booking (neither in occupiedSeatIds nor occupantData)
    const availableSeats = library.seats
      .filter((seat) => {
        if (!seat || seat.type === "EMPTY" || seat.type === "NON_RESERVABLE") return false;
        if (occupiedSeatIds.includes(seat.id)) return false;
        if (occupantData && (occupantData[seat.id] || occupantData[seat.name])) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.gridY !== b.gridY) return a.gridY - b.gridY;
        return a.gridX - b.gridX;
      });

    const mapping = new Map<string, LiveSeatOccupant>();
    unreservedLiveStudents.forEach((student, index) => {
      if (index < availableSeats.length) {
        mapping.set(availableSeats[index].id, student);
      }
    });

    return mapping;
  }, [library.seats, occupiedSeatIds, occupantData, unreservedLiveStudents]);

  const renderSeat = (seat: LiveSeat | null | undefined, emptyKey?: string | number) => {
    if (!seat || seat.type === 'EMPTY') return <div key={emptyKey || seat?.id} className="w-12 h-12 shrink-0"></div>;

    const reservedOccupant = occupantData ? (occupantData[seat.id] || occupantData[seat.name]) : undefined;
    const dynamicOccupant = dynamicUnreservedMap.get(seat.id);
    const occupant = reservedOccupant || dynamicOccupant;

    const isOccupied = Boolean(occupant) || occupiedSeatIds.includes(seat.id);
    const isDynamicUnreserved = !reservedOccupant && Boolean(dynamicOccupant);
    const isSelected = selectedSeat?.id === seat.id;
    const isTarget = targetSeatId === seat.id;
    
    let seatClass = "bg-background border-border text-foreground";
    
    // In read-only mode, we display colors based on target/flexible
    if (!interactive) {
      if (isTarget) {
        seatClass = "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)] scale-110 z-10 ring-4 ring-primary/30";
      } else if (isFlexible && !isOccupied && seat.type !== 'NON_RESERVABLE' && !seat.hasLocker) {
        seatClass = "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/30 cursor-pointer";
      } else if (isOccupied) {
        // Red BookMyShow style for occupied seats in read-only mode
        seatClass = "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 cursor-not-allowed opacity-90 shadow-none";
      } else if (seat.type === 'NON_RESERVABLE' || (isFlexible && seat.hasLocker)) {
        seatClass = "bg-muted border-border/50 text-muted-foreground opacity-30 cursor-not-allowed";
      } else {
        seatClass = "bg-background border-border text-foreground opacity-70 cursor-pointer hover:border-primary";
      }
    } else {
      // Interactive mode (booking flow / admin view)
      if (adminMode) {
        if (isSelected) {
          seatClass = "bg-primary border-primary text-primary-foreground shadow-[2px_8px_0px_0px_rgba(0,0,0,0.2)] -translate-y-1";
        } else if (occupant) {
          if (occupant.isLiveInside) {
            seatClass = "bg-card border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:border-emerald-400 cursor-pointer";
          } else {
            seatClass = "bg-muted/40 border-border/60 hover:border-border cursor-pointer";
          }
        } else if (seat.type === 'NON_RESERVABLE') {
          seatClass = "bg-muted border-border/50 text-muted-foreground opacity-50 cursor-pointer";
        } else if (seat.type === 'PREMIUM') {
          seatClass = "bg-amber-50/70 border-amber-400 border-2 hover:border-amber-500 cursor-pointer text-amber-700 shadow-[2px_4px_0px_0px_rgba(251,191,36,0.2)]";
        } else {
          seatClass = "bg-background border-border hover:border-primary cursor-pointer text-foreground shadow-[2px_4px_0px_0px_rgba(0,0,0,0.06)] hover:shadow-[3px_6px_0px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1";
        }
      } else {
        // Student interactive booking flow
        if (isSelected) {
          seatClass = "bg-primary border-primary text-primary-foreground shadow-[2px_8px_0px_0px_rgba(var(--primary),0.3)] ring-4 ring-primary/20 -translate-y-1 font-black";
        } else if (isOccupied) {
          // RED BOOKMYSHOW STYLE FOR RESERVED/FILLED SEATS
          seatClass = "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300 cursor-not-allowed shadow-none";
        } else if (seat.type === 'NON_RESERVABLE') {
          seatClass = "bg-muted/40 border-border/40 text-muted-foreground/50 opacity-40 cursor-not-allowed shadow-none";
        } else if (seat.type === 'PREMIUM') {
          seatClass = "bg-amber-50/80 border-amber-400 border-2 hover:border-amber-500 cursor-pointer text-amber-700 shadow-[2px_4px_0px_0px_rgba(251,191,36,0.2)] hover:shadow-[3px_6px_0px_0px_rgba(251,191,36,0.3)] hover:-translate-y-0.5";
        } else {
          seatClass = "bg-background border-border hover:border-primary hover:bg-primary/5 cursor-pointer text-foreground shadow-[2px_4px_0px_0px_rgba(0,0,0,0.06)] hover:shadow-[3px_6px_0px_0px_rgba(0,0,0,0.1)] hover:-translate-y-0.5";
        }
      }
    }

    return (
      <div 
        key={seat.id} 
        onClick={() => {
          if (adminMode && onSeatSelect) {
            onSeatSelect(seat, occupant);
          } else if (interactive && !isOccupied && seat.type !== 'NON_RESERVABLE') {
            if (onSeatSelect) onSeatSelect(seat, occupant);
          } else {
            if (isTarget) {
              toast(`This is your reserved seat (${seat.name})`, { icon: '🎯' });
            } else if (occupant && adminMode) {
              toast(`${seat.name}: ${occupant.name} (${occupant.isLiveInside ? 'Live in library' : 'Away'})`, { 
                icon: occupant.isLiveInside ? '🟢' : '⚪' 
              });
            } else if (isOccupied) {
              toast.error(`Seat ${seat.name} is already reserved by another student`, { icon: '🔴' });
            } else if (seat.type === 'NON_RESERVABLE') {
              toast(`Seat ${seat.name} is not reservable`, { icon: '🚫' });
            } else if (isFlexible && seat.hasLocker) {
              toast(`Seat ${seat.name} has an attached locker, so it's unavailable for flexible plans.`, { icon: '🔒' });
            } else if (isFlexible && !seat.hasLocker) {
              toast.success(`Seat ${seat.name} is available for you to use!`);
            } else {
              toast.success(`Seat ${seat.name} is available`);
            }
          }
        }}
        className={`relative w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 shrink-0 select-none ${seatClass}`}
        title={
          adminMode && occupant
            ? `${occupant.name} (${occupant.isLiveInside ? 'Live inside' : 'Away'})`
            : isOccupied
              ? `Seat ${seat.name} (Filled / Reserved)`
              : isSelected
                ? `Seat ${seat.name} (Selected)`
                : seat.type === 'PREMIUM'
                  ? `Seat ${seat.name} (Premium)`
                  : `Seat ${seat.name} (Available)`
        }
      >
        {adminMode && occupant ? (
          <div className="relative w-full h-full rounded-[inherit] overflow-hidden">
            {occupant.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={occupant.profilePhotoUrl} 
                alt={occupant.name} 
                className={`w-full h-full object-cover select-none transition-all duration-300 ${
                  occupant.isLiveInside ? 'opacity-100' : 'opacity-40 grayscale contrast-125'
                }`}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center font-bold text-base select-none transition-all duration-300 ${
                occupant.isLiveInside 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-muted text-muted-foreground opacity-40'
              }`}>
                {occupant.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Live indicator dot */}
            {occupant.isLiveInside ? (
              <span 
                className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse z-20 pointer-events-none" 
                title={`${occupant.name} is currently live in the library`}
              />
            ) : (
              <span 
                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-zinc-400 ring-1 ring-background opacity-60 z-20 pointer-events-none" 
                title={`${occupant.name} is currently outside`}
              />
            )}

            {/* Seat Number Rule: Show seat no. ONLY for reserved seats; HIDE for dynamically assigned unreserved seats */}
            {!isDynamicUnreserved && (
              <div className="absolute bottom-0.5 inset-x-0.5 py-0.5 bg-black/75 backdrop-blur-xs text-[8px] leading-tight font-black text-white rounded text-center tracking-tight truncate z-20 shadow-xs pointer-events-none">
                {seat.name}
              </div>
            )}
          </div>
        ) : isTarget ? (
          /* Student's own reserved seat in "Locate My Seat" */
          <div className="flex flex-col items-center justify-center leading-none select-none text-center px-0.5">
            <span className="text-[11px] font-black text-primary-foreground">{seat.name}</span>
            <span className="text-[8px] font-extrabold uppercase tracking-tight text-primary-foreground/90 mt-0.5">Your Seat</span>
          </div>
        ) : isSelected ? (
          /* Currently selected seat in student booking flow */
          <div className="flex flex-col items-center justify-center leading-none select-none text-center px-0.5">
            <span className="text-xs font-black text-primary-foreground">{seat.name}</span>
            <span className="text-[8px] font-extrabold uppercase tracking-tight text-primary-foreground/90 mt-0.5">Selected</span>
          </div>
        ) : isOccupied ? (
          /* RED BOOKMYSHOW FILLED SEAT DISPLAY */
          <div className="flex flex-col items-center justify-center leading-none select-none text-center px-0.5">
            <span className="text-[11px] font-black text-rose-700 dark:text-rose-300">{seat.name}</span>
            <span className="text-[8px] font-black uppercase tracking-tight text-rose-600 dark:text-rose-400 mt-0.5">Filled</span>
          </div>
        ) : seat.type === 'NON_RESERVABLE' ? (
          /* Non reservable seat */
          <div className="flex flex-col items-center justify-center leading-none select-none text-center px-0.5">
            <span className="text-[10px] font-bold text-muted-foreground">{seat.name}</span>
            <span className="text-[7px] font-bold uppercase text-muted-foreground/60">N/A</span>
          </div>
        ) : seat.type === 'PREMIUM' ? (
          /* Premium seat */
          <div className="flex flex-col items-center justify-center leading-none select-none text-center px-0.5">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{seat.name}</span>
            <span className="text-[8px] font-extrabold uppercase text-amber-600 dark:text-amber-400 mt-0.5">★ Star</span>
          </div>
        ) : (
          /* Available regular seat */
          <div className="flex flex-col items-center justify-center leading-none select-none text-center px-0.5">
            <span className="text-xs font-bold">{seat.name}</span>
          </div>
        )}
        
        {seat.hasLocker && (
          <div 
            className="absolute -top-1.5 -left-1.5 bg-foreground text-background p-0.5 rounded-full shadow-md z-30 pointer-events-none"
            title="Attached locker included"
          >
            <Lock className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
    );
  };

  const totalSeatsCount = useMemo(() => {
    return library.seats?.filter(s => s && s.type !== 'EMPTY' && s.type !== 'NON_RESERVABLE').length || 0;
  }, [library.seats]);

  const reservedSeatsCount = useMemo(() => {
    return library.seats?.filter(s => {
      if (!s || s.type === 'EMPTY' || s.type === 'NON_RESERVABLE') return false;
      return occupiedSeatIds.includes(s.id) || Boolean(occupantData && (occupantData[s.id] || occupantData[s.name]));
    }).length || 0;
  }, [library.seats, occupiedSeatIds, occupantData]);

  return (
    <div className="bg-muted/30 border border-border rounded-2xl p-0 overflow-hidden relative">
      {/* Top Legend Bar */}
      <div className="px-3.5 py-2.5 bg-background/90 backdrop-blur-md border-b border-border flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5" title="Available for selection">
            <div className="w-3.5 h-3.5 rounded border-2 border-border bg-card shadow-2xs"></div>
            <span className="text-[11px] text-foreground">Available</span>
          </div>
          <div className="flex items-center gap-1.5" title="Occupied or reserved by another student">
            <div className="w-3.5 h-3.5 rounded border-2 border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 flex items-center justify-center text-[7px] font-black text-rose-600 dark:text-rose-400">
              ✕
            </div>
            <span className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">Filled / Reserved</span>
          </div>
          <div className="flex items-center gap-1.5" title="Currently selected seat">
            <div className="w-3.5 h-3.5 rounded bg-primary border border-primary flex items-center justify-center text-[8px] text-primary-foreground font-black">
              ✓
            </div>
            <span className="text-[11px] text-foreground font-semibold">Selected</span>
          </div>
          <div className="flex items-center gap-1.5" title="Premium seat with enhanced amenities">
            <div className="w-3.5 h-3.5 rounded border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-[8px] flex items-center justify-center text-amber-600 font-bold">
              ★
            </div>
            <span className="text-[11px] text-amber-800 dark:text-amber-300">Premium</span>
          </div>
          <div className="flex items-center gap-1.5" title="Seat includes attached personal locker">
            <div className="w-3.5 h-3.5 rounded border border-border bg-muted flex items-center justify-center">
              <Lock className="w-2 h-2 text-foreground" />
            </div>
            <span className="text-[11px]">With Locker</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground font-bold bg-muted/50 px-2 py-0.5 rounded-full border border-border">
          <Grid className="w-3 h-3" /> Pinch to Zoom
        </div>
      </div>

      {/* Bottom Right Floating Stats Card */}
      <div className="absolute bottom-4 right-4 z-20 bg-background/90 backdrop-blur-md border border-border/80 shadow-lg rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 sm:gap-3 text-xs select-none pointer-events-none">
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-border/60">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          <span className="text-muted-foreground text-[11px] font-medium">Total:</span>
          <span className="font-black text-foreground text-xs">{totalSeatsCount}</span>
        </div>
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-border/60">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
          <span className="text-muted-foreground text-[11px] font-medium">Available:</span>
          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
            {Math.max(0, totalSeatsCount - reservedSeatsCount)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]"></span>
          <span className="text-muted-foreground text-[11px] font-medium">Filled:</span>
          <span className="font-black text-rose-600 dark:text-rose-400 text-xs">{reservedSeatsCount}</span>
        </div>
      </div>

      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        centerOnInit={true}
        wheel={{ step: 0.1 }}
      >
        <TransformComponent wrapperClass={`!w-full ${compactMode ? '!h-[300px]' : '!h-[calc(100vh-250px)]'} cursor-grab active:cursor-grabbing`}>
          <div className="w-full h-full p-8 flex items-center justify-center">
            <div className="w-max mx-auto flex flex-col gap-3 transition-transform duration-500 ease-out">
              {Array.from({ length: maxY + 1 }).map((_, y) => (
                  <div key={y} className="flex justify-center gap-3">
                    {Array.from({ length: maxX + 1 }).map((_, x) => {
                      const seat = library.seats?.find((candidate) => candidate.gridX === x && candidate.gridY === y);
                      return renderSeat(seat, x);
                    })}
                  </div>
                ))}
              <div className="mt-4 mx-auto w-full text-center py-1.5 bg-border/50 rounded-md text-muted-foreground text-[10px] tracking-widest uppercase font-bold border border-border">
                Front Desk
              </div>
            </div>
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
