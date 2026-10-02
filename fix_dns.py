
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

text = text.replace(
    """const char* API_URL = "http://www.focusx.in/api/hardware/scan";""",
    """const char* API_URL = "http://76.76.21.21/api/hardware/scan"; // VERCEL IP TEST"""
)

text = text.replace(
    """            http.addHeader("Content-Type", "application/json");""",
    """            http.addHeader("Content-Type", "application/json");\n            http.addHeader("Host", "www.focusx.in");"""
)


with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("DNS Bypass applied!")

