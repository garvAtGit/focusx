"use client";

import { useState } from "react";
import { X, MapPin, Loader2 } from "lucide-react";
import LiveSeatMap, { type LiveSeat } from "@/components/LiveSeatMap";
import { useRealtimeSeats } from "@/hooks/useRealtimeSeats";

interface LocateSeatModalProps {
  libraryId: string;
  targetSeatId?: string | null;
  isFlexible?: boolean;
}

export default function LocateSeatModal({ libraryId, targetSeatId, isFlexible }: LocateSeatModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    library: {
      seats?: LiveSeat[] | null;
    };
    occupiedSeatIds: string[];
  } | null>(null);
  const realtimeOccupiedSeatIds = useRealtimeSeats(libraryId, data?.occupiedSeatIds || []);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setIsOpen(true);
    if (data) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/student/live-seats?libraryId=${libraryId}`,
      );
      const responseData = await response.json() as {
        error?: string;
        library: {
          seats?: LiveSeat[] | null;
        };
        occupiedSeatIds: string[];
      };
      if (responseData.error) throw new Error(responseData.error);
      setData(responseData);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the seat map",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => void handleOpen()}
        className="w-full text-foreground/80 hover:text-foreground text-sm font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-2 hover:bg-muted/50 border border-border"
      >
        <MapPin className="w-4 h-4" /> Locate My Seat
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-3xl border border-border shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-foreground">Live Seat Map</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFlexible ? "All green seats are currently available for you to use." : "Your reserved seat is highlighted in purple."}
                </p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-3 hover:bg-muted rounded-full transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                  <p className="text-sm font-bold">Loading live seat data...</p>
                </div>
              ) : error ? (
                <div className="py-20 text-center text-destructive">
                  <p className="font-bold">Error loading seat map</p>
                  <p className="text-sm opacity-80 mt-1">{error}</p>
                </div>
              ) : data ? (
                <LiveSeatMap 
                  library={data.library}
                  occupiedSeatIds={realtimeOccupiedSeatIds}
                  targetSeatId={targetSeatId}
                  isFlexible={isFlexible}
                  interactive={false}
                  compactMode={true}
                />
              ) : null}
            </div>
            
            <div className="p-6 border-t border-border bg-muted/30 rounded-b-3xl">
              <div className="flex flex-wrap gap-4 text-xs font-bold justify-center">
                {isFlexible ? (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-success"></div> Available (Flexible)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-muted border border-border/50"></div> Occupied / Reserved</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]"></div> Your Seat</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-muted border border-border/50"></div> Other Seats</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
