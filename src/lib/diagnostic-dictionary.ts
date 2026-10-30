/**
 * FocusX Hardware Diagnostic Event Dictionary
 * Translates low-level diagnostic event codes, severities, and numeric parameters
 * into plain-English, human-readable titles, sentences, and formatted units.
 */

export interface TranslatedDiagnostic {
  title: string;
  category: "SYSTEM" | "READER" | "STORAGE" | "SNAPSHOT" | "NETWORK" | "SECURITY" | "GATE";
  explanation: string;
  param1Label?: string;
  param1Formatted?: string;
  param2Label?: string;
  param2Formatted?: string;
  recommendedAction?: string;
}

export function translateResetReasonCode(code: number): string {
  switch (code) {
    case 1:
      return "Power-On Reset (Cold boot)";
    case 2:
      return "OTA Software Reset (Clean restart)";
    case 3:
      return "Deep Sleep Wakeup";
    case 4:
      return "Task Watchdog Timer (TWDT recovery)";
    case 5:
      return "Brownout Reset (Voltage dip recovery)";
    case 6:
      return "Software CPU Reset";
    case 7:
      return "Core Panic Reset";
    default:
      return `Reset Type #${code}`;
  }
}

export function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function translateDiagnosticEvent(
  eventCode: number,
  severity: string,
  param1: number | null,
  param2: number | null,
  detail?: string | null
): TranslatedDiagnostic {
  switch (eventCode) {
    // 1000 - 1099: System & Boot Lifecycle
    case 1000:
      return {
        title: "System Boot Initialization Complete",
        category: "SYSTEM",
        explanation: "Machine booted cleanly, initialized FreeRTOS cores, and entered attendance standby.",
        param1Label: "Boot Count",
        param1Formatted: param1 !== null ? `#${param1}` : undefined,
        param2Label: "Free RAM",
        param2Formatted: param2 !== null ? formatBytes(param2) : undefined,
        recommendedAction: "System healthy; no action needed.",
      };

    case 1001: {
      const resetDesc = param1 !== null ? translateResetReasonCode(param1) : "Software Reset";
      return {
        title: `Machine Restart (${resetDesc})`,
        category: "SYSTEM",
        explanation: `Device initiated a restart. Cause: ${resetDesc}. Attendance state was safely persisted prior to reboot.`,
        param1Label: "Reboot Trigger",
        param1Formatted: resetDesc,
        param2Label: "Free RAM at Boot",
        param2Formatted: param2 !== null ? formatBytes(param2) : undefined,
        recommendedAction: param1 === 5 ? "Check 12V/5V power adapter voltage under load." : "Normal operation.",
      };
    }

    case 1002:
      return {
        title: "Task Watchdog Supervisor Trip (TWDT)",
        category: "SYSTEM",
        explanation: "A non-critical background task was unresponsive; watchdog recovered the processor cleanly without losing attendance records.",
        param1Label: "Triggering Core/Task",
        param1Formatted: param1 !== null ? `Core ${param1}` : "Background Task",
        param2Label: "Uptime Before Reset",
        param2Formatted: param2 !== null ? `${Math.floor(param2 / 1000)} seconds` : undefined,
        recommendedAction: "Verify Wi-Fi signal strength and network latency.",
      };

    case 1003:
      return {
        title: "Low Free RAM Warning",
        category: "SYSTEM",
        explanation: "Internal heap memory dipped below the safety margin of 50 KB. Background caches were purged.",
        param1Label: "Minimum Heap Seen",
        param1Formatted: param1 !== null ? formatBytes(param1) : undefined,
        param2Label: "Current Heap Available",
        param2Formatted: param2 !== null ? formatBytes(param2) : undefined,
        recommendedAction: "Monitor memory trend; firmware auto-protects against OOM.",
      };

    // 2000 - 2099: RFID & PN532 Sensor Subsystem
    case 2000:
      return {
        title: "Entry Reader (PN532 #1) Timeout",
        category: "READER",
        explanation: "The RFID Entry reader did not respond over the SPI/I2C bus within the expected window. An automated bus reset was performed.",
        param1Label: "Consecutive Timeouts",
        param1Formatted: param1 !== null ? `${param1} retries` : undefined,
        param2Label: "Bus Status Code",
        param2Formatted: param2 !== null ? `0x${param2.toString(16).toUpperCase()}` : undefined,
        recommendedAction: "Check wiring harness on Reader 1 (Entry reader).",
      };

    case 2001:
      return {
        title: "Exit Reader (PN532 #2) Timeout",
        category: "READER",
        explanation: "The RFID Exit reader did not respond over the SPI/I2C bus within the expected window. An automated bus reset was performed.",
        param1Label: "Consecutive Timeouts",
        param1Formatted: param1 !== null ? `${param1} retries` : undefined,
        param2Label: "Bus Status Code",
        param2Formatted: param2 !== null ? `0x${param2.toString(16).toUpperCase()}` : undefined,
        recommendedAction: "Check wiring harness on Reader 2 (Exit reader).",
      };

    case 2002:
      return {
        title: "Reader Bus Mutex Contention",
        category: "READER",
        explanation: "Simultaneous card reads on Entry and Exit readers occurred within milliseconds. Both events were safely serialized.",
        param1Label: "Mutex Wait Time",
        param1Formatted: param1 !== null ? `${param1} ms` : undefined,
        recommendedAction: "Normal concurrent usage; no action needed.",
      };

    case 2003:
      return {
        title: "RFID Reader Hardware Init Failure",
        category: "READER",
        explanation: "A PN532 RFID reader failed firmware handshake check during boot or hot-reset.",
        param1Label: "Affected Reader",
        param1Formatted: param1 === 1 ? "Reader 1 (Entry)" : param1 === 2 ? "Reader 2 (Exit)" : `Reader #${param1}`,
        param2Label: "Hardware Error",
        param2Formatted: param2 !== null ? `Err ${param2}` : undefined,
        recommendedAction: "Inspect ribbon cables and solder joints on the PN532 board.",
      };

    // 3000 - 3099: Offline Storage & LittleFS
    case 3000:
      return {
        title: "LittleFS Storage Space Warning",
        category: "STORAGE",
        explanation: "Offline flash storage space is running low (< 50 KB free). Automatic compaction was triggered.",
        param1Label: "Free Storage",
        param1Formatted: param1 !== null ? formatBytes(param1) : undefined,
        param2Label: "Total Capacity",
        param2Formatted: param2 !== null ? formatBytes(param2) : undefined,
        recommendedAction: "Ensure the machine connects to Wi-Fi to sync pending offline attendance journals.",
      };

    case 3001:
      return {
        title: "Storage Write Guard Engaged",
        category: "STORAGE",
        explanation: "Flash storage is below the critical threshold (< 30 KB). Non-essential diagnostic logs are kept in RAM only.",
        param1Label: "Remaining Bytes",
        param1Formatted: param1 !== null ? formatBytes(param1) : undefined,
        recommendedAction: "Sync attendance events immediately to free journal flash sectors.",
      };

    // 4000 - 4099: Snapshot Authorization Cache
    case 4000:
      return {
        title: "Snapshot Integrity Warning",
        category: "SNAPSHOT",
        explanation: "Downloaded student authorization snapshot failed checksum or schema validation. Safe fallback snapshot retained.",
        param1Label: "Expected Revision",
        param1Formatted: param1 !== null ? `Rev ${param1}` : undefined,
        param2Label: "Observed Revision",
        param2Formatted: param2 !== null ? `Rev ${param2}` : undefined,
        recommendedAction: "Trigger a remote snapshot sync from the admin dashboard.",
      };

    // 5000 - 5099: Networking & Cloud Connectivity
    case 5000:
      return {
        title: "Wi-Fi Disconnected",
        category: "NETWORK",
        explanation: "Local Wi-Fi access point disconnected. Scanner entered 100% autonomous offline mode; card taps continue without delay.",
        param1Label: "Disconnect Reason",
        param1Formatted: param1 !== null ? `Code ${param1}` : undefined,
        param2Label: "Last RSSI",
        param2Formatted: param2 !== null ? `${param2} dBm` : undefined,
        recommendedAction: "Check library router and Wi-Fi signal coverage at the turnstile.",
      };

    case 5001:
      return {
        title: "Wi-Fi Link Restored",
        category: "NETWORK",
        explanation: "Wi-Fi link reconnected successfully. Background worker resumed uploading queued attendance journals and telemetry.",
        param1Label: "Wi-Fi Channel",
        param1Formatted: param1 !== null ? `Ch ${param1}` : undefined,
        param2Label: "Signal Strength (RSSI)",
        param2Formatted: param2 !== null ? `${param2} dBm (Strong)` : undefined,
        recommendedAction: "System online; attendance records syncing normally.",
      };

    // 6000 - 6099: Gate Physical Security
    case 6000:
      return {
        title: "Door Held Open Alert",
        category: "GATE",
        explanation: "Magnetic reed sensor indicates the turnstile door remained open past the configured security timeout.",
        param1Label: "Open Duration",
        param1Formatted: param1 !== null ? `${param1} seconds` : undefined,
        recommendedAction: "Check if the physical gate or latch is mechanically obstructed.",
      };

    default:
      return {
        title: detail || `Diagnostic Event #${eventCode}`,
        category: "SYSTEM",
        explanation: detail || `Hardware event reported with code ${eventCode}.`,
        param1Label: param1 !== null ? "Parameter 1" : undefined,
        param1Formatted: param1 !== null ? String(param1) : undefined,
        param2Label: param2 !== null ? "Parameter 2" : undefined,
        param2Formatted: param2 !== null ? String(param2) : undefined,
      };
  }
}
