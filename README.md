# Arise Experience

An interactive 3D virtual tour and architectural preview for ARISE Palm Resort in Akwa Ibom, Nigeria. Built with Three.js and Vite.

## Features

- **Interactive 3D Scene**: Explore the resort layout, arrival gate, and golf clubhouse in real time.
- **First-Person Walk Mode**: Walk through the grounds and inspect the architectural spaces up close.
- **Palm Circuit Mini Golf**: Three playable holes with rail rebounds, sand, water penalties, predicted shot paths, stars, scorecards and a saved personal best.
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


## Palm Circuit controls

Drag back anywhere on the course and release to putt, or use the power slider and Putt button. Arrow keys adjust aim and power; hold Space to charge and release to shoot. Escape returns to the resort. A low player-side camera and overhead View hole camera are available, along with sound and round restart controls. A cancelled pointer gesture or loss of window focus cancels charging.

The three holes share one course definition with the renderer and a fixed 120 Hz physics simulation. Rail restitution, obstacle collisions, sand friction, speed-sensitive cup capture and water penalties are covered by `npm test`. Progress and best scores are stored on this browser only; storage failure does not prevent play. The golf challenge is a stylized game, not a surveyed resort course.

## Replica-preserving presentation

The original `public/models/resort-architecture.glb`, photo references, building-generation sources and resort landscaping are unchanged. Golf is a temporary gameplay layer removed on exit. It is not a claim that a three-hole miniature course exists on the physical property.

Golf opens with a low player-side camera inspired by the supplied screenshot, with an original procedural Black golfer, putting stance, club wind-up and follow-through. This is a stylized mesh character, not a photoreal scanned person. View hole switches to an overhead camera.

The home introduction eases out after 5.5 seconds or when exploring the canvas. Directional controls stay available. Info restores the introduction for nine seconds; it stays visible while its controls have keyboard focus. Reduced-motion preferences skip the fade transition. The previously added passport overlay has been removed.
