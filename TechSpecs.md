# Document Extraction Angular Frontend - Technical Specs

## Overview

A healthcare contract analysis dashboard built with **Angular 21** for extracting, analyzing, and comparing reimbursement rules from medical contracts. The app features PDF extraction, side-by-side contract comparison, and real-time WebSocket communication for backend integration.

---

## Tech Stack

| Category       | Technology                     | Version  |
| -------------- | ------------------------------ | -------- |
| Framework      | Angular (standalone components)| 21.1.0   |
| Language       | TypeScript (strict mode)       | 5.9.2    |
| Styling        | Tailwind CSS + custom CSS vars | 4.1.18   |
| Reactive Layer | RxJS                           | 7.8.0    |
| Build Tool     | Angular CLI / Vite             | 21.1.2   |
| Package Manager| npm                            | 10.9.4   |

---

## Architecture

### Standalone Components (No NgModules)

Every component is self-contained with its own imports. The app uses Angular 21's standalone architecture throughout - there are no `NgModule` declarations anywhere.

### Change Detection

The app uses **zoneless change detection** (`provideZonelessChangeDetection()`), meaning Zone.js is not included. State updates are driven by Angular signals and explicit change detection.

### State Management

- **Angular Signals** for synchronous reactive state (connection status, UI toggles)
- **RxJS Observables** for async streams (WebSocket messages, error events)

---

## Project Structure

```
src/
├── main.ts                             # Bootstrap entry point
├── index.html                          # HTML shell
├── styles.css                          # Global styles (Tailwind + CSS custom properties)
└── app/
    ├── app.ts                          # Root component (layout shell)
    ├── app.config.ts                   # App-level providers and config
    ├── app.routes.ts                   # Route definitions
    ├── components/
    │   ├── app-header/                 # Hero header with title and status badge
    │   ├── content-header/             # Top bar with search, notifications, user profile
    │   └── left-sidebar/              # Collapsible nav sidebar (280px / 80px)
    ├── views/
    │   ├── extraction/                 # PDF upload + AI rule extraction
    │   ├── comparison/                 # Side-by-side contract diff
    │   └── websocket-demo/            # WebSocket connection testing UI
    └── services/
        └── websocket.service.ts        # WebSocket client with auto-reconnect
```

---

## Routing

| Path          | Component                 | Description                    |
| ------------- | ------------------------- | ------------------------------ |
| `/extract`    | ExtractionViewComponent   | PDF upload and rule extraction |
| `/compare`    | ComparisonViewComponent   | Side-by-side contract diff     |
| `/websocket`  | WebSocketDemoComponent    | WebSocket connection testing   |
| `/`           | Redirect to `/extract`    |                                |
| `**`          | Redirect to `/extract`    | Catch-all                      |

---

## Core Features

### 1. Document Extraction (`/extract`)
- Drag-and-drop PDF upload
- Triggers AI-powered rule extraction from healthcare reimbursement contracts
- Progress tracking with status indicators
- Metrics display: total pages, rule sections, total rules, rules requiring authorization

### 2. Contract Comparison (`/compare`)
- Upload two contracts side-by-side
- Identifies and categorizes rule differences: unchanged, modified, added, removed
- Color-coded stat cards for quick visual diff

### 3. WebSocket Demo (`/websocket`)
- Connect/disconnect to any WebSocket endpoint
- Send typed or raw messages (auto-parses JSON)
- Real-time event log with timestamps (max 100 entries)
- Connection status indicators with animated states

---

## WebSocket Service

Located at `src/app/services/websocket.service.ts`. Handles all real-time communication.

**Key interfaces:**
```typescript
interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: Date;
  id: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'
```

**Features:**
- Signal-based connection status (`status`, `isConnected`, `lastError`)
- Observable message stream (`messages$`) with type-based filtering via `onMessage<T>(type)`
- Auto-reconnection with configurable interval (default 3s) and max attempts (default 10)
- Graceful cleanup on component destroy

**Usage:**
```typescript
const ws = inject(WebSocketService);
ws.connect({ url: 'ws://localhost:8080' });
ws.onMessage<MyPayload>('my-event').subscribe(msg => { ... });
ws.send('my-event', { data: 'value' });
```

---

## WebSocket Test Server

A Node.js development server at `ws-test-server.js` for testing WebSocket connectivity.

```bash
node ws-test-server.js    # Starts on ws://localhost:8080
```

**Behavior:**
- Sends a `welcome` message on client connect
- Echoes received messages back with type `echo:{original_type}`
- Pings all connected clients every 10 seconds

---

## Styling

- **Tailwind CSS v4** for utility classes
- **CSS custom properties** for theming (defined in `styles.css`)
- **Fonts:** Inter (body), Poppins (headings)
- **Design language:** Glassmorphism (backdrop blur on cards/headers), gradient accents, smooth hover transitions
- **Responsive:** Mobile-first with breakpoints at 768px and 1024px

**Color palette:**
- Primary: `#0ea5e9` (sky blue)
- Accent: `#10b981` (green)
- Background: `#f8fafc` (light gray)
- Text: `#0f172a` (dark blue-gray)

---

## TypeScript Configuration

Strict mode is fully enabled:

```json
{
  "strict": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

Angular compiler also enforces strict templates, injection parameters, and input access modifiers.

---

## Build & Bundle

**Builder:** `@angular/build:application` (Vite-based)

**Budget limits:**
- Initial bundle: 500kB warning / 1MB error
- Component styles: 4kB warning / 8kB error

**Current initial bundle:** ~173kB (well within limits)

**Scripts:**
```bash
npm start       # Dev server on http://localhost:4200
npm run build   # Production build to dist/
npm run watch   # Build in watch mode
npm test        # Run tests
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm start
# App runs at http://localhost:4200

# (Optional) Start WebSocket test server
node ws-test-server.js
# WebSocket available at ws://localhost:8080
```

---

## Requirements

- Node.js (with npm 10+)
- No backend services required for UI development (WebSocket test server included)
