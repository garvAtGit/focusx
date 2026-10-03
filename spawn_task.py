import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Add pollCommandTask to setup()
content = content.replace('xTaskCreatePinnedToCore(httpWorkerTask, "HTTP", 8192, NULL, 1, NULL, 0);', 
                          'xTaskCreatePinnedToCore(httpWorkerTask, "HTTP", 8192, NULL, 1, NULL, 0);\n  xTaskCreatePinnedToCore(pollCommandTask, "Poll", 8192, NULL, 1, NULL, 0);')

with open(file_path, 'w') as f:
    f.write(content)
