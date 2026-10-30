import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Download,
  Copy,
  Check,
  RotateCcw,
  Ban,
  Timer,
  Shield,
  Radio,
  Search,
  X,
  Power,
  Router,
  Smartphone,
  Laptop,
  Tv,
  Monitor,
  Network,
  ShieldCheck,
  Lock,
  Pause,
  Play,
  Terminal,
} from "lucide-react";

interface SimHost {
  id: string;
  ip: string;
  mac: string;
  name: string;
  vendor: string;
  kind: "router" | "self" | "phone" | "laptop" | "tv";
  speed: number;
  lag: number;
  cut: boolean;
  rtt: number;
  online: boolean;
  isGateway?: boolean;
  isSelf?: boolean;
}

interface CapturedFrame {
  seq: number;
  tsUs: string;
  src: string;
  dst: string;
  opcode: string;
  status: "FORWARD" | "SHAPED" | "DELAYED" | "DROPPED";
  len: number;
  hexPreview: string;
}

const INITIAL_HOSTS: SimHost[] = [
  {
    id: "gw",
    ip: "192.168.1.1",
    mac: "00:11:32:8A:4F:10",
    name: "Default Gateway",
    vendor: "Synology Inc.",
    kind: "router",
    speed: 100,
    lag: 0,
    cut: false,
    rtt: 2,
    online: true,
    isGateway: true,
  },
  {
    id: "self",
    ip: "192.168.1.42",
    mac: "D8:5E:D3:21:B0:9C",
    name: "This Workstation",
    vendor: "Intel Corporate",
    kind: "self",
    speed: 100,
    lag: 0,
    cut: false,
    rtt: 1,
    online: true,
    isSelf: true,
  },
  {
    id: "iphone",
    ip: "192.168.1.108",
    mac: "A4:83:E7:33:91:FA",
    name: "iPhone 15 Pro",
    vendor: "Apple, Inc.",
    kind: "phone",
    speed: 50,
    lag: 0,
    cut: false,
    rtt: 14,
    online: true,
  },
  {
    id: "work-laptop",
    ip: "192.168.1.115",
    mac: "3C:52:82:1B:02:66",
    name: "Precision 5570",
    vendor: "Dell Technologies",
    kind: "laptop",
    speed: 100,
    lag: 0,
    cut: false,
    rtt: 19,
    online: true,
  },
  {
    id: "smart-tv",
    ip: "192.168.1.140",
    mac: "68:54:5A:8E:22:11",
    name: "Living Room OLED",
    vendor: "LG Electronics",
    kind: "tv",
    speed: 100,
    lag: 150,
    cut: false,
    rtt: 28,
    online: true,
  },
];

const SETUP_SHA256 =
  "7128D7CCAF596DF28D2E57E63A0D076CC478ABC78AD8A3C05FB0DA21839EF2B4";

