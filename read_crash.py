import serial
import time

try:
    # Disable DTR/RTS so opening the port doesn't reset the board!
    ser = serial.Serial()
    ser.port = 'COM12'
    ser.baudrate = 115200
    ser.setDTR(False)
    ser.setRTS(False)
    ser.open()
    
    print("Listening on COM12 for 45s...")
    start_time = time.time()
    
    while time.time() - start_time < 45:
        if ser.in_waiting > 0:
            line = ser.readline()
            print(line.decode('utf-8', errors='replace').strip(), flush=True)
        else:
            time.sleep(0.1)
            
    ser.close()
except Exception as e:
    print(f"Error: {e}")
