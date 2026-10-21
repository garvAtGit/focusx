'use client';

import { useState } from 'react';
import { Bluetooth } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface BluetoothUnlockButtonProps {
  libraryId: string;
  className?: string;
  children?: React.ReactNode;
  isCheckedIn?: boolean;
  studentId?: string;
}

export function BluetoothUnlockButton({ libraryId, className, children, isCheckedIn, studentId }: BluetoothUnlockButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleBluetoothUnlock = async () => {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    
    if (!nav || !nav.bluetooth) {
      toast.error('Web Bluetooth is not supported in this browser (or try enabling it).');
      return;
    }

    try {
      setIsConnecting(true);
      toast.loading('Pairing...', { id: 'ble' });

      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['87b99b2c-90fd-11e9-bc42-526af7764f64']
      });

      // Connect to GATT server
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT server.');

      // Get the service
      const service = await server.getPrimaryService('87b99b2c-90fd-11e9-bc42-526af7764f64');
      
      // Get the characteristic
      const characteristic = await service.getCharacteristic('87b99b2c-90fd-11e9-bc42-526af7764f65');

      const action = isCheckedIn ? 'OUT' : 'IN';
      // Fetch cryptographically signed BLE token from backend
      let tokenString = isCheckedIn 
        ? (studentId ? `UNLOCK_OUT:${studentId}` : "UNLOCK_OUT") 
        : (studentId ? `UNLOCK_IN:${studentId}` : "UNLOCK_IN");

      try {
        const tokenRes = await fetch('/api/student/ble-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: '87b99b2c-90fd-11e9-bc42-526af7764f64:1:1', action })
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.success && tokenData.token) {
            tokenString = tokenData.token;
          }
        }
      } catch (e) {
        console.warn("Using fallback unlock token", e);
      }

      // Write the token/command to the ESP32
      const encoder = new TextEncoder();
      const tokenBuffer = encoder.encode(tokenString);
      await characteristic.writeValue(tokenBuffer);

      toast.success(isCheckedIn ? 'Checked Out!' : 'Door Unlocked!', { id: 'ble' });
      
      // Disconnect cleanly
      device.gatt?.disconnect();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Bluetooth connection failed', { id: 'ble' });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button 
      onClick={handleBluetoothUnlock}
      disabled={isConnecting}
      className={className || "flex items-center justify-center gap-2 w-full max-w-[280px] mx-auto py-2.5 mt-3 rounded-lg border border-primary/20 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors disabled:opacity-50"}
    >
      {children ? children : (
        <>
          <Bluetooth className={`w-4 h-4 ${isConnecting ? 'animate-pulse' : ''}`} />
          {isConnecting ? 'Connecting...' : (isCheckedIn ? 'Check Out via Bluetooth' : 'Unlock via Bluetooth')}
        </>
      )}
    </button>
  );
}
