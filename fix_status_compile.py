
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

text = text.replace(
    """          if(client) {\n              delete client;\n          }\n          vTaskDelete(NULL);""",
    """          vTaskDelete(NULL);"""
)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Fixed status compile error!")

