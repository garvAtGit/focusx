'use client';

import { useState } from 'react';
import { Bluetooth } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface BluetoothUnlockButtonProps {
  libraryId: string;
}

export function BluetoothUnlockButton({ libraryId }: BluetoothUnlockButtonProps) {
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

      // Request a Bluetooth device (filtering by service UUID is more reliable)
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b'] }],
        optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
      });

      // Connect to GATT server
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT server.');

      // Get the service
      const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
      
      // Get the characteristic
      const characteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

      // Fetch the signed token from our backend
      const res = await fetch('/api/student/ble-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get token');

      // Write the token to the ESP32
      const encoder = new TextEncoder();
      const tokenBuffer = encoder.encode(data.token);
      await characteristic.writeValue(tokenBuffer);

      toast.success('Door Unlocked!', { id: 'ble' });
      
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
      className="flex items-center justify-center gap-2 w-full max-w-[280px] mx-auto py-2.5 mt-3 rounded-lg border border-primary/20 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors disabled:opacity-50"
    >
      <Bluetooth className={`w-4 h-4 ${isConnecting ? 'animate-pulse' : ''}`} />
      {isConnecting ? 'Connecting...' : 'Unlock via Bluetooth'}
    </button>
  );
}
