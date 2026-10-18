import serial
import time
import sys

try:
    ser = serial.Serial('COM12', 115200, timeout=1)
    print("Reading COM12 for 30s...")
    start_time = time.time()
    while time.time() - start_time < 30:
        line = ser.readline()
        if line:
            sys.stdout.write(line.decode('utf-8', errors='ignore'))
            sys.stdout.flush()
except Exception as e:
    print("Error:", e)
