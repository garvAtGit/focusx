
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

text = re.sub(r"void httpWorkerTask\(void \*pvParameters\) \{[\s\S]*?vTaskDelay\(10\);\n  \}\n\}", "", text)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Worker task removed!")

