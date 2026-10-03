import sys
import re

file_path = r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\src\lib\attendance-core.ts'

with open(file_path, 'r') as f:
    content = f.read()

replacement = """    if (relayId) {
      const command = txResult.newStatus === "CHECK_IN" ? "open_in" : "open_out";
      try {
        await prisma.relay.update({
          where: { id: relayId },
          data: { pendingCommand: command }
        });
      } catch (e) {
        console.error("[processAttendanceIntent] Set pendingCommand failed:", e);
      }
    }

    return { 
      success: true, """

content = content.replace("    return { \n      success: true, \n      status: txResult.newStatus,", replacement + "\n      status: txResult.newStatus,")

with open(file_path, 'w') as f:
    f.write(content)
