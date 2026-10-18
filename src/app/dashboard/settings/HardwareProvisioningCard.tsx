"use client";

import { useState } from "react";
import { QrCode, Loader2, Wifi } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QRCode from "react-qr-code";
import { generateProvisioningQR } from "@/app/actions/hardware-actions";

export function HardwareProvisioningCard({ libraryId }: { libraryId: string }) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!ssid) {
      setError("Wi-Fi SSID is required.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setQrPayload(null);

    try {
      const res = await generateProvisioningQR(libraryId, ssid, password);
      if (res.error) {
        setError(res.error);
      } else if (res.qrPayload) {
        setQrPayload(res.qrPayload);
      }
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : "Failed to generate QR");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
      <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Wifi className="w-5 h-5 text-primary" /> Hardware Scanner Provisioning
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Generate a secure QR code to automatically configure your physical ESP32 scanner. 
        When you scan this code with the GM67 scanner, the ESP32 will connect to this Wi-Fi network and bind itself to this library.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Wi-Fi Network Name (SSID) *</Label>
            <Input 
              value={ssid} 
              onChange={(e) => setSsid(e.target.value)} 
              placeholder="e.g., FocusDesk_5G" 
            />
          </div>
          <div className="space-y-2">
            <Label>Wi-Fi Password</Label>
            <Input 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Leave blank if open network" 
              type="password"
            />
          </div>
          
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !ssid}
            className="w-full bg-secondary text-secondary-foreground font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
            Generate Provisioning QR
          </button>
        </div>

        <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 bg-muted/20">
          {qrPayload ? (
            <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
              <div className="p-4 bg-white rounded-xl shadow-sm">
                <QRCode value={qrPayload} size={200} />
              </div>
              <p className="text-xs text-muted-foreground text-center font-medium max-w-[200px]">
                Scan this code with the scanner connected to your ESP32.
              </p>
            </div>
          ) : (
            <div className="text-center space-y-3 opacity-50">
              <QrCode className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">QR Code will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
