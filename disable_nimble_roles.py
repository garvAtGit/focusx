import sys
import re

file_path = r'C:\Users\thees\Documents\Arduino\libraries\NimBLE-Arduino\src\nimconfig.h'

with open(file_path, 'r') as f:
    content = f.read()

# Disable roles
content = content.replace('#define CONFIG_BT_NIMBLE_ROLE_CENTRAL 1', '#define CONFIG_BT_NIMBLE_ROLE_CENTRAL 0')
content = content.replace('#define CONFIG_BT_NIMBLE_ROLE_OBSERVER 1', '#define CONFIG_BT_NIMBLE_ROLE_OBSERVER 0')
content = content.replace('#define CONFIG_BT_NIMBLE_ROLE_PERIPHERAL 1', '#define CONFIG_BT_NIMBLE_ROLE_PERIPHERAL 0')

with open(file_path, 'w') as f:
    f.write(content)
