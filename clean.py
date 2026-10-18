
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r", encoding="utf-8") as f:
    lines = f.readlines()

out = []
in_prototypes = False
for line in lines:
    if "String generateStrongEventId();" in line:
        in_prototypes = True
    if in_prototypes and line.strip() == "void startAuthorization(String payload, String scanType);":
        in_prototypes = False
        continue
    if not in_prototypes:
        out.append(line)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w", encoding="utf-8") as f:
    f.writelines(out)
print("Cleaned prototypes!")

