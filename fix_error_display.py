
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Change the generic NETWORK ERROR to show the actual error message
text = text.replace(
    """    if (pendingRetry) {\n      updateLCD("NETWORK ERROR", "TAP TO RETRY");\n      return;\n    }""",
    """    if (pendingRetry) {\n      updateLCD("OFFLINE RETRY", "TAP TO RETRY");\n      return;\n    }"""
)

text = text.replace(
    """      Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);\n      pendingRetry = true; \n      pendingRetryTimestamp = millis(); // Snapshot time of failure\n      updateLCD("NETWORK ERROR", "TAP TO RETRY");""",
    """      Serial.printf("[HTTP] NETWORK OR SERVER ERROR: %s\\n", res.message);\n      pendingRetry = true; \n      pendingRetryTimestamp = millis(); // Snapshot time of failure\n      updateLCD("NETWORK ERROR", res.message);"""
)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Fixed error display!")

