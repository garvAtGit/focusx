
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Disable the StatusPing to prevent TLS collision
text = text.replace(
    "if (millis() - lastStatusPing > 60000) {",
    "if (false) { // Disabled to prevent TLS memory collision"
)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Disabled status ping collision!")

