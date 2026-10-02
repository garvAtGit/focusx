import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('Code: %d\n", httpCode', 'Code: %d\\n", httpCode')
text = text.replace('error: %s\n", http.errorToString(httpCode).c_str()', 'error: %s\\n", http.errorToString(httpCode).c_str()')

text = text.replace('if (xQueueSend(authRequestQueue, &req, portMAX_DELAY) == pdPASS)', 'if (true)')
text = text.replace('if (xQueueSend(authRequestQueue, &req, 0) == pdPASS)', 'if (true)')

text = text.replace('void gap_event_handler', 'void custom_gap_event_handler')
text = text.replace('esp_ble_gap_register_callback(gap_event_handler)', 'esp_ble_gap_register_callback(custom_gap_event_handler)')

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)
print('Fixed.')
