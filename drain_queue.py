import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Replace doAuth to drain the queue before sending
old_doAuth = '''void doAuth(String uid, bool isExit) {
  setLEDsColor(255, 255, 0); // Yellow
  if (isExit) setRFID2StripColor(255, 255, 0);
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("AUTHORIZING...");
  
  AuthRequest req;'''

new_doAuth = '''void doAuth(String uid, bool isExit) {
  setLEDsColor(255, 255, 0); // Yellow
  if (isExit) setRFID2StripColor(255, 255, 0);
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("AUTHORIZING...");
  
  // DRAIN STALE RESPONSES FROM TIMEOUTS
  AuthResponse staleRes;
  while(xQueueReceive(authResponseQueue, &staleRes, 0) == pdPASS) {}
  
  AuthRequest req;'''

content = content.replace(old_doAuth, new_doAuth)

with open(file_path, 'w') as f:
    f.write(content)
