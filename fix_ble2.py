import os

p = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'
with open(p, 'r') as f:
    c = f.read()

c = c.replace('#include <BLEDevice.h>', '#include <esp_bt.h>\n#include <esp_bt_main.h>\n#include <esp_gap_ble_api.h>')
c = c.replace('#include <BLEUtils.h>', '')
c = c.replace('#include <BLEServer.h>', '')
c = c.replace('#include <BLEBeacon.h>', '')
c = c.replace('#include <BLEAdvertising.h>', '')

init_code = """
  esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
  esp_bt_controller_init(&bt_cfg);
  esp_bt_controller_enable(ESP_BT_MODE_BLE);
  esp_bluedroid_init();
  esp_bluedroid_enable();
"""
c = c.replace('BLEDevice::init("FocusX_Beacon");', init_code)

with open(p, 'w') as f:
    f.write(c)
