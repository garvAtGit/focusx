import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Add global variables
globals_code = """
volatile bool remoteOpenIn = false;
volatile bool remoteOpenOut = false;
"""
content = re.sub(r'(QueueHandle_t authResponseQueue;\s*)', r'\1' + globals_code, content)

# Add pollCommandTask
task_code = """
void pollCommandTask(void *pvParameters) {
  while (true) {
    if (WiFi.status() == WL_CONNECTED && String(READER_ID) != "") {
      NetworkClientSecure client;
      client.setInsecure();
      HTTPClient http;
      String url = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID) + "&select=pendingCommand";
      http.begin(client, url);
      http.addHeader("apikey", SUPABASE_ANON_KEY);
      http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
      http.addHeader("Content-Type", "application/json");
      
      int httpCode = http.GET();
      if (httpCode >= 200 && httpCode < 300) {
        String res = http.getString();
        if (res.indexOf("open_in") != -1) {
          remoteOpenIn = true;
        } else if (res.indexOf("open_out") != -1) {
          remoteOpenOut = true;
        }
        
        if (remoteOpenIn || remoteOpenOut) {
          // Clear the command
          HTTPClient patchHttp;
          String patchUrl = String(SUPABASE_URL) + "/rest/v1/Relay?bleReaderId=eq." + String(READER_ID);
          patchHttp.begin(client, patchUrl);
          patchHttp.addHeader("apikey", SUPABASE_ANON_KEY);
          patchHttp.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
          patchHttp.addHeader("Content-Type", "application/json");
          patchHttp.addHeader("Prefer", "return=minimal");
          patchHttp.PATCH("{\\\"pendingCommand\\\": null}");
          patchHttp.end();
        }
      }
      http.end();
    }
    vTaskDelay(1500 / portTICK_PERIOD_MS); // poll every 1.5 seconds
  }
}
"""
content = re.sub(r'void httpWorkerTask\(void \*pvParameters\) \{', task_code + '\nvoid httpWorkerTask(void *pvParameters) {', content)

# Start the task in setup
setup_task = """
  xTaskCreatePinnedToCore(httpWorkerTask, "HTTP Worker", 8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(pollCommandTask, "Poll Command", 8192, NULL, 1, NULL, 0);
"""
content = re.sub(r'xTaskCreatePinnedToCore\(httpWorkerTask,\s*"HTTP Worker",\s*8192,\s*NULL,\s*1,\s*NULL,\s*0\);', setup_task, content)

# Check for remote commands in loop
loop_code = """
  if (remoteOpenIn || remoteOpenOut) {
    bool isExitCmd = remoteOpenOut;
    remoteOpenIn = false;
    remoteOpenOut = false;
    
    isGateOpen = true;
    gateOpenStartTime = millis();
    hasDoorOpenedDuringGrace = false;
    openedByRFID2 = isExitCmd;
    
    if (isExitCmd) {
      setLEDsColor(255, 80, 0);
      setRFID2StripColor(0, 255, 0);
      userIsInside = false;
      lcd.clear(); lcd.setCursor(0,0); lcd.print("GOODBYE!");
      lcd.setCursor(0,1); lcd.print("GATE OPEN");
      playGoodbyeChime();
    } else {
      setLEDsColor(0, 255, 0);
      userIsInside = true;
      lcd.clear(); lcd.setCursor(0,0); lcd.print("WELCOME!");
      lcd.setCursor(0,1); lcd.print("GATE OPEN");
      playWelcomeChime();
    }
  }

  if (!isGateOpen && doorState == LOW) {
"""
content = re.sub(r'if \(!isGateOpen && doorState == LOW\) \{', loop_code, content)

with open(file_path, 'w') as f:
    f.write(content)
