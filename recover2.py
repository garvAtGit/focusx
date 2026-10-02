import json

out_lines = []

with open(r'C:\Users\thees\.gemini\antigravity\brain\9ae6d04a-8c06-4063-8018-0d0eb63758a9\.system_generated\logs\transcript_full.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        content_str = str(data)
        if 'AuthResponse performScan' in content_str:
            out_lines.append(content_str)

with open(r'C:\Users\thees\Compound\Desktop\01_Active Projects\Library Near\dashboard\recovered_code2.txt', 'w', encoding='utf-8') as f:
    for l in out_lines:
        f.write("=== ENTRY ===\n")
        f.write(l)
        f.write("\n\n")
