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
        seatClass = "bg-success border-success text-success-foreground shadow-sm ring-2 ring-success/30 cursor-pointer";
      } else if (isOccupied || seat.type === 'NON_RESERVABLE' || (isFlexible && seat.hasLocker)) {
        seatClass = "bg-muted border-border/50 text-muted-foreground opacity-30 cursor-pointer";
      } else {
        seatClass = "bg-background border-border text-foreground opacity-50 cursor-pointer";
      }
    } else {
      // Interactive mode (booking flow / admin view)
      const isDisabled = !adminMode && (isOccupied || seat.type === 'NON_RESERVABLE');
      
      if (isDisabled) {
        seatClass = "bg-muted border-border/50 text-muted-foreground opacity-50 cursor-not-allowed shadow-none";
      } else if (isSelected) {
        seatClass = "bg-primary border-primary text-primary-foreground shadow-[2px_8px_0px_0px_rgba(0,0,0,0.2)] -translate-y-1";
      } else if (occupant) {
        if (occupant.isLiveInside) {
          seatClass = "bg-card border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:border-emerald-400 cursor-pointer";
        } else {
          seatClass = "bg-muted/40 border-border/60 hover:border-border cursor-pointer";
        }
      } else if (seat.type === 'PREMIUM') {
        seatClass = "bg-amber-50/70 border-amber-400 border-2 hover:border-amber-500 cursor-pointer text-amber-700 shadow-[2px_4px_0px_0px_rgba(251,191,36,0.2)] hover:shadow-[4px_8px_0px_0px_rgba(251,191,36,0.3)] hover:-translate-y-1";
      } else {
        seatClass = "bg-background border-border hover:border-primary cursor-pointer text-foreground shadow-[2px_4px_0px_0px_rgba(0,0,0,0.06)] hover:shadow-[3px_6px_0px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1";
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
            } else if (occupant) {
              toast(`${seat.name}: ${occupant.name} (${occupant.isLiveInside ? 'Live in library' : 'Away'})`, { 
                icon: occupant.isLiveInside ? '🟢' : '⚪' 
              });
            } else if (isOccupied) {
              toast(`Seat ${seat.name} is currently occupied by a student`, { icon: '👤' });
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
        title={occupant ? `${occupant.name} (${occupant.isLiveInside ? 'Live inside' : 'Away'})` : seat.name}
      >
        {occupant ? (
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
        ) : (
          /* Empty / vacant seat: display seat number normally */
          <div className="absolute inset-0 flex items-center justify-center font-bold text-xs select-none">
            {seat.name}
          </div>
        )}
        
        {seat.hasLocker && (
          <div className="absolute -top-1.5 -left-1.5 bg-foreground text-background p-0.5 rounded-full shadow-md z-30 pointer-events-none">
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
      <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-2 py-1 rounded-full border border-border font-bold flex items-center gap-1 shadow-xs">
        <Grid className="w-3 h-3" /> Pinch to Zoom
      </div>

      {/* Bottom Right Floating Stats Card */}
      <div className="absolute bottom-4 right-4 z-20 bg-background/90 backdrop-blur-md border border-border/80 shadow-lg rounded-2xl p-2.5 sm:p-3 flex items-center gap-3 text-xs select-none pointer-events-none">
        <div className="flex items-center gap-2 pr-3 border-r border-border/60">
          <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
          <span className="text-muted-foreground font-medium">Total Seats:</span>
          <span className="font-black text-foreground">{totalSeatsCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
          <span className="text-muted-foreground font-medium">Reserved Seats:</span>
          <span className="font-black text-foreground">{reservedSeatsCount}</span>
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
