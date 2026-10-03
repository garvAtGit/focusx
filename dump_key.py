import urllib.request
import json
import time

url = "https://dashboard-h80f1sj09-piyush-guptas-projects-5ec0bdfa.vercel.app/api/hardware/dump-key"

while True:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = response.read().decode('utf-8')
            if 'key' in data and 'parallelRouterKey' not in data:
                print("Extracted Key JSON:", data)
                break
            else:
                print("Still building...")
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
    except Exception as e:
        print("Error:", e)
    time.sleep(5)
