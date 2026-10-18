
import re

with open(r"C:\Users\thees\AppData\Local\arduino\sketches\05940FF73055C874C3FF5C9F6131074A\sketch\esp32_unified_hardware.ino.cpp", "r", encoding="utf-8") as f:
    text = f.read()

# Remove #line directives
text = re.sub(r"^#line.*?\n", "", text, flags=re.MULTILINE)
text = text.replace("#include <Arduino.h>\n", "")

# Arduino CLI adds prototypes between the first #include and the first real code block.
# I will just write it to the .ino file and we can manually check it.
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w", encoding="utf-8") as f:
    f.write(text)
print("Restored from cache!")

