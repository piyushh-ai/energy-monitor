# ⚡ Energy Monitor

ESP32 electricity-meter dashboard. The ESP32 counts meter pulses (3200 pulses = 1 unit) and calls the API once per completed unit. Stack: Node.js, Express, MongoDB (Mongoose), one vanilla `public/index.html`.

## Setup
1. Install Node 18+ and MongoDB (local, or a free Atlas cluster).
2. Edit `.env`:
   ```
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/energy-monitor
   ```
   For Atlas use your `mongodb+srv://...` string (and allow your IP in Network Access).
3. `npm install`
4. `npm run dev` (nodemon) or `npm start`
5. Open http://localhost:3000

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/set-reading` | Set the starting/current meter reading |
| POST | `/api/get-unit` | ESP32 reports one completed unit |
| GET | `/api/get-data` | Everything the dashboard needs |

**Set reading** `{ "reading": 3847 }` (optional `deviceId`, default `ESP32-001`).
Returns 400 for invalid values. If the new value is lower than the stored one, returns 409 with `requiresConfirmation: true`; resend with `"confirm": true` to lower it.

**ESP32 unit** `{ "deviceId": "ESP32-001" }` returns 201 with the new `currentReading`. Optional `"eventId": "<unique string>"`: a repeated eventId returns 200 with `duplicate: true` and changes nothing (safe retries).

**Get data** returns `currentMeterReading`, `todayUnits`, `weekUnits`, `monthUnits`, `totalMonitoredUnits`, `lastUnitAt`, `lastUpdated`, `readingSet`.

## ESP32 request
```cpp
HTTPClient http;
http.begin("http://YOUR_SERVER_IP:3000/api/get-unit");
http.addHeader("Content-Type", "application/json");
int code = http.POST("{\"deviceId\":\"ESP32-001\"}");
http.end();
```
Use your computer's LAN IP (not `localhost`) while testing; both must be on the same network.

## How the numbers work
- **Current Meter Reading** = the number you entered + 1 for every unit event. It is a running total, not usage.
- **Today / Week / Month / Total Monitored** are summed on every request from stored unit events, never saved. Week starts Monday. Boundaries use Asia/Kolkata (UTC+5:30).
- Example: enter 3847, receive 5 events, so reading = 3852 and usage = 5.
- Dashboard refreshes every 5 s, shows Offline plus a message when the API is unreachable, and returns to Live automatically.

## Deployment
Push to a host with Node (Render, Railway, a VPS). Set `PORT` and `MONGODB_URI` as environment variables, start with `npm start`. Point the ESP32 at the public URL (use HTTPS with `WiFiClientSecure` if the host enforces it). The API has no authentication in this MVP; add an API key check on `/api/get-unit` and `/api/set-reading` before exposing it publicly.
