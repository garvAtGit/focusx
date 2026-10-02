
import re

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "r") as f:
    text = f.read()

# The block to move up
queue_block = """  // 6. FREERTOS TASK QUEUES (Length 1)
  authRequestQueue = xQueueCreate(1, sizeof(AuthRequest));
  authResponseQueue = xQueueCreate(1, sizeof(AuthResponse));
  
  if (!authRequestQueue || !authResponseQueue) {
    Serial.println("[ERROR] Failed to create FreeRTOS queues! Halting.");
    updateLCD("SYS HALT", "MEM ERROR");
    while(true) delay(100);
  }"""

# Remove it from the bottom
text = text.replace(queue_block, "")

# The target to insert before
target = """  BaseType_t taskStatus = xTaskCreatePinnedToCore("""

# Insert it before the target
text = text.replace(target, queue_block + "\n\n" + target)

with open(r"C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino", "w") as f:
    f.write(text)
print("Fixed queues!")

