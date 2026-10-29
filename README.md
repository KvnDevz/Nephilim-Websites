# AirCut Official Website & Download Portal

Landing page, live 60fps L2 packet oscilloscope, and interactive zero-shift workbench for **AirCut** — Deterministic LAN Traffic Shaper & ARP Governance Desktop Engine.

## Stack & Architecture
- **Framework:** Astro 5 (Static Site Generation + Islands Architecture)
- **UI Islands:** React 18 + TypeScript
- **Styling:** Tailwind CSS 3 with Matte Pastel Black Tokens (`#0c0c0c`, `#111111`, `#141414`, `#181818`, `#222222`) & Exposed `1px` Swiss Hardware Grid
- **Typography:** `Schibsted Grotesk` (Display & UI sans) + `Martian Mono` (tabular telemetry) via Google Fonts
- **Icons:** Lucide React + Custom Inline Hardware SVGs
- **Overdrive Engine:** Native Web APIs (`Canvas 2D` high-DPI 60fps L2 oscilloscope & wire particle stream, `requestAnimationFrame`, synchronized 42-octet hex & `#[repr(C, packed)]` memory dissector)

## Quick Start

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build production SSG static bundle
npm run build

# Preview production build locally
npm run preview
```

## Binary Distribution
Compiled production binaries are hosted directly in `public/downloads/`:
- `AirCut_1.0.0_x64-setup.exe` (`1.92 MB` NSIS installer — SHA-256: `7128D7CCAF596DF28D2E57E63A0D076CC478ABC78AD8A3C05FB0DA21839EF2B4`)
- `AirCut_1.0.0_portable.exe` (`7.10 MB` standalone executable — SHA-256: `290D2BBA1CBD33AE4C2879B0ADBA703DE2B6BD0336E38BF41595A52447ED09B1`)
