import urllib.request
import json

url = 'https://iiozcipbxsmjasgglsyf.supabase.co/rest/v1/Relay?select=*'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpb3pjaXBieHNtamFzZ2dsc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzU1MjgsImV4cCI6MjA5NjE1MTUyOH0.V0TETykYX5KNAVOvaj039reZmURocfKac3voZrku-a0'

req = urllib.request.Request(url, method='GET')
req.add_header('apikey', key)
req.add_header('Authorization', 'Bearer ' + key)

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(e)
