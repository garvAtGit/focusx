
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

text = text.replace(
    """snprintf(res.message, sizeof(res.message)-1, "HTTP %d", httpCode);""",
    """String errStr = http.errorToString(httpCode);\n              snprintf(res.message, sizeof(res.message)-1, "%s", errStr.c_str());"""
)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Updated to show human readable string!")

