
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

pattern = re.compile(r"(  // 5\. BLE \(Immediate Independent Startup\).*?while\(true\) delay\(100\);\n  }\n)", re.DOTALL)
match = pattern.search(text)

if match:
    block = match.group(1)
    text = text.replace(block, "")
    text = text.replace("updateLCD(\"SYSTEM READY\", \"\");\n  delay(1000);", f"updateLCD(\"SYSTEM READY\", \"\");\n  delay(1000);\n\n{block}")
    with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
        f.write(text)
    print("Fixed!")
else:
    print("Not found")

