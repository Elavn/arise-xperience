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

Drag horizontally while preparing a putt to rotate the camera, golfer stance and shot direction together. Vertical dragging tilts the view. Shift-drag or middle-drag pans without changing aim; the wheel zooms. Drag release never launches the ball. Once a swing is committed, orbiting only changes the view and cannot redirect the shot. Use the aim arrows and power slider, then press Putt. Keyboard arrows adjust aim/power; hold Space and release to putt. Escape exits golf. View hole toggles the overhead camera.

The original grass and bunker remain visible during play. There is no raised course, boundary rail, artificial wall or lagoon. Balls cross the former course edges freely; rough grass and the existing sand slow them. Shots far outside the practice grounds incur a penalty and return to the previous lie.

Run `npm test` for physics and interaction checks, including orbit/pan without shooting, former-boundary traversal, shot timing and cleanup. Best scores are stored on this browser only.

## Replica-preserving presentation

The original `public/models/resort-architecture.glb`, photo references, building-generation sources and resort landscaping are unchanged. The golfer, ball and practice markers are a temporary gameplay layer removed on exit; the underlying landscape stays unchanged.

Golf opens with a low player-side camera inspired by the supplied screenshot, with an original procedural Black golfer, putting stance, club wind-up and follow-through. This is a stylized mesh character, not a photoreal scanned person. View hole switches to an overhead camera.

The home introduction eases out after 5.5 seconds or when exploring the canvas. Directional controls stay available. Info restores the introduction for nine seconds; it stays visible while its controls have keyboard focus. Reduced-motion preferences skip the fade transition. The previously added passport overlay has been removed.

## Ball and cup

The ball radius is 0.043 scene units, reduced from 0.18. The cup has a flush turf edge, a recessed liner and a bottom below the grass; temporary shader cutouts reveal its interior without changing the landscape geometry. Its radius is 0.108 and depth is 0.18 scene units. These are gameplay proportions, not surveyed measurements.

Cup contact is resolved at 720 substeps per second. The ball loses ground support over the opening, drops under gravity, and collides with the rounded turf lip and recessed walls. Firm putts can dip and hop off the far rim; slower putts can fall in. There is no binary speed threshold or magnetic capture. Scoring waits until the ball reaches the bottom. The model remains a lightweight approximation rather than a full rigid-body simulation. Tests cover drops, rollovers, lip-outs and misses outside the cup.

Grass uses a subdued green palette and a locally generated turf texture. Lower daylight exposure and light intensities reduce glare. Closely overlapping green layers have separate elevations to prevent depth shimmer; their original footprints and the building geometry are unchanged.
