# AirCut Web — Product Context

## Identity & Mission
AirCut is a modern, high-precision network packet shaping, ARP inspection, and LAN governance desktop tool built for network engineers, security auditors, and system administrators.
The website (`aircut-websites`) is the official download and technical showcase landing page for AirCut v1.0.

## Target Audience
- Network engineers and systems administrators managing local networks.
- Cybersecurity researchers, penetration testers, and CTF practitioners performing authorized L2 ARP cache analysis.
- Power users seeking deterministic bandwidth throttling and network latency simulation without bulky router reconfigurations.

## Value Proposition
- **100% Original High-Performance Architecture:** Pure Rust + Tauri v2 native desktop engine over WinPcap 4.1.3 (`wpcap.dll` / `packet.dll`).
- **Zero-Shift Tactile UI:** Fixed-grid telemetry controls with sub-millisecond reaction, zero layout jitter, and optimistic client-side caching.
- **Deterministic Bandwidth & Latency Shaper:** Granular 0-100% bandwidth controls, asymmetric inbound/outbound lag injection (0-5000ms), and 1-click connection cut/restore.
- **Continuous LAN Protection:** Active ARP Defender pinning router gateway MACs against spoofing, and automatic quarantine for newly discovered hosts.

## Core Website Requirements
- **Atmosphere & Tone:** Deep midnight obsidian (`#0f1219` / `#0d1017`) with authentic One Dark Pro semantic accents. Raw, precise network engineering feel (hex MACs, CIDR notations, packet delta counters, live telemetry simulator).
- **Typography:** Schibsted Grotesk for crisp, authoritative headlines; Martian Mono for tabular data, MAC addresses, and packet inspection.
- **Interactive UI Islands (React 18):**
  1. **Live Interactive Engine Preview:** An authentic, fully interactive simulator of AirCut's desktop interface directly in the browser (users can drag sliders, toggle lag, trigger cuts, observe live simulated packet rates and zero-shift layout).
  2. **Direct Download Hub & Architecture Selector:** Instant access to `AirCut_1.0.0_x64-setup.exe` (1.92 MB), checksums (SHA-256), release notes, WinPcap 4.1.3 prerequisites, and portable binaries.
  3. **Live Packet Anatomy & Telemetry Explorer:** Visual interactive dissection of ARP request/reply frames, L2 ethernet headers, and throttling mechanics.
  4. **Benchmark & Comparison Matrix:** AirCut vs legacy tools (NetCut legacy, clunky CLI tools, heavy virtual machines).
- **Motion:** Native Web APIs (`requestAnimationFrame`, `IntersectionObserver`, CSS Keyframes, GPU transforms) — silky smooth 60fps with zero runtime lag.
