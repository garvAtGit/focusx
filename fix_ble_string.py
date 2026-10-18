import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r') as f:
    content = f.read()

# Fix BLEAdvertisementData addData by using std::string which is what write_v5.py originally had!
# Wait, write_v5.py originally had:
# std::string strServiceData = "";
# for (int i = 0; i < 25; i++) strServiceData += (char)m_beacon_data[i];
# oAdvertisementData.addData(strServiceData);

# But the compiler said: no matching function for call to 'BLEAdvertisementData::addData(std::string&)'
# Candidate: void BLEAdvertisementData::addData(String data);
# Candidate: void BLEAdvertisementData::addData(char *data, size_t length);

# Let's just use the char* overload!
new_add_data = "  oAdvertisementData.addData((char*)m_beacon_data, 25);"

content = re.sub(r'  std::string strServiceData = "";\n  for \(int i = 0; i < 25; i\+\+\) strServiceData \+= \(char\)m_beacon_data\[i\];\n  oAdvertisementData\.addData\(strServiceData\);', new_add_data, content)
content = re.sub(r'  std::string strServiceData = "";\n  for \(int i = 0; i < 25; i\+\+\) strServiceData \+= \(char\)m_beacon_data\[i\];\n  oAdvertisementData\.addData\(strServiceData\);', new_add_data, content)

with open(file_path, 'w') as f:
    f.write(content)
