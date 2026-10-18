import re

path = r'src\app\api\hardware\scan\route.ts'
with open(path, 'r', encoding='utf-8') as f:
    t = f.read()

old = "where: { bleReaderId: readerId }"
new = "where: { OR: [{ bleReaderId: readerId }, { macAddress: readerId }] }"

if old in t:
    t = t.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(t)
    print("Fixed!")
else:
    print("Could not find the target string.")
