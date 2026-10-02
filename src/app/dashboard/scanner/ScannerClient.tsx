"use client";

import { useState, useRef, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { Loader2, ScanLine, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/lib/firebase/clientApp";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export function ScannerClient({ libraryId }: { libraryId: string }) {
  const [isScanning, setIsScanning] = useState(false); 
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    studentName?: string;
    timestamp: Date;
  } | null>(null);

  const processingRef = useRef(false);

  // 1. Authenticate with Firebase and grab the Realtime token
  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          setSupabaseToken(idToken);
        } catch (err) {
          console.error("Failed to fetch Firebase ID token", err);
        }
      } else {
        setSupabaseToken(null);
        }
      });
    return () => unsubscribe();
  }, []);

  // 2. Listen to physical hardware (ESP32) scans in real-time via the authenticated private channel
  useEffect(() => {
    if (!supabaseUrl || !supabaseKey || !supabaseToken || !libraryId) return;
    
    supabase.realtime.setAuth(supabaseToken);

    const channel = supabase
      .channel(`library_scans:${libraryId}`, { config: { private: true } })
      .on(
        'broadcast',
        { event: 'scanner_update' },
        (payload) => {
          const tBroadcast = performance.now();
          const newData = payload.payload;
          console.log(`[T+${(tBroadcast - (window as any)._tScanStart || tBroadcast).toFixed(2)}ms] [${new Date().toISOString()}] Broadcast RECEIVED`, newData);
          
          // newData has: status, doorId, eventId, timestamp
          if (newData.doorId !== "WEB_SCANNER") {
            const isSuccess = newData.status === "CHECK_IN" || newData.status === "CHECK_OUT" || newData.status === "IN" || newData.status === "OUT" || newData.status === "ALLOW";
            
            console.log(`[T+${(performance.now() - (window as any)._tScanStart || performance.now()).toFixed(2)}ms] Before broadcast scanner state update (setLastResult)`);
            setLastResult({
              success: isSuccess,
              message: isSuccess ? `Successfully Checked ${newData.status}` : (newData.reason || "Access Denied"),
              studentName: "Hardware Scan", // minimal payload contains no PII
              timestamp: new Date(newData.timestamp)
            });
            console.log(`[T+${(performance.now() - (window as any)._tScanStart || performance.now()).toFixed(2)}ms] After broadcast scanner state update`);
            
            if (isSuccess) {
              toast.success(`Hardware Scan: Checked ${newData.status}!`);
              const audio = new Audio('/success-chime.mp3'); 
              audio.play().catch(() => {});
            } else {
              toast.error(newData.reason || "Hardware scan denied");
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error("Scanner realtime error:", err);
      
    return () => {
      supabase.removeChannel(channel);
      };
    });
  }, [libraryId, supabaseToken]);

  const startScanner = () => {
    setIsScanning(true);
    setLastResult(null);
    setCameraError(null);
  };

  const stopScanner = () => {
    setIsScanning(false);
  };

  const handleScan = async (result: any) => {
    const tScan = performance.now();
    (window as any)._tScanStart = tScan;
    console.log(`[T+0.00ms] [${new Date().toISOString()}] QR onScan callback fired`);

    if (!result || result.length === 0) return;
    const decodedText = result[0].rawValue;
    if (!decodedText) return;

    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    
      try {
        console.log(`[T+${(performance.now() - tScan).toFixed(2)}ms] processWebScan START`);
        
        // Start an interval to measure event loop lag
        let lastTick = performance.now();
        const intervalId = setInterval(() => {
          const now = performance.now();
          if (now - lastTick > 50) {
            console.warn(`[EVENT LOOP LAG] Main thread blocked for ${(now - lastTick).toFixed(2)}ms!`);
          }
          lastTick = now;
        }, 10);

        const p1 = performance.now();
        const response = await fetch(`/api/hardware/web-scan?qrText=${encodeURIComponent(decodedText)}&libraryId=${encodeURIComponent(libraryId)}&doorId=WEB_SCANNER`);
        const p2 = performance.now();
        console.log(`[T+${(performance.now() - tScan).toFixed(2)}ms] Fetch finished in ${(p2-p1).toFixed(2)}ms`);

        const res = await response.json();
        
        clearInterval(intervalId);
        
        console.log(`[T+${(performance.now() - tScan).toFixed(2)}ms] processWebScan END. Server reported:`, res._debug_timing);


      console.log(`[T+${(performance.now() - tScan).toFixed(2)}ms] Before action scanner state update (setLastResult)`);
        if (res.error) {
          toast.error(res.error);
          setLastResult({
            success: false,
            message: res.error,
            timestamp: new Date()
          });
        } else {
          const actionText = res.status === "CHECK_IN" ? "Checked In" : "Checked Out";
          toast.success(`${res.studentName} successfully ${actionText}!`);
          setLastResult({
            success: true,
            message: `Successfully ${actionText}`,
            studentName: res.studentName,
            timestamp: new Date()
          });
          // Play success sound
          const audio = new Audio('/success-chime.mp3'); 
          audio.play().catch(() => {});
        }
      console.log(`[T+${(performance.now() - tScan).toFixed(2)}ms] After action scanner state update`);
    } catch (error) {
      console.error("Scan error:", error);
      toast.error("Failed to process scan.");
    } finally {
      // Keep processing state true for a couple seconds to prevent rapid duplicate scans
      setTimeout(() => {
        setProcessing(false);
        processingRef.current = false;
      }, 3000);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" />
            Scanner Camera
          </h3>
          <p className="text-sm text-muted-foreground">
            Point the camera at the student's entry QR code.
          </p>
        </div>
        <div className="p-6 pt-0">
          {cameraError && (
            <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{cameraError}</p>
            </div>
          )}
          
          {!isScanning ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-lg bg-muted/30">
              <ScanLine className="w-12 h-12 text-muted-foreground mb-4" />
              <Button onClick={startScanner} size="lg" className="w-full sm:w-auto">
                Start Scanner
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border bg-black relative">
                 <Scanner 
                   onScan={handleScan}
                   onError={(e) => {
                     console.error("Scanner Error:", e);
                   }}
                   paused={false} /* DIAGNOSTIC: removed paused to test latency */
                   formats={["qr_code"]}
                   components={{
                     finder: false, // removes the red box for a cleaner view
                   }}
                   styles={{
                     container: { width: "100%", height: 300 }
                   }}
                 />
                 {processing && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                       <Loader2 className="w-8 h-8 animate-spin mb-2" />
                       <p className="font-medium">Processing...</p>
                    </div>
                 )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-muted-foreground">Processing scan...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-muted-foreground">Ready to scan</span>
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={stopScanner} disabled={processing}>
                  Stop Camera
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="font-semibold leading-none tracking-tight">Recent Scan Result</h3>
          <p className="text-sm text-muted-foreground">
            The outcome of the most recently scanned QR code will appear here.
          </p>
        </div>
        <div className="p-6 pt-0">
          {lastResult ? (
            <div className={cn(
              "flex flex-col items-center justify-center p-8 rounded-lg border text-center space-y-4",
              lastResult.success ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"
            )}>
              {lastResult.success ? (
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              ) : (
                <XCircle className="w-16 h-16 text-destructive" />
              )}
              
              <div>
                {lastResult.studentName && (
                  <h3 className="text-xl font-bold text-foreground">
                    {lastResult.studentName}
                  </h3>
                )}
                <p className={cn(
                  "font-medium mt-1",
                  lastResult.success ? "text-green-600 dark:text-green-400" : "text-destructive"
                )}>
                  {lastResult.message}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  {lastResult.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-muted-foreground">
              <p>No scans yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}







