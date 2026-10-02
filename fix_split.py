
import re
with open(r"src\app\dashboard\students\StudentsClient.tsx", "r") as f:
    text = f.read()

text = text.replace(
    """log.reason?.split(":")[1]?.trim() ?? null""",
    """log.reason?.replace("Unregistered RFID:", "").trim() ?? null"""
)

with open(r"src\app\dashboard\students\StudentsClient.tsx", "w") as f:
    f.write(text)
print("Split fixed!")

