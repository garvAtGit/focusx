import sys

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\FocusX_Scanner_Firmware_V5_DualRFID\FocusX_Scanner_Firmware_V5_DualRFID.ino'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('// DO NOT CALL vercelHttp.end() IF REUSING!', 'vercelHttp.end();')
content = content.replace('// DO NOT CALL supabaseHttp.end() IF REUSING!', 'supabaseHttp.end();')

# Fix the httpPatch issue inside the remoteOpenIn logic where it tries to reuse the SAME supabaseClient while supabaseHttp is technically still active!
# Actually, since we now call supabaseHttp.end() AFTER the block, it IS still active!
# To fix this, I will just make httpPatch use its own client!
content = content.replace('HTTPClient httpPatch;\n                  if (httpPatch.begin(supabaseClient, patchUrl)) {', 'WiFiClientSecure patchClient; patchClient.setInsecure(); HTTPClient httpPatch;\n                  if (httpPatch.begin(patchClient, patchUrl)) {')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
