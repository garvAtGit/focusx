import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Update the filter in setup()
content = content.replace(
    'String filter = "bleReaderId=eq." + String(READER_ID);',
    'String filter = "macAddress=eq." + String(READER_ID);'
)

# 2. Update HandleRealtimeChanges
new_handler = """volatile bool remoteOpenIn = false;
volatile bool remoteOpenOut = false;

void HandleRealtimeChanges(String result) {
  JsonDocument doc;
  deserializeJson(doc, result);
  String recordStr = doc["record"].as<String>();
  if (recordStr != "null") {
    String pendingCmd = doc["record"]["pendingCommand"].as<String>();
    if (pendingCmd == "factory_reset") {
      WiFiManager wm;
      wm.resetSettings();
      preferences.begin("focusx", false);
      preferences.clear();
      preferences.end();
      ESP.restart();
    } else if (pendingCmd == "open_in") {
      remoteOpenIn = true;
      // Clear the command
      if (WiFi.status() == WL_CONNECTED) {
        NetworkClientSecure client; client.setInsecure();
        HTTPClient http;
        http.begin(client, String(SUPABASE_URL) + "/rest/v1/Relay?macAddress=eq." + String(READER_ID));
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
        http.addHeader("Content-Type", "application/json");
        http.PATCH("{\\\"pendingCommand\\\": null}");
        http.end();
      }
    } else if (pendingCmd == "open_out") {
      remoteOpenOut = true;
      if (WiFi.status() == WL_CONNECTED) {
        NetworkClientSecure client; client.setInsecure();
        HTTPClient http;
        http.begin(client, String(SUPABASE_URL) + "/rest/v1/Relay?macAddress=eq." + String(READER_ID));
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
        http.addHeader("Content-Type", "application/json");
        http.PATCH("{\\\"pendingCommand\\\": null}");
        http.end();
      }
    }
  }
}
"""
content = re.sub(r'void HandleRealtimeChanges\(String result\) \{.*?\n  \}\n\}', new_handler, content, flags=re.DOTALL)

# 3. Add loop handler for remoteOpen
loop_handler = """  if (remoteOpenIn || remoteOpenOut) {
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

  if (!isGateOpen && doorState == LOW) {"""
content = content.replace('  if (!isGateOpen && doorState == LOW) {', loop_handler, 1)

# 4. We need to disable the NimBLE bug workaround from earlier if it was overwritten!
# Actually, wait, `write_v5.py` doesn't have the NimBLE stuff! It just has the old BLE.
# Is that okay? We should restore `m_beacon_data` to bypass the minor ID issue!
content = content.replace('m_beacon_data[22] = 0xBE;', 'm_beacon_data[22] = 0x00;\n  m_beacon_data[23] = 0x01;')

with open(file_path, 'w') as f:
    f.write(content)
