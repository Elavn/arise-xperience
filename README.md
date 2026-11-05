# Arise Experience

An interactive 3D virtual tour and architectural preview for ARISE Palm Resort in Akwa Ibom, Nigeria. Built with Three.js and Vite.

## Features

- **Interactive 3D Scene**: Explore the resort layout, arrival gate, and golf clubhouse in real time.
- **First-Person Walk Mode**: Walk through the grounds and inspect the architectural spaces up close.
- **Open-green golf**: Three tee positions on the original resort grass, with the existing bunker, shot previews, scoring and a saved personal best.
- **Photo Gallery**: High-resolution rendered gallery shots and architectural views.
- **Lighting Controls**: Switch between daytime and sunset atmospheric lighting presets.

## Tech Stack

- [Three.js](https://threejs.org/) — 3D graphics rendering and camera animation
- [Vite](https://vitejs.dev/) — Fast frontend build tool and dev server
- HTML5 / CSS3 (Modern responsive UI)

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (version 20.19+ or 22.12+ required).

### Installation

```bash
npm install
```

### Development

Run the local development server:

```bash
npm run dev
```

Open your browser at the local URL printed in your terminal (typically `http://localhost:5173`).

### Production Build

Build the project for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```


## Golf controls

Drag the scene to orbit the camera. Shift-drag or middle-drag pans; the wheel zooms. Camera gestures never change shot aim or power and never launch the ball. Use the aim arrows and power slider, then press Putt. Keyboard arrows adjust aim/power; hold Space and release to putt. Escape exits golf. View hole toggles the overhead camera.

The original grass and bunker remain visible during play. There is no raised course, boundary rail, artificial wall or lagoon. Balls cross the former course edges freely; rough grass and the existing sand slow them. Shots far outside the practice grounds incur a penalty and return to the previous lie.

Run `npm test` for physics and interaction checks, including orbit/pan without shooting, former-boundary traversal, shot timing and cleanup. Best scores are stored on this browser only.

## Replica-preserving presentation

The original `public/models/resort-architecture.glb`, photo references, building-generation sources and resort landscaping are unchanged. The golfer, ball and practice markers are a temporary gameplay layer removed on exit; the underlying landscape stays unchanged.

Golf opens with a low player-side camera inspired by the supplied screenshot, with an original procedural Black golfer, putting stance, club wind-up and follow-through. This is a stylized mesh character, not a photoreal scanned person. View hole switches to an overhead camera.

The home introduction eases out after 5.5 seconds or when exploring the canvas. Directional controls stay available. Info restores the introduction for nine seconds; it stays visible while its controls have keyboard focus. Reduced-motion preferences skip the fade transition. The previously added passport overlay has been removed.
