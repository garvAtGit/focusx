import re

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'r', encoding='utf-8') as f:
    text = f.read()

root_ca = '''const char* rootCACertificate = \\
"-----BEGIN CERTIFICATE-----\\n" \\
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\\n" \\
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\\n" \\
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\\n" \\
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\\n" \\
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\\n" \\
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\\n" \\
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\\n" \\
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\\n" \\
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\\n" \\
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\\n" \\
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\\n" \\
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\\n" \\
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\\n" \\
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3I5Yl/K\\n" \\
"GwDk8RVrOwxCGfOqceFiKeuzzEMlA28Xcgzj1RoU3ZNV+EgANYT6RxMBMG5n/smv\\n" \\
"vU5TEnY2A9z/U+eLwU5QqY9J6Dq/w/H4z6HAd4pE5z1f/u1EaE+oD42x2yE2o14R\\n" \\
"8x8o0A3Ea11p3q5Z/G4R6zHwAwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MA4G\\n" \\
"A1UdDwEB/wQEAwIBBjAdBgNVHQ4EFgQUiFET7Q+uU5L10B4y1OxtnN3nN94wDQYJ\\n" \\
"KoZIhvcNAQELBQADggIBAK0k143N595s/b8Jv2yW4T9n1X9cK/iW4s1k61f3iL4f\\n" \\
"kPqB1K4iV5s5z9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH\\n" \\
"2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4\\n" \\
"L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09G\\n" \\
"z9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8\\n" \\
"P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9\\n" \\
"W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH\\n" \\
"2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4\\n" \\
"L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09G\\n" \\
"z9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8\\n" \\
"P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9\\n" \\
"W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH\\n" \\
"2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4\\n" \\
"L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09G\\n" \\
"z9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8\\n" \\
"P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9\\n" \\
"W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH2z+4L09Gz9H8P9/9W2aH\\n" \\
"-----END CERTIFICATE-----";\n'''

# Just use the original root ca exactly
with open(r'C:\Users\thees\.gemini\antigravity\brain\9ae6d04a-8c06-4063-8018-0d0eb63758a9\unified_esp32_firmware.ino', 'r', encoding='utf-8') as f:
    orig = f.read()
    
# Extract rootCACertificate from orig
match = re.search(r'(const char\* rootCACertificate =.*?;)', orig, re.DOTALL)
if match:
    root_ca = match.group(1)

# Inject into esp32_unified_hardware.ino
text = re.sub(r'const char\* HARDWARE_API_KEY = "my_secret_library_door_key_123";', f'const char* HARDWARE_API_KEY = "my_secret_library_door_key_123";\n{root_ca}\n', text)

old_http = '''  if (http.begin(API_URL)) {'''

new_http = '''  if (http.begin(API_URL, rootCACertificate)) {'''

text = text.replace(old_http, new_http)

with open(r'C:\Users\thees\Compound\Desktop\Library Near\esp32_unified_hardware\esp32_unified_hardware.ino', 'w', encoding='utf-8') as f:
    f.write(text)

print("Injected Root CA")
