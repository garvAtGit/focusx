
import re
with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# Make sure globalHttp uses keep-alive
scan_body = """
  if (WiFi.status() == WL_CONNECTED) {
    globalClient.setInsecure();
    globalHttp.setReuse(true);
    if (globalHttp.begin(globalClient, API_URL)) {
      globalHttp.addHeader("Content-Type", "application/json");
      globalHttp.addHeader("Authorization", String("Bearer ") + HARDWARE_API_KEY);
      // Remove Connection: close so we keep the TLS connection alive!
      globalHttp.setTimeout(15000);
"""

text = re.sub(r"  if \(WiFi\.status\(\) == WL_CONNECTED\) \{.*?globalHttp\.setTimeout\(15000\);", scan_body, text, flags=re.DOTALL)

# Remove globalClient.stop() because we want to keep it alive!
scan_end = """
      }
      // Do NOT call globalClient.stop() so the TLS socket stays alive for the next tap!
    } else {
       strncpy(res.message, "HTTP SETUP FAIL", sizeof(res.message)-1); res.message[sizeof(res.message)-1] = 0;
    }
"""

text = re.sub(r"      \}\s*globalHttp\.end\(\);\s*globalClient\.stop\(\);\s*\} else \{.*?\}", scan_end, text, flags=re.DOTALL)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Reuse injected!")

