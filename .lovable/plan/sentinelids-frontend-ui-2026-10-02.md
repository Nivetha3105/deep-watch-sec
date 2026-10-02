# SentinelIDS Frontend UI

## Goal
Build a single-page, presentation-ready Security Operations Center dashboard for SentinelIDS using only frontend code and mock data.

## Interface
- Create a dense responsive desktop/laptop layout with the requested dark navy/black palette, cyan accents, severity colors, restrained glow, thin borders, and strong typography.
- Add the branded top bar, simulation controls, connection state, and live clock.
- Add four live KPI cards, severity distribution, attack-vector analytics, live threat stream, and a full telemetry table.
- Preserve information density and hierarchy without turning it into a generic admin dashboard.

## Interactions
- Make simulation controls add realistic mock alerts and show notifications.
- Add live clock, clear-feed behavior, IP search, severity filters, refresh state, pagination, alert detail view, resolve action, and delete confirmation.
- Include professional loading, empty, and error states with subtle entry and update animations.

## Technical Details
- Keep mock records and API-shaped operations in a dedicated frontend service module so future REST and WebSocket integrations can replace them cleanly.
- Build reusable dashboard components and shared typed models.
- Use existing React, TypeScript, Tailwind CSS, Recharts, Lucide, Radix dialog, and Sonner packages only.
- Add route-specific metadata and update the global design tokens and typography.
- Do not add or modify backend, database, authentication, or server logic.

## Validation
- Confirm the preview builds successfully.
- Verify the dashboard at desktop and laptop widths, including filters, simulation, clearing, resolving, and deletion flows.
