
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Restore globalHttp.end()
scan_end = """
      }
      globalHttp.end(); // Keep this! It frees String buffers, but respects keep-alive because of setReuse(true)!
    } else {
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }
"""

text = re.sub(r"      \}\s*// Do NOT call globalClient\.stop\(\) so the TLS socket stays alive for the next tap!\s*\} else \{", scan_end, text, flags=re.DOTALL)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("End restored!")

