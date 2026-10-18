
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

text = text.replace(
    "if (pendingRetry) {\n    updateLCD(\"NET ERROR\", res.message);\n    return;\n  }",
    "if (pendingRetry) {\n    updateLCD(\"NET ERROR\", \"TAP TO RETRY\");\n    return;\n  }"
)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Reverted scope error!")

