
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

text = text.replace(
    """        http.addHeader("Content-Type", "application/json");\n        http.addHeader("Host", "www.focusx.in");""",
    """        http.addHeader("Content-Type", "application/json");"""
)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Removed Host header!")

