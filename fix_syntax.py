
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Fix the duplicate else block
bad_block = """      }
      globalHttp.end(); // Keep this! It frees String buffers, but respects keep-alive because of setReuse(true)!
    } else {
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }

       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }"""

good_block = """      }
      globalHttp.end(); // Keep this! It frees String buffers, but respects keep-alive because of setReuse(true)!
    } else {
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }"""

text = text.replace(bad_block, good_block)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Syntax fixed!")

