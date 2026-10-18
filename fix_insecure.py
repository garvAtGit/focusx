
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Replace setCACert with setInsecure to completely bypass TLS validation failures and save heap
text = text.replace("client.setCACert(rootCACertificate); // Strict TLS Validation", "client.setInsecure();")
text = text.replace("client.setCACert(rootCACertificate);", "client.setInsecure();")

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Set to insecure!")

