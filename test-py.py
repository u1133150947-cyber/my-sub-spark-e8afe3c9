import requests, json

url = "https://ru.panelsu.ru"
s = requests.Session()
r = s.post(f"{url}/login", data={"username": "admin", "password": "6WYia!Y5gV5D"})
print("Login status:", r.status_code)

r = s.get(f"{url}/panel/api/inbounds/list", headers={"Accept": "application/json"})
data = r.json()
h2ib = next(x for x in data["obj"] if x["protocol"] == "hysteria")
h2_id = h2ib["id"]
print("H2 Inbound ID:", h2_id)
print("Current settings in DB:", h2ib["settings"])

# Try using addClient API
client_payload = {"clients": [{"id": "abc-123", "email": "py_test", "enable": True, "password": "abc-password"}]}
r = s.post(f"{url}/panel/api/inbounds/addClient", data={"id": h2_id, "settings": json.dumps(client_payload)}, headers={"Accept": "application/json"})
print("Add client response:", r.json())

# Fetch list again
r = s.get(f"{url}/panel/api/inbounds/list", headers={"Accept": "application/json"})
h2ib_new = next(x for x in r.json()["obj"] if x["id"] == h2_id)
print("New settings in DB:", h2ib_new["settings"])