export function LiveAppSimulator() {
  const [hosts, setHosts] = useState<SimHost[]>(INITIAL_HOSTS);
  const [attached, setAttached] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>("iphone");
  const [filter, setFilter] = useState<"all" | "limited" | "cut" | "lag">("all");
  const [query, setQuery] = useState("");
  const [defender, setDefender] = useState(true);
  const [lockNew, setLockNew] = useState(false);
  const [activeTab, setActiveTab] = useState<"devices" | "ringbuffer">("devices");

  // Oscilloscope controls
  const [scopeFrozen, setScopeFrozen] = useState(false);
  const [timebase, setTimebase] = useState<"100us" | "1ms" | "10ms">("1ms");
  const [probeHover, setProbeHover] = useState<{
    x: number;
    y: number;
    mbps: string;
    deltaUs: string;
  } | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostsRef = useRef<SimHost[]>(hosts);
  hostsRef.current = hosts;
  const attachedRef = useRef(attached);
  attachedRef.current = attached;
  const frozenRef = useRef(scopeFrozen);
  frozenRef.current = scopeFrozen;
  const timebaseRef = useRef(timebase);
  timebaseRef.current = timebase;

  // Live telemetry state
  const [telemetry, setTelemetry] = useState({
    rateMbps: 74.2,
    rxPackets: 284192,
    txPackets: 279011,
    dropped: 14,
  });

  // Live L2 frame ring buffer
  const [frames, setFrames] = useState<CapturedFrame[]>([
    {
      seq: 9410,
      tsUs: "00:04.812940",
      src: "D8:5E:D3:21:B0:9C",
      dst: "A4:83:E7:33:91:FA",
      opcode: "0x0806 ARP_REPLY",
      status: "SHAPED",
      len: 42,
      hexPreview: "a4 83 e7 33 91 fa d8 5e d3 21 b0 9c 08 06 00 01 08 00 06 04 00 02",
    },
    {
      seq: 9411,
      tsUs: "00:04.813412",
      src: "3C:52:82:1B:02:66",
      dst: "00:11:32:8A:4F:10",
      opcode: "0x0800 IPV4_DATA",
      status: "FORWARD",
      len: 1514,
      hexPreview: "00 11 32 8a 4f 10 3c 52 82 1b 02 66 08 00 45 00 05 dc 8a 11 40 00",
    },
    {
      seq: 9412,
      tsUs: "00:04.814008",
      src: "68:54:5A:8E:22:11",
      dst: "00:11:32:8A:4F:10",
      opcode: "0x0800 IPV4_DATA",
      status: "DELAYED",
      len: 590,
      hexPreview: "00 11 32 8a 4f 10 68 54 5a 8e 22 11 08 00 45 00 02 40 19 f4 40 00",
    },
  ]);

  // 60fps High-DPI Canvas 2D L2 Packet Oscilloscope + Particle Wire Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    interface WireParticle {
      x: number;
      lane: number;
      speed: number;
      color: string;
      cut: boolean;
      size: number;
    }

    const particles: WireParticle[] = Array.from({ length: 28 }, (_, idx) => ({
      x: (idx * 37) % 500,
      lane: idx % 3,
      speed: 1.8 + (idx % 4) * 0.5,
      color: idx % 3 === 0 ? "#88c0d0" : idx % 3 === 1 ? "#ebcb8b" : "#a3be8c",
      cut: false,
      size: 3 + (idx % 2),
    }));

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;

      // Clear matte carbon well
      ctx.fillStyle = "#0c0c0c";
      ctx.fillRect(0, 0, w, h);

      // Draw Swiss oscilloscope graticule grid
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      const cols = 10;
      const rows = 4;
      for (let i = 1; i < cols; i++) {
        const gx = Math.floor((w / cols) * i) + 0.5;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let j = 1; j < rows; j++) {
        const gy = Math.floor((h / rows) * j) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Center zero-axis tick marks
      const midY = Math.floor(h * 0.48) + 0.5;
      ctx.strokeStyle = "#262626";
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, midY - 3);
        ctx.lineTo(x + 0.5, midY + 3);
        ctx.stroke();
      }

      const currentHosts = hostsRef.current;
      const isAttached = attachedRef.current;
      const isFrozen = frozenRef.current;
      const tb = timebaseRef.current;

      const peerHosts = currentHosts.filter((d) => !d.isGateway && !d.isSelf);
      const activeRatio =
        peerHosts.reduce((acc, d) => acc + (d.cut ? 0 : d.speed / 100), 0) /
        Math.max(1, peerHosts.length);
      const cutCount = peerHosts.filter((d) => d.cut || d.speed === 0).length;
      const totalLag = peerHosts.reduce((acc, d) => acc + d.lag, 0);

      const freqMult = tb === "100us" ? 0.045 : tb === "1ms" ? 0.024 : 0.012;

      if (!isFrozen && isAttached) {
        phase += 0.065 * (0.35 + activeRatio * 0.85);
      }

      // Channel 1: TX Token-Bucket Shaper Waveform (Pastel Sky #88c0d0)
      ctx.beginPath();
      ctx.strokeStyle = isAttached ? "#88c0d0" : "#3a3a3a";
      ctx.lineWidth = 1.75;
      for (let x = 0; x <= w; x += 2) {
        const amp = isAttached ? (12 + activeRatio * 28) : 2;
        const lagJitter = totalLag > 0 ? Math.sin(x * 0.19 - phase * 2.4) * Math.min(10, totalLag / 35) : 0;
        const cutClamp =
          cutCount > 0 && Math.sin(x * 0.05 + phase) > 0.55
            ? -amp * 0.65
            : 0;
        const y =
          midY -
          12 +
          Math.sin(x * freqMult + phase) * amp +
          Math.cos(x * freqMult * 2.3 - phase * 1.4) * (amp * 0.35) +
          lagJitter +
          cutClamp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Channel 2: RX Wire Return Waveform (Pastel Sage #a3be8c)
      ctx.beginPath();
      ctx.strokeStyle = isAttached ? "#a3be8c" : "#2e2e2e";
      ctx.lineWidth = 1.25;
      for (let x = 0; x <= w; x += 2) {
        const amp = isAttached ? (8 + activeRatio * 18) : 1.5;
        const y =
          midY +
          16 +
          Math.cos(x * freqMult * 1.4 + phase * 0.9) * amp +
          Math.sin(x * 0.09 - phase) * (amp * 0.25);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Bottom L2 Particle Wire Lanes (3 peer host lanes)
      const laneBaseY = h - 34;
      peerHosts.forEach((host, idx) => {
        const ly = laneBaseY + idx * 10;
        ctx.strokeStyle = "#1f1f1f";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(44, ly);
        ctx.lineTo(w, ly);
        ctx.stroke();
      });

      // Update & draw L2 frame particles along the 3 peer lanes
      particles.forEach((p) => {
        const host = peerHosts[p.lane] || peerHosts[0];
        if (!host) return;
        const isCut = host.cut || host.speed === 0;
        const speedFactor = !isAttached ? 0 : isCut ? 0 : (host.speed / 100) * (host.lag > 0 ? 0.55 : 1);

        if (!isFrozen && speedFactor > 0) {
          p.x += p.speed * (0.3 + speedFactor * 1.3);
          if (p.x > w) p.x = 46;
        }
        if (p.x < 46) p.x = 46 + ((p.x * 7) % Math.max(60, w - 50));

        const ly = laneBaseY + p.lane * 10;
        if (isCut) {
          // Dropped packet marker
          ctx.fillStyle = "rgba(224, 108, 117, 0.45)";
          ctx.fillRect(Math.max(46, Math.min(p.x, w * 0.45)), ly - 1.5, 3, 3);
        } else {
          ctx.fillStyle =
            host.speed < 100 ? "#ebcb8b" : host.lag > 0 ? "#b48ead" : "#a3be8c";
          ctx.fillRect(Math.max(46, p.x), ly - 2, p.size * 2.2, 3.5);
        }
      });

      // Draw crisp host IP labels on top of left gutter
      ctx.fillStyle = "#0c0c0c";
      ctx.fillRect(0, laneBaseY - 9, 42, 32);
      peerHosts.forEach((host, idx) => {
        const ly = laneBaseY + idx * 10;
        ctx.fillStyle = host.cut || host.speed === 0 ? "#e06c75" : host.speed < 100 ? "#ebcb8b" : "#8e8c87";
        ctx.font = '500 9px "Martian Mono", monospace';
        ctx.fillText(host.ip.replace("192.168.1.", "."), 6, ly + 2);
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Telemetry & Ring Buffer updater loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = now - lastTime;
      if (dt > 850) {
        lastTime = now;
        if (attached) {
          const activeRatio =
            hosts.reduce((acc, h) => {
              if (h.isGateway || h.isSelf) return acc + 1;
              return acc + (h.cut ? 0 : h.speed / 100);
            }, 0) / hosts.length;

          const baseMbps = 94.0 * activeRatio + (Math.random() * 3.2 - 1.6);
          const currentRate = Math.max(0.4, Number(baseMbps.toFixed(1)));
          const extraRx = Math.floor(Math.random() * 85 + 40);
          const extraTx = Math.floor(Math.random() * 80 + 35);
          const dropInc = hosts.some((h) => h.cut || h.speed === 0)
            ? Math.floor(Math.random() * 4 + 1)
            : 0;

          setTelemetry((prev) => ({
            rateMbps: currentRate,
            rxPackets: prev.rxPackets + extraRx,
            txPackets: prev.txPackets + extraTx,
            dropped: prev.dropped + dropInc,
          }));

          // Push a realistic L2 frame into the ring buffer
          const peers = hosts.filter((h) => !h.isGateway && !h.isSelf);
          const target = peers[Math.floor(Math.random() * peers.length)];
          if (target) {
            const isCut = target.cut || target.speed === 0;
            const isShaped = !isCut && target.speed < 100;
            const isLag = !isCut && target.lag > 0;
            const status: CapturedFrame["status"] = isCut
              ? "DROPPED"
              : isShaped
                ? "SHAPED"
                : isLag
                  ? "DELAYED"
                  : "FORWARD";

            setFrames((prev) => {
              const nextSeq = (prev[0]?.seq ?? 9410) + 1;
              const sec = ((now / 1000) % 60).toFixed(6).padStart(9, "0");
              const dstHex = target.mac.toLowerCase().replace(/:/g, " ");
              const nextFrame: CapturedFrame = {
                seq: nextSeq,
                tsUs: `00:${sec}`,
                src: "D8:5E:D3:21:B0:9C",
                dst: target.mac,
                opcode: isCut || isShaped ? "0x0806 ARP_REPLY" : "0x0800 IPV4_DATA",
                status,
                len: isCut || isShaped ? 42 : 1514,
                hexPreview: `${dstHex} d8 5e d3 21 b0 9c 08 06 00 01 08 00 06 04 00 02`,
              };
              return [nextFrame, ...prev.slice(0, 8)];
            });
          }
        } else {
          setTelemetry((prev) => ({
            ...prev,
            rateMbps: 0.0,
          }));
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [attached, hosts]);

  // Host Action Handlers
  const handleSpeed = (id: string, nextSpeed: number) => {
    setHosts((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const clamped = Math.max(0, Math.min(100, Math.round(nextSpeed)));
        return {
          ...h,
          speed: clamped,
          cut: clamped === 0,
        };
      }),
    );
  };

  const handleToggleCut = (id: string) => {
    setHosts((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const nextCut = !h.cut;
        return {
          ...h,
          cut: nextCut,
          speed: nextCut ? 0 : 100,
        };
      }),
    );
  };

  const handleToggleLag = (id: string) => {
    setHosts((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const nextLag = h.lag > 0 ? 0 : 150;
        return {
          ...h,
          lag: nextLag,
        };
      }),
    );
  };

  const handleRestoreAll = () => {
    setHosts((prev) =>
      prev.map((h) => ({
        ...h,
        speed: 100,
        cut: false,
        lag: 0,
      })),
    );
  };

  const copySetupSha = () => {
    void navigator.clipboard?.writeText(SETUP_SHA256);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 1800);
  };

  const visibleHosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hosts.filter((h) => {
      const isCut = h.cut || h.speed === 0;
      const isLimited = !isCut && h.speed < 100;
      const isLag = h.lag > 0;

      if (filter === "cut" && !isCut) return false;
      if (filter === "limited" && !isLimited && !isCut) return false;
      if (filter === "lag" && !isLag) return false;

      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.vendor.toLowerCase().includes(q) ||
        h.ip.includes(q) ||
        h.mac.toLowerCase().includes(q)
      );
    });
  }, [hosts, query, filter]);

  const controlledCount = hosts.filter(
    (h) => h.cut || h.speed < 100 || h.lag > 0,
  ).length;

  const selectedHost = hosts.find((h) => h.id === selectedId) || null;

  return (
    <div className="w-full">
      {/* ROW 1: ASYMMETRIC SWISS MASTHEAD (7 COLS SPEC + 5 COLS 60FPS OSCILLOSCOPE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-[#222222]">
        {/* Left Cell: Monumental Typography & Direct Binary Dispatch */}
        <div className="min-w-0 lg:col-span-7 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#222222] bg-[#141414] p-5 sm:p-10 md:p-12">
          <div>
            <h1 className="text-[clamp(2rem,4.4vw,3.85rem)] font-extrabold tracking-[-0.035em] text-[#f0efeb] leading-[1.04] [text-wrap:balance]">
              Deterministic Layer-2 traffic shaping at wire speed.
            </h1>

            <p className="mt-5 max-w-[62ch] text-[14.5px] sm:text-[15px] leading-[1.6] text-[#c8c6c1]">
              Engineered in pure Rust and Tauri v2 over direct <code className="num text-[#88c0d0]">wpcap.dll</code> and{" "}
              <code className="num text-[#88c0d0]">packet.dll</code> ring-0 NPF bindings. Execute microsecond ARP governance,
              throttle host bandwidth on a strict 412px zero-shift control track, and pin gateway hardware addresses against LAN spoofers.
            </p>
          </div>

          {/* Direct Binary Dispatch Block */}
          <div className="mt-8 pt-6 border-t border-[#222222]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href="/downloads/Nephilim_1.0.0_x64-setup.exe"
                download="Nephilim_1.0.0_x64-setup.exe"
                className="flex h-12 items-center justify-between sm:justify-center gap-3 bg-[#a3be8c] px-4 sm:px-6 text-[13px] sm:text-[13.5px] font-bold text-[#0c0c0c] transition-colors hover:bg-[#b5cea0]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Download size={16} className="stroke-[2.4] shrink-0" />
                  <span className="truncate">Nephilim_1.0.0_x64-setup.exe</span>
                </div>
                <span className="num shrink-0 border-l border-[#0c0c0c]/25 pl-2.5 text-[11.5px] font-semibold">
                  1.92 MB
                </span>
              </a>

              <a
                href="/downloads/Nephilim_1.0.0_portable.exe"
                download="Nephilim_1.0.0_portable.exe"
                className="flex h-12 items-center justify-between sm:justify-center gap-3 border border-[#2a2a2a] bg-[#181818] px-4 sm:px-5 text-[13px] font-semibold text-[#f0efeb] transition-colors hover:border-[#3a3a3a] hover:bg-[#222222]"
              >
                <div className="flex items-center gap-2">
                  <Download size={15} className="text-[#88c0d0] shrink-0" />
                  <span>Portable Binary</span>
                </div>
                <span className="num text-[11.5px] text-[#8e8c87]">7.10 MB</span>
              </a>
            </div>

            {/* Inline SHA-256 Digest & Runtime Spec Strip */}
            <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 border border-[#222222] bg-[#111111] px-3.5 py-2 text-[11px]">
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <span className="font-semibold text-[#8e8c87] shrink-0">SHA-256:</span>
                <code className="num truncate text-[#c8c6c1]">
                  {SETUP_SHA256}
                </code>
              </div>
              <button
                type="button"
                onClick={copySetupSha}
                className="num flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-[#a3be8c] hover:text-[#f0efeb] transition-colors"
              >
                {copiedSha ? (
                  <>
                    <Check size={12} />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>COPY DIGEST</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Cell: 60FPS Canvas 2D L2 Packet Oscilloscope */}
        <div className="min-w-0 lg:col-span-5 flex flex-col justify-between bg-[#0c0c0c] overflow-hidden">
          {/* Oscilloscope Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222222] bg-[#111111] px-4 py-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0"
                style={{
                  backgroundColor: !attached
                    ? "#6e6c68"
                    : scopeFrozen
                      ? "#ebcb8b"
                      : "#a3be8c",
                }}
              />
              <span className="num font-semibold text-[#f0efeb]">
                L2 WIRE OSCILLOSCOPE
              </span>
              <span className="num text-[#6e6c68]">60FPS</span>
            </div>

            {/* Timebase & Trigger Controls */}
            <div className="flex items-center gap-1.5">
              <div className="flex border border-[#2a2a2a] bg-[#181818]">
                {(["100us", "1ms", "10ms"] as const).map((tb) => (
                  <button
                    key={tb}
                    type="button"
                    onClick={() => setTimebase(tb)}
                    className={`num px-2 py-0.5 text-[10px] transition-colors ${
                      timebase === tb
                        ? "bg-[#282828] text-[#f0efeb] font-semibold"
                        : "text-[#8e8c87] hover:text-[#c8c6c1]"
                    }`}
                  >
                    {tb}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setScopeFrozen(!scopeFrozen)}
                className={`num flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                  scopeFrozen
                    ? "border-[#ebcb8b]/50 bg-[#ebcb8b]/15 text-[#ebcb8b]"
                    : "border-[#2a2a2a] bg-[#181818] text-[#c8c6c1] hover:border-[#3a3a3a]"
                }`}
              >
                {scopeFrozen ? <Play size={10} /> : <Pause size={10} />}
                <span>{scopeFrozen ? "HOLD" : "RUN"}</span>
              </button>
            </div>
          </div>

          {/* Interactive Canvas Surface */}
          <div
            className="relative w-full h-[250px] cursor-crosshair select-none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.round(e.clientX - rect.left);
              const y = Math.round(e.clientY - rect.top);
              const ratio = Math.max(0, Math.min(1, 1 - y / rect.height));
              const mbps = (telemetry.rateMbps * (0.6 + ratio * 0.7)).toFixed(1);
              const deltaUs = ((x / rect.width) * (timebase === "100us" ? 100 : timebase === "1ms" ? 1000 : 10000)).toFixed(0);
              setProbeHover({ x, y, mbps, deltaUs });
            }}
            onMouseLeave={() => setProbeHover(null)}
          >
            <canvas
              ref={canvasRef}
              className="block h-[250px] w-full"
              aria-label="Real-time Layer 2 packet waveform and host particle stream"
            />

            {/* Crosshair Probe Overlay */}
            {probeHover && (
              <>
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#f0efeb]/25"
                  style={{ left: `${probeHover.x}px` }}
                />
                <div
                  className="pointer-events-none absolute left-0 right-0 h-px bg-[#f0efeb]/25"
                  style={{ top: `${probeHover.y}px` }}
                />
                <div
                  className="num pointer-events-none absolute z-10 border border-[#3a3a3a] bg-[#111111]/95 px-2 py-1 text-[10px] text-[#f0efeb]"
                  style={{
                    left: `${Math.min(probeHover.x + 10, 260)}px`,
                    top: `${Math.max(probeHover.y - 34, 8)}px`,
                  }}
                >
                  <div>+{probeHover.deltaUs} µs · {probeHover.mbps} Mbps</div>
                </div>
              </>
            )}

            {/* Channel Legend Overlay */}
            <div className="pointer-events-none absolute top-2.5 left-3 flex flex-wrap items-center gap-3 text-[10px]">
              <span className="num flex items-center gap-1.5 text-[#88c0d0]">
                <span className="h-1.5 w-3 bg-[#88c0d0]" />
                CH1: TX SHAPER
              </span>
              <span className="num flex items-center gap-1.5 text-[#a3be8c]">
                <span className="h-1.5 w-3 bg-[#a3be8c]" />
                CH2: RX WIRE
              </span>
              <span className="num flex items-center gap-1.5 text-[#ebcb8b]">
                <span className="h-1.5 w-3 bg-[#ebcb8b]" />
                L2 PARTICLES
              </span>
            </div>
          </div>

          {/* Oscilloscope Live Readout Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-[#222222] border-t border-[#222222] bg-[#111111] text-[11px]">
            <div className="px-3 py-2.5">
              <div className="text-[10px] text-[#8e8c87]">WIRE RATE</div>
              <div className="num mt-0.5 text-[13px] font-bold text-[#f0efeb]">
                {attached ? telemetry.rateMbps.toFixed(1) : "0.0"}{" "}
                <span className="text-[10px] font-normal text-[#8e8c87]">Mbps</span>
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] text-[#8e8c87]">ACTIVE RULES</div>
              <div
                className="num mt-0.5 text-[13px] font-bold"
                style={{ color: controlledCount > 0 ? "#ebcb8b" : "#a3be8c" }}
              >
                {controlledCount} / {hosts.length}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] text-[#8e8c87]">TX FRAMES</div>
              <div className="num mt-0.5 text-[13px] font-bold text-[#c8c6c1]">
                {telemetry.txPackets.toLocaleString()}
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[10px] text-[#8e8c87]">CUT / DROP</div>
              <div
                className="num mt-0.5 text-[13px] font-bold"
                style={{ color: telemetry.dropped > 0 ? "#e06c75" : "#c8c6c1" }}
              >
                {telemetry.dropped.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: FULL-BLEED INTERACTIVE ZERO-SHIFT WORKBENCH */}
      <div id="workbench" className="scroll-mt-12 w-full overflow-hidden bg-[#111111]">
        {/* Workbench Top Context & Window Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222222] bg-[#0c0c0c] px-4 py-2.5 text-[11.5px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1.5" y="2.5" width="5" height="3" fill="#88c0d0" />
                <rect x="9.5" y="2.5" width="5" height="3" fill="#88c0d0" />
                <rect x="1.5" y="10.5" width="5" height="3" fill="#a3be8c" />
                <rect x="9.5" y="10.5" width="5" height="3" fill="#a3be8c" />
                <path d="M8 1.5v13" stroke="#e06c75" strokeWidth="1.6" />
              </svg>
              <span className="font-bold text-[#f0efeb]">Nephilim Interactive Workbench</span>
            </div>

            <span className="hidden md:inline text-[#6e6c68]">|</span>
            <span className="num hidden md:inline text-[11px] text-[#8e8c87]">
              \Device\NPF_Intel_Wi-Fi_6E (192.168.1.42)
            </span>

            <button
              type="button"
              onClick={() => setAttached(!attached)}
              className={`flex h-6 items-center gap-1.5 border px-2.5 text-[11px] font-semibold transition-colors ${
                attached
                  ? "border-[#2a2a2a] bg-[#181818] text-[#a3be8c] hover:border-[#3a3a3a]"
                  : "border-[#ebcb8b]/40 bg-[#ebcb8b]/15 text-[#ebcb8b]"
              }`}
            >
              <Power size={11} />
              <span>{attached ? "NPF Attached" : "Paused · Click to Attach"}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] text-[#8e8c87]">
              Drag any bandwidth slider or toggle Cut — watch the 60fps oscilloscope respond live
            </span>

            {controlledCount > 0 && (
              <button
                type="button"
                onClick={handleRestoreAll}
                className="flex h-6 items-center gap-1.5 border border-[#a3be8c]/40 bg-[#a3be8c]/15 px-2.5 text-[11px] font-semibold text-[#a3be8c] transition-colors hover:bg-[#a3be8c]/25"
              >
                <RotateCcw size={11} />
                <span>Restore All ({controlledCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Workbench Body: Left Rail + Center Console + Right Inspector */}
        <div className="flex flex-col lg:flex-row min-h-[440px] divide-y lg:divide-y-0 lg:divide-x divide-[#222222] bg-[#141414]">
          {/* Left Instrumentation Rail */}
          <aside className="w-full lg:w-[210px] shrink-0 flex flex-col justify-between bg-[#111111] p-3">
            <div className="space-y-4">
              <div className="flex lg:flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("devices")}
                  className={`flex h-8 flex-1 items-center gap-2 px-2.5 text-left text-[12px] font-semibold transition-colors ${
                    activeTab === "devices"
                      ? "bg-[#222222] text-[#f0efeb] shadow-[inset_2px_0_0_#a3be8c]"
                      : "text-[#8e8c87] hover:bg-[#181818] hover:text-[#c8c6c1]"
                  }`}
                >
                  <Network size={13} className={activeTab === "devices" ? "text-[#a3be8c]" : ""} />
                  <span>Host Shaper</span>
                  <span className="num ml-auto bg-[#181818] px-1.5 py-0.5 text-[10px] text-[#c8c6c1]">
                    {hosts.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("ringbuffer")}
                  className={`flex h-8 flex-1 items-center gap-2 px-2.5 text-left text-[12px] font-semibold transition-colors ${
                    activeTab === "ringbuffer"
                      ? "bg-[#222222] text-[#f0efeb] shadow-[inset_2px_0_0_#88c0d0]"
                      : "text-[#8e8c87] hover:bg-[#181818] hover:text-[#c8c6c1]"
                  }`}
                >
                  <Terminal size={13} className={activeTab === "ringbuffer" ? "text-[#88c0d0]" : ""} />
                  <span>L2 Hex Stream</span>
                </button>
              </div>

              {/* Autonomous Defense Controls */}
              <div className="border-t border-[#222222] pt-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11.5px]">
                  <div className="flex items-center gap-1.5 text-[#c8c6c1]">
                    <ShieldCheck size={13} className={defender ? "text-[#a3be8c]" : "text-[#6e6c68]"} />
                    <span>ARP Defender</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle ARP Defender"
                    onClick={() => setDefender(!defender)}
                    className={`h-4 w-7 transition-colors ${defender ? "bg-[#a3be8c]" : "bg-[#282828]"}`}
                  >
                    <span
                      className={`block h-3 w-3 bg-[#0c0c0c] transition-transform ${
                        defender ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11.5px]">
                  <div className="flex items-center gap-1.5 text-[#c8c6c1]">
                    <Lock size={13} className={lockNew ? "text-[#ebcb8b]" : "text-[#6e6c68]"} />
                    <span>Quarantine New</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle Quarantine New Hosts"
                    onClick={() => setLockNew(!lockNew)}
                    className={`h-4 w-7 transition-colors ${lockNew ? "bg-[#ebcb8b]" : "bg-[#282828]"}`}
                  >
                    <span
                      className={`block h-3 w-3 bg-[#0c0c0c] transition-transform ${
                        lockNew ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Interface Metadata */}
            <div className="hidden lg:block border-t border-[#222222] pt-3 text-[11px] text-[#8e8c87] space-y-1.5">
              <div className="flex justify-between">
                <span>Subnet</span>
                <span className="num text-[#c8c6c1]">192.168.1.0/24</span>
              </div>
              <div className="flex justify-between">
                <span>Gateway MAC</span>
                <span className="num text-[#c8c6c1]">00:11:32:8A:4F:10</span>
              </div>
              <div className="flex justify-between">
                <span>Hold Cache</span>
                <span className="num text-[#a3be8c]">1,600 ms</span>
              </div>
            </div>
          </aside>

          {/* Center Console: Host Shaper Table OR Live L2 Hex Ring Buffer */}
          <div className="flex w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#141414]">
            {activeTab === "devices" ? (
              <>
                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#222222] bg-[#111111] px-3.5 py-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <div className="flex h-7 w-[160px] sm:w-[220px] items-center border border-[#2a2a2a] bg-[#181818] px-2 text-[11.5px]">
                      <Search size={12} className="mr-2 text-[#6e6c68]" />
                      <input
                        type="text"
                        placeholder="Filter host, IP, MAC..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full bg-transparent text-[#f0efeb] placeholder:text-[#6e6c68] outline-none"
                      />
                      {query && (
                        <button type="button" onClick={() => setQuery("")} aria-label="Clear filter">
                          <X size={11} className="text-[#8e8c87]" />
                        </button>
                      )}
                    </div>

                    <div className="flex border border-[#2a2a2a] bg-[#181818] p-0.5 text-[11px]">
                      {(["all", "limited", "cut", "lag"] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFilter(key)}
                          className={`px-2.5 py-0.5 capitalize font-medium transition-colors ${
                            filter === key
                              ? "bg-[#282828] text-[#f0efeb]"
                              : "text-[#8e8c87] hover:text-[#c8c6c1]"
                          }`}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#a3be8c]">
                    <Radio size={12} />
                    <span className="num">412px FIXED CONTROL TRACK · 0px SHIFT</span>
                  </div>
                </div>

                {/* Scrollable Table Wrapper for Mobile & Desktop */}
                <div className="overflow-x-auto flex-1">
                  <div className="min-w-[760px]">
                    {/* Column Headers */}
                    <div className="grid h-8 grid-cols-[minmax(170px,1.2fr)_minmax(150px,1fr)_84px_412px] items-center gap-2 border-b border-[#222222] bg-[#0c0c0c] px-3.5 text-[10.5px] font-semibold text-[#8e8c87]">
                      <span>HOST IDENTITY</span>
                      <span>IPV4 / HARDWARE MAC</span>
                      <span>RTT / LAG</span>
                      <span className="text-right">ZERO-SHIFT SHAPER CONTROLS (412PX)</span>
                    </div>

                    {/* Host Rows */}
                    <div className="divide-y divide-[#222222]">
                      {visibleHosts.map((host) => {
                        const locked = host.isGateway || host.isSelf;
                        const isCut = host.cut || host.speed === 0;
                        const isThrottled = !isCut && host.speed < 100;
                        const isLag = host.lag > 0;
                        const isSelected = selectedId === host.id;

                        const sliderFill = isCut
                          ? "#e06c75"
                          : isThrottled
                            ? "#ebcb8b"
                            : "#88c0d0";

                        const rowBg = isSelected
                          ? "bg-[#1c1c1c]"
                          : isCut
                            ? "bg-[#e06c75]/[0.05] hover:bg-[#181818]"
                            : isThrottled
                              ? "bg-[#ebcb8b]/[0.04] hover:bg-[#181818]"
                              : "bg-[#141414] hover:bg-[#181818]";

                        return (
                          <div
                            key={host.id}
                            onClick={() => setSelectedId(host.id)}
                            style={{
                              boxShadow: isSelected
                                ? "inset 2px 0 0 #88c0d0"
                                : isCut
                                  ? "inset 2px 0 0 #e06c75"
                                  : isThrottled
                                    ? "inset 2px 0 0 #ebcb8b"
                                    : isLag
                                      ? "inset 2px 0 0 #b48ead"
                                      : "none",
                            }}
                            className={`grid h-[54px] cursor-pointer grid-cols-[minmax(170px,1.2fr)_minmax(150px,1fr)_84px_412px] items-center gap-2 px-3.5 transition-colors ${rowBg}`}
                          >
                            {/* Host Identity */}
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="grid h-7 w-7 shrink-0 place-items-center border border-[#2a2a2a] bg-[#181818] text-[#c8c6c1]">
                                {host.kind === "router" && <Router size={13} className="text-[#88c0d0]" />}
                                {host.kind === "self" && <Monitor size={13} className="text-[#a3be8c]" />}
                                {host.kind === "phone" && <Smartphone size={13} />}
                                {host.kind === "laptop" && <Laptop size={13} />}
                                {host.kind === "tv" && <Tv size={13} />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`truncate text-[12.5px] font-semibold ${
                                      isCut ? "text-[#8e8c87] line-through" : "text-[#f0efeb]"
                                    }`}
                                  >
                                    {host.name}
                                  </span>
                                  {host.isGateway && (
                                    <span className="border border-[#88c0d0]/40 bg-[#88c0d0]/10 px-1 text-[9.5px] font-semibold text-[#88c0d0]">
                                      GW
                                    </span>
                                  )}
                                  {host.isSelf && (
                                    <span className="border border-[#a3be8c]/40 bg-[#a3be8c]/10 px-1 text-[9.5px] font-semibold text-[#a3be8c]">
                                      SELF
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#8e8c87] truncate">{host.vendor}</div>
                              </div>
                            </div>

                            {/* IP & MAC */}
                            <div className="min-w-0">
                              <div className="num text-[12px] font-medium text-[#f0efeb]">{host.ip}</div>
                              <div className="num text-[10.5px] text-[#8e8c87]">{host.mac}</div>
                            </div>

                            {/* Latency */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span
                                  className="num text-[11.5px] font-semibold"
                                  style={{ color: isLag ? "#b48ead" : "#a3be8c" }}
                                >
                                  {host.rtt + host.lag} ms
                                </span>
                              </div>
                            </div>

                            {/* Strict 412px Zero-Shift Control Strip */}
                            <div
                              className="flex h-full w-[412px] items-center justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {locked ? (
                                <div className="flex h-[30px] w-[412px] items-center justify-between border border-[#222222] bg-[#111111] px-3 text-[11px] text-[#8e8c87]">
                                  <span className="num">100% · UNRESTRICTED WIRE PATH</span>
                                  <span className="flex items-center gap-1.5 text-[#a3be8c]">
                                    <Shield size={11} />
                                    <span>PINNED</span>
                                  </span>
                                </div>
                              ) : (
                                <div className="grid w-[412px] grid-cols-[248px_72px_76px] items-center gap-2">
                                  {/* 248px Bandwidth Pod */}
                                  <div className="flex h-[30px] w-[248px] items-center border border-[#2a2a2a] bg-[#111111] px-2">
                                    <span
                                      className="num w-[34px] shrink-0 text-right text-[11px] font-bold"
                                      style={{ color: sliderFill }}
                                    >
                                      {host.speed}%
                                    </span>

                                    <div className="mx-2 flex w-[90px] shrink-0 items-center">
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={host.speed}
                                        aria-label={`Bandwidth for ${host.name}`}
                                        onChange={(e) => handleSpeed(host.id, Number(e.target.value))}
                                        className="sim-slider w-full"
                                        style={
                                          {
                                            "--track-fill": sliderFill,
                                            "--track-pct": `${host.speed}%`,
                                          } as React.CSSProperties
                                        }
                                      />
                                    </div>

                                    <div className="mr-1.5 h-[14px] w-px shrink-0 bg-[#222222]" />

                                    <div className="grid w-[88px] shrink-0 grid-cols-3 gap-0.5">
                                      {[25, 50, 100].map((pct) => (
                                        <button
                                          key={pct}
                                          type="button"
                                          onClick={() => handleSpeed(host.id, pct)}
                                          className={`num flex h-[22px] items-center justify-center text-[10px] font-semibold transition-colors ${
                                            !isCut && host.speed === pct
                                              ? "bg-[#282828] text-[#f0efeb]"
                                              : "text-[#8e8c87] hover:bg-[#1c1c1c] hover:text-[#f0efeb]"
                                          }`}
                                        >
                                          {pct}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 72px Lag Switch */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLag(host.id)}
                                    className={`num flex h-[30px] w-[72px] shrink-0 items-center justify-center gap-1 border text-[11px] font-semibold transition-colors ${
                                      isLag
                                        ? "border-[#b48ead]/50 bg-[#b48ead]/15 text-[#b48ead]"
                                        : "border-[#2a2a2a] bg-[#181818] text-[#c8c6c1] hover:bg-[#222222] hover:text-[#f0efeb]"
                                    }`}
                                  >
                                    <Timer size={11} />
                                    <span>{isLag ? `${host.lag}ms` : "Lag"}</span>
                                  </button>

                                  {/* 76px Cut / Restore Switch */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCut(host.id)}
                                    className={`flex h-[30px] w-[76px] shrink-0 items-center justify-center gap-1 border text-[11px] font-semibold transition-colors ${
                                      isCut
                                        ? "border-[#e06c75]/50 bg-[#e06c75]/15 text-[#e06c75]"
                                        : "border-[#2a2a2a] bg-[#181818] text-[#c8c6c1] hover:border-[#e06c75]/40 hover:text-[#e06c75]"
                                    }`}
                                  >
                                    {isCut ? <RotateCcw size={11} /> : <Ban size={11} />}
                                    <span>{isCut ? "Restore" : "Cut"}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Live L2 Hex Ring Buffer View */
              <div className="flex flex-1 flex-col bg-[#0c0c0c]">
                <div className="flex items-center justify-between border-b border-[#222222] bg-[#111111] px-4 py-2 text-[11px]">
                  <span className="num font-semibold text-[#f0efeb]">
                    NPF KERNEL RING BUFFER · LIVE PACKET STREAM
                  </span>
                  <span className="num text-[#a3be8c]">BPF FILTER: ether proto 0x0806 or ip</span>
                </div>
                <div className="divide-y divide-[#1c1c1c] font-mono text-[11px]">
                  {frames.map((f) => (
                    <div
                      key={f.seq}
                      className="grid grid-cols-1 md:grid-cols-[70px_110px_240px_130px_90px_1fr] items-center gap-2 px-4 py-2.5 hover:bg-[#141414]"
                    >
                      <span className="num text-[#8e8c87]">#{f.seq}</span>
                      <span className="num text-[#c8c6c1]">{f.tsUs}</span>
                      <span className="num text-[#f0efeb] truncate">
                        {f.src.slice(9)} → {f.dst.slice(9)}
                      </span>
                      <span className="num text-[#88c0d0]">{f.opcode}</span>
                      <span
                        className="num text-[10px] font-bold"
                        style={{
                          color:
                            f.status === "DROPPED"
                              ? "#e06c75"
                              : f.status === "SHAPED"
                                ? "#ebcb8b"
                                : f.status === "DELAYED"
                                  ? "#b48ead"
                                  : "#a3be8c",
                        }}
                      >
                        [{f.status}]
                      </span>
                      <span className="num truncate text-[#6e6c68]">{f.hexPreview}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Host Inspector Drawer */}
          {selectedHost && (
            <aside className="w-full lg:w-[270px] shrink-0 flex flex-col justify-between bg-[#111111] p-4">
              <div>
                <div className="flex items-center justify-between border-b border-[#222222] pb-3">
                  <div>
                    <h2 className="text-[13.5px] font-bold text-[#f0efeb]">
                      {selectedHost.name}
                    </h2>
                    <p className="num text-[11px] text-[#8e8c87]">
                      {selectedHost.ip} · {selectedHost.mac}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close inspector"
                    onClick={() => setSelectedId(null)}
                    className="p-1 text-[#8e8c87] hover:bg-[#1c1c1c] hover:text-[#f0efeb]"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11.5px] font-medium text-[#8e8c87]">
                        Token-Bucket Rate
                      </span>
                      <span className="num text-[15px] font-bold text-[#f0efeb]">
                        {selectedHost.speed}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedHost.speed}
                      disabled={selectedHost.isGateway || selectedHost.isSelf}
                      aria-label="Inspector bandwidth rate"
                      onChange={(e) => handleSpeed(selectedHost.id, Number(e.target.value))}
                      className="sim-slider mt-2 w-full"
                      style={
                        {
                          "--track-fill":
                            selectedHost.cut || selectedHost.speed === 0
                              ? "#e06c75"
                              : selectedHost.speed < 100
                                ? "#ebcb8b"
                                : "#88c0d0",
                          "--track-pct": `${selectedHost.speed}%`,
                        } as React.CSSProperties
                      }
                    />
                  </div>

                  <div>
                    <span className="text-[11.5px] font-medium text-[#8e8c87]">
                      Asymmetric Delay Injection
                    </span>
                    <div className="mt-1.5 grid grid-cols-4 gap-1">
                      {[0, 50, 150, 300].map((ms) => (
                        <button
                          key={ms}
                          type="button"
                          disabled={selectedHost.isGateway || selectedHost.isSelf}
                          onClick={() =>
                            setHosts((prev) =>
                              prev.map((h) => (h.id === selectedHost.id ? { ...h, lag: ms } : h)),
                            )
                          }
                          className={`num border py-1 text-[10.5px] font-semibold transition-colors ${
                            selectedHost.lag === ms
                              ? "border-[#b48ead]/50 bg-[#b48ead]/15 text-[#f0efeb]"
                              : "border-[#2a2a2a] bg-[#181818] text-[#8e8c87] hover:text-[#c8c6c1]"
                          }`}
                        >
                          {ms}ms
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-[#222222] pt-3 text-[11.5px] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#8e8c87]">OUI Vendor</span>
                      <span className="text-[#f0efeb] font-medium">{selectedHost.vendor}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8e8c87]">EtherType</span>
                      <span className="num text-[#88c0d0]">0x0806 (ARP)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8e8c87]">Wire RTT</span>
                      <span className="num text-[#a3be8c]">
                        {selectedHost.rtt + selectedHost.lag} ms
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 border border-[#222222] bg-[#0c0c0c] p-2.5 text-[10.5px] text-[#8e8c87]">
                <div className="num text-[#c8c6c1] font-semibold">OPTIMISTIC HOLD: 1,600ms</div>
                <p className="mt-0.5 leading-relaxed">
                  Slider mutations lock local state for 1.6s so background 900ms ARP sweeps never jitter active controls.
                </p>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
