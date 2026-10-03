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

      // Write the unlock command to the ESP32
      const encoder = new TextEncoder();
      const tokenBuffer = encoder.encode("UNLOCK_IN");
      await characteristic.writeValue(tokenBuffer);

      // Also trigger a normal check-in to update the database
      fetch('/api/mobile/attendance/ble?readerId=87b99b2c-90fd-11e9-bc42-526af7764f64:1:1')
        .catch(console.error);

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
