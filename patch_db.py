import urllib.request
import json

url = 'https://iiozcipbxsmjasgglsyf.supabase.co/rest/v1/Relay?bleReaderId=eq.87b99b2c-90fd-11e9-bc42-526af7764f64:1:1'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpb3pjaXBieHNtamFzZ2dsc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzU1MjgsImV4cCI6MjA5NjE1MTUyOH0.V0TETykYX5KNAVOvaj039reZmURocfKac3voZrku-a0'

data = json.dumps({
    "bleReaderId": "ffffff87ffffffb9ffffff9b2c-ffffff90fffffffd-11ffffffe9-ffffffbc42-526afffffff7764f64:1:1",
    "macAddress": "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1"
}).encode('utf-8')

req = urllib.request.Request(url, data=data, method='PATCH')
req.add_header('apikey', key)
req.add_header('Authorization', 'Bearer ' + key)
req.add_header('Content-Type', 'application/json')

try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(e)
