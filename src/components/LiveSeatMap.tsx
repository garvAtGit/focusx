"use client";

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
  onSeatSelect?: (seat: LiveSeat) => void;
  compactMode?: boolean;
  occupantData?: Record<string, { name: string; profilePhotoUrl: string | null }>;
}

export default function LiveSeatMap({ 
  library, 
  occupiedSeatIds, 
  targetSeatId,
  isFlexible,
  interactive = false,
  adminMode = false,
  selectedSeat,
  onSeatSelect,
  compactMode = false,
  occupantData
}: LiveSeatMapProps) {
  
  const maxX = Math.max(...(library.seats?.map((seat) => seat.gridX) || [0]), 0);
  const maxY = Math.max(...(library.seats?.map((seat) => seat.gridY) || [0]), 0);

  const renderSeat = (seat: LiveSeat | null | undefined, emptyKey?: string | number) => {
    if (!seat || seat.type === 'EMPTY') return <div key={emptyKey || seat?.id} className="w-12 h-12 shrink-0"></div>;

    const isOccupied = occupiedSeatIds.includes(seat.id);
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
      // Interactive mode (booking flow)
      const isDisabled = !adminMode && (isOccupied || seat.type === 'NON_RESERVABLE');
      
      if (isDisabled) {
        seatClass = "bg-muted border-border/50 text-muted-foreground opacity-50 cursor-not-allowed shadow-none";
      } else if (isSelected) {
        seatClass = "bg-primary border-primary text-primary-foreground shadow-[2px_8px_0px_0px_rgba(0,0,0,0.2)] -translate-y-2";
      } else if (seat.type === 'PREMIUM') {
        seatClass = "bg-amber-50 border-amber-400 border-2 hover:border-amber-500 cursor-pointer text-amber-700 shadow-[2px_4px_0px_0px_rgba(251,191,36,0.2)] hover:shadow-[4px_8px_0px_0px_rgba(251,191,36,0.3)] hover:-translate-y-2";
      } else {
        seatClass = "bg-background border-border hover:border-primary cursor-pointer text-foreground shadow-[2px_4px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[4px_8px_0px_0px_rgba(0,0,0,0.1)] hover:-translate-y-2";
      }
    }

    return (
      <div 
        key={seat.id} 
        onClick={() => {
          if (adminMode && onSeatSelect) {
            onSeatSelect(seat);
          } else if (interactive && !isOccupied && seat.type !== 'NON_RESERVABLE') {
            if (onSeatSelect) onSeatSelect(seat);
          } else {
            if (isTarget) {
              toast(`This is your reserved seat (${seat.name})`, { icon: '🎯' });
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
        className={`relative w-12 h-12 rounded-lg border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 shrink-0 ${seatClass}`}
      >
        {isOccupied && occupantData && occupantData[seat.id] ? (
          <div className="w-full h-full rounded-[inherit] overflow-hidden">
            {occupantData[seat.id].profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={occupantData[seat.id].profilePhotoUrl!} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                {occupantData[seat.id].name.charAt(0)}
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {seat.name}
          </div>
        )}
        
        {seat.hasLocker && (
          <div className="absolute -top-3 -right-2 bg-foreground text-background p-0.5 rounded-full shadow-lg z-10">
            <Lock className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-muted/30 border border-border rounded-2xl p-0 overflow-hidden relative">
      <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-2 py-1 rounded-full border border-border font-bold flex items-center gap-1">
        <Grid className="w-3 h-3" /> Pinch to Zoom
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
