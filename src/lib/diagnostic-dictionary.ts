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
  const reasons: Record<number, string> = {
    0: "Unknown Reset", 1: "Power-On Reset (Cold boot)", 2: "External Reset",
    3: "Software Reset", 4: "Core Panic Reset", 5: "Interrupt Watchdog Timeout",
    6: "Task Watchdog Timeout", 7: "Other Watchdog Reset", 8: "Deep Sleep Wakeup",
    9: "Brownout Reset (Voltage dip)", 10: "SDIO Reset",
  };
  return reasons[code] ?? `Reset Type #${code}`;
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
      const resetDesc = param1 !== null ? translateResetReasonCode(param1) : "Unknown Reset";
      return {
        title: `Machine Restart (${resetDesc})`,
        category: "SYSTEM",
        explanation: `Device restarted. Reported cause: ${resetDesc}. Check journal recovery and crash evidence to establish the impact.`,
        param1Label: "Reboot Trigger",
        param1Formatted: resetDesc,
        param2Label: "Free RAM at Boot",
        param2Formatted: param2 !== null ? formatBytes(param2) : undefined,
        recommendedAction: param1 === 9 ? "Measure supply voltage under load and inspect relay transients."
          : [4, 5, 6, 7].includes(param1 ?? -1) ? "Investigate the crash backtrace and task progress checkpoints."
          : param1 === 3 ? "Correlate with a recorded reboot or OTA command."
          : "Correlate with power, maintenance, and boot history.",
      };
    }

    case 1002:
      return {
        title: "Task Watchdog Supervisor Trip (TWDT)",
        category: "SYSTEM",
        explanation: "A watched task missed its progress deadline. Inspect the watchdog report and verify attendance journal recovery.",
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

    case 1004:
      return { title: "Previous Boot: Network Worker Checkpoint", category: "SYSTEM",
        explanation: "Last retained worker checkpoint from the previous boot; this is evidence of progress, not a confirmed crash location.",
        param1Label: "Operation (0 idle, 1 heartbeat, 2 OTA, 3 scan)", param1Formatted: String(param1 ?? "Unknown"),
        param2Label: "Previous Boot Uptime", param2Formatted: param2 !== null ? `${Math.floor(param2 / 1000)} seconds` : undefined };
    case 1005:
      return { title: "Previous Boot: Internal Heap", category: "SYSTEM",
        explanation: "Internal heap measurements retained at the previous worker checkpoint.",
        param1Label: "Internal Free Heap", param1Formatted: param1 !== null ? formatBytes(param1) : undefined,
        param2Label: "Largest Internal Block", param2Formatted: param2 !== null ? formatBytes(param2) : undefined };
    case 3002:
      return { title: "Attendance Journal Integrity Failure", category: "STORAGE",
        explanation: detail || "A journal write or recovery check failed. Inspect storage and pending attendance records.",
        recommendedAction: "Retrieve the journal and reconcile attendance before clearing storage." };

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
