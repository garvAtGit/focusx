import re

with open("FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino", "r") as f:
    content = f.read()

fix = """    pAdvertising->setAdvertisementData(oAdvertisementData);
    
    // Add the Service UUID to the Scan Response so phones can discover the GATT server!
    NimBLEAdvertisementData oScanResponseData = NimBLEAdvertisementData();
    oScanResponseData.setCompleteServices(NimBLEUUID(SERVICE_UUID));
    oScanResponseData.setName("FocusX");
    pAdvertising->setScanResponseData(oScanResponseData);
    
    pAdvertising->start();"""

content = content.replace("    pAdvertising->setAdvertisementData(oAdvertisementData);\n    pAdvertising->start();", fix)

with open("FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino", "w") as f:
    f.write(content)
print("Patched Scan Response!")
