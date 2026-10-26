# Sentinel UI

Build ONLY the frontend UI for a cybersecurity monitoring platform called "SentinelIDS".



Use:

- React + TypeScript

- Tailwind CSS

- Modern reusable components

- Responsive desktop/laptop design



Do NOT build or change the backend, database, authentication, MongoDB, Redis, or server logic.



==================================================

BRAND & DESIGN

==================================================



App name: SentinelIDS



Subtitle:

"Real-Time Network Intrusion & Threat Monitoring"



Create a professional Security Operations Center (SOC) dashboard.



Visual style:

- Dark navy/black background

- Clean modern cybersecurity aesthetic

- Subtle glass/card surfaces

- Thin borders

- Cyan/blue primary accent

- Red for HIGH severity

- Orange for MEDIUM severity

- Green for LOW/normal status

- Minimal glow effects

- No gaming-style design

- Strong typography and spacing

- Smooth but subtle animations

- Professional enough for a software engineering portfolio



==================================================

TOP BAR

==================================================



Create a top navigation/header containing:



Left:

- Shield/security logo

- SentinelIDS

- "v2.0" badge

- "Real-Time Network Intrusion & Threat Monitoring"



Center:

SIMULATE:

- Brute Force

- Port Scan

- DoS Burst



Right:

- Connection indicator

- "LIVE SOCKET STREAM"

- Live clock



The simulation buttons should look like SOC control buttons.



For now, buttons can trigger a temporary UI notification, but structure them so they can later call backend APIs.



==================================================

LIVE KPI CARDS

==================================================



Create four prominent cards:



1. TELEMETRY INGESTED

   Total network events



2. INTRUSION ALERTS

   Total detected alerts



3. CRITICAL INCIDENTS

   HIGH severity alerts



4. MALICIOUS ACTORS

   Unique suspicious source IPs



Each card should contain:

- Large number

- Label

- Small icon

- Supporting status text

- Subtle live/update indicator



Use mock data ONLY for initial frontend visualization.

Keep all data access isolated so it can later be replaced with real APIs.



==================================================

ANALYTICS

==================================================



Create a clean analytics section.



Panel 1:

"Severity Distribution"



Show:

- HIGH

- MEDIUM

- LOW



Use a professional chart/progress visualization.



Panel 2:

"Detected Attack Vectors"



Show:

- BRUTE FORCE

- PORT SCAN

- DOS BURST



Display counts and visual bars.



==================================================

LIVE THREAT STREAM

==================================================



Create a prominent panel titled:



"LIVE THREAT STREAM"



Show alert cards containing:



- Severity

- Attack type

- Source IP

- Detection description

- Timestamp

- Status



Example:



HIGH

BRUTE FORCE

192.168.1.50

6 failed login attempts detected

OPEN



Add:

- LIVE indicator

- Alert count

- Clear feed button

- Empty state:



"No active threats detected"



Make new alerts visually noticeable with a subtle animation.



==================================================

SECURITY INCIDENT TELEMETRY LOG

==================================================



Create a full-width section titled:



"SECURITY INCIDENT TELEMETRY LOG"



Add:



Search:

- Search by Source IP



Severity filters:

- ALL

- HIGH

- MEDIUM

- LOW



Actions:

- Refresh



Table columns:



Severity

Attack Vector

Source IP

Description

Status

Timestamp

Action



Action buttons:

- View

- Resolve

- Delete



Add:

- Previous

- Next

- Page indicator

- Result count



Make the table clean and readable.



==================================================

INTERACTIONS

==================================================



Add:



- Card hover effects

- Button hover states

- Table row hover

- Smooth transitions

- Toast notifications

- Loading skeletons

- Empty states

- Error states

- Delete confirmation dialog



Keep animations subtle and professional.



==================================================

BACKEND-INTEGRATION READY

==================================================



Do NOT implement the backend.



Create a clean frontend API/service layer so the mock data can later be replaced with these APIs:



GET /api/alerts

GET /api/analytics/summary

PUT /api/alerts/:id

DELETE /api/alerts/:id



Simulation buttons will later call:



POST /api/simulate/brute-force

POST /api/simulate/port-scan

POST /api/simulate/dos-burst



The live threat stream will later receive real-time events through Socket.io/WebSocket.



Do not hardcode API URLs throughout components.



Keep API calls isolated inside a services/api layer.



==================================================

IMPORTANT

==================================================



Do not redesign this as a generic admin dashboard.



Do not add unnecessary pages or features.



Do not change the requested SentinelIDS concept.



Focus heavily on:

- Professional SOC appearance

- Clear information hierarchy

- Excellent spacing

- Readable charts

- Realistic security dashboard feel

- Clean reusable React components

- Easy future integration with a Node.js + Express + MongoDB + Redis backend



The final UI should look polished and presentation-ready...not to build its own Supabase backend

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ed6828c1-6614-43fc-9973-9352f391547e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
