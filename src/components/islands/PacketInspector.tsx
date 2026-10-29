import React, { useState } from "react";

type FrameMode = "shape" | "defend" | "probe" | "cut";

interface FieldSegment {
  id: string;
  name: string;
  rustField: string;
  rustType: string;
  offsetStart: number;
  offsetEnd: number; // exclusive
  layer: "L2 ETHERNET (14B)" | "ARP PAYLOAD (28B)";
  color: string;
  valueLabel: string;
  hexBytes: string[];
  desc: string;
}

const MODE_CONFIGS: Record<
  FrameMode,
  {
    label: string;
    opcodeHex: [string, string];
    opcodeDesc: string;
    dstMacLabel: string;
    dstMacHex: string[];
    srcMacLabel: string;
    srcMacHex: string[];
    spaLabel: string;
    spaHex: string[];
    tpaLabel: string;
    tpaHex: string[];
    summary: string;
  }
> = {
  shape: {
    label: "Token-Bucket Shaper (50% Rate)",
    opcodeHex: ["00", "02"],
    opcodeDesc: "0x0002 (ARP Reply)",
    dstMacLabel: "A4:83:E7:33:91:FA (Target Host)",
    dstMacHex: ["a4", "83", "e7", "33", "91", "fa"],
    srcMacLabel: "D8:5E:D3:21:B0:9C (AirCut Relay)",
    srcMacHex: ["d8", "5e", "d3", "21", "b0", "9c"],
    spaLabel: "192.168.1.1 (Gateway VIP)",
    spaHex: ["c0", "a8", "01", "01"],
    tpaLabel: "192.168.1.108 (Target Host)",
    tpaHex: ["c0", "a8", "01", "6c"],
    summary:
      "Steers target traffic through AirCut's microsecond token-bucket relay queue, pacing Ethernet frames to match the user-selected percentage without dropping TCP sessions.",
  },
  defend: {
    label: "ARP Defender Pinning",
    opcodeHex: ["00", "02"],
    opcodeDesc: "0x0002 (Gratuitous Re-Assert)",
    dstMacLabel: "D8:5E:D3:21:B0:9C (Workstation)",
    dstMacHex: ["d8", "5e", "d3", "21", "b0", "9c"],
    srcMacLabel: "00:11:32:8A:4F:10 (True Gateway)",
    srcMacHex: ["00", "11", "32", "8a", "4f", "10"],
    spaLabel: "192.168.1.1 (Gateway IP)",
    spaHex: ["c0", "a8", "01", "01"],
    tpaLabel: "192.168.1.42 (Workstation)",
    tpaHex: ["c0", "a8", "01", "2a"],
    summary:
      "Immediately re-asserts the burned-in hardware MAC of the router and pins the neighbour cache entry via SetIpNetEntry2 whenever a hostile ARP poison attempt is observed.",
  },
  probe: {
    label: "Subnet Who-Has Sweep",
    opcodeHex: ["00", "01"],
    opcodeDesc: "0x0001 (ARP Request)",
    dstMacLabel: "FF:FF:FF:FF:FF:FF (L2 Broadcast)",
    dstMacHex: ["ff", "ff", "ff", "ff", "ff", "ff"],
    srcMacLabel: "D8:5E:D3:21:B0:9C (Workstation)",
    srcMacHex: ["d8", "5e", "d3", "21", "b0", "9c"],
    spaLabel: "192.168.1.42 (Scanner IP)",
    spaHex: ["c0", "a8", "01", "2a"],
    tpaLabel: "192.168.1.108 (Probed Peer)",
    tpaHex: ["c0", "a8", "01", "6c"],
    summary:
      "Broadcasts compact 42-byte Ethernet ARP requests across the /24 subnet mask, resolving live MAC addresses against the embedded 35,420-entry IEEE OUI table.",
  },
  cut: {
    label: "1-Click Cut (Null Sink)",
    opcodeHex: ["00", "02"],
    opcodeDesc: "0x0002 (Sinkhole Reply)",
    dstMacLabel: "A4:83:E7:33:91:FA (Isolated Host)",
    dstMacHex: ["a4", "83", "e7", "33", "91", "fa"],
    srcMacLabel: "02:00:00:DEAD:01 (Null Sink MAC)",
    srcMacHex: ["02", "00", "00", "de", "ad", "01"],
    spaLabel: "192.168.1.1 (Gateway IP)",
    spaHex: ["c0", "a8", "01", "01"],
    tpaLabel: "192.168.1.108 (Isolated Host)",
    tpaHex: ["c0", "a8", "01", "6c"],
    summary:
      "Isolates an unauthorized host from the gateway in one click and automatically dispatches clean restoration frames the instant you click Restore.",
  },
};

export function PacketInspector() {
  const [mode, setMode] = useState<FrameMode>("shape");
  const [activeFieldId, setActiveFieldId] = useState<string>("opcode");

  const cfg = MODE_CONFIGS[mode];

  const segments: FieldSegment[] = [
    {
      id: "dst_mac",
      name: "Destination MAC",
      rustField: "pub dst_mac: [u8; 6],",
      rustType: "[u8; 6]",
      offsetStart: 0,
      offsetEnd: 6,
      layer: "L2 ETHERNET (14B)",
      color: "#88c0d0",
      valueLabel: cfg.dstMacLabel,
      hexBytes: cfg.dstMacHex,
      desc: "Target Layer-2 hardware address receiving the Ethernet frame on the local broadcast domain.",
    },
    {
      id: "src_mac",
      name: "Source MAC",
      rustField: "pub src_mac: [u8; 6],",
      rustType: "[u8; 6]",
      offsetStart: 6,
      offsetEnd: 12,
      layer: "L2 ETHERNET (14B)",
      color: "#a3be8c",
      valueLabel: cfg.srcMacLabel,
      hexBytes: cfg.srcMacHex,
      desc: "Transmitting adapter hardware address injected into the NPF ring buffer.",
    },
    {
      id: "ethertype",
      name: "EtherType",
      rustField: "pub ethertype: u16,",
      rustType: "u16 (BE)",
      offsetStart: 12,
      offsetEnd: 14,
      layer: "L2 ETHERNET (14B)",
      color: "#ebcb8b",
      valueLabel: "0x0806 (ARP)",
      hexBytes: ["08", "06"],
      desc: "Big-endian IEEE 802.3 protocol identifier instructing the NIC to parse an ARP payload.",
    },
    {
      id: "htype_ptype",
      name: "HTYPE + PTYPE",
      rustField: "pub htype: u16, pub ptype: u16,",
      rustType: "u16 × 2",
      offsetStart: 14,
      offsetEnd: 18,
      layer: "ARP PAYLOAD (28B)",
      color: "#8fbcbb",
      valueLabel: "0x0001 (Ethernet) / 0x0800 (IPv4)",
      hexBytes: ["00", "01", "08", "00"],
      desc: "Specifies Ethernet link-layer hardware type (1) and IPv4 network protocol resolution (0x0800).",
    },
    {
      id: "hlen_plen",
      name: "HLEN + PLEN",
      rustField: "pub hlen: u8, pub plen: u8,",
      rustType: "u8 × 2",
      offsetStart: 18,
      offsetEnd: 20,
      layer: "ARP PAYLOAD (28B)",
      color: "#d08770",
      valueLabel: "6 Bytes MAC / 4 Bytes IPv4",
      hexBytes: ["06", "04"],
      desc: "Octet lengths for hardware addresses (6B) and IPv4 protocol addresses (4B).",
    },
    {
      id: "opcode",
      name: "ARP Operation Code",
      rustField: "pub oper: u16,",
      rustType: "u16 (BE)",
      offsetStart: 20,
      offsetEnd: 22,
      layer: "ARP PAYLOAD (28B)",
      color: "#e06c75",
      valueLabel: cfg.opcodeDesc,
      hexBytes: cfg.opcodeHex,
      desc: "Determines whether the frame is an ARP Request (0x0001) or ARP Reply / Gratuitous assertion (0x0002).",
    },
    {
      id: "sha",
      name: "Sender Hardware Addr (SHA)",
      rustField: "pub sha: [u8; 6],",
      rustType: "[u8; 6]",
      offsetStart: 22,
      offsetEnd: 28,
      layer: "ARP PAYLOAD (28B)",
      color: "#a3be8c",
      valueLabel: cfg.srcMacLabel,
      hexBytes: cfg.srcMacHex,
      desc: "Hardware MAC address bound to the Sender Protocol Address in the receiver's neighbour table.",
    },
    {
      id: "spa",
      name: "Sender Protocol Addr (SPA)",
      rustField: "pub spa: [u8; 4],",
      rustType: "[u8; 4]",
      offsetStart: 28,
      offsetEnd: 32,
      layer: "ARP PAYLOAD (28B)",
      color: "#b48ead",
      valueLabel: cfg.spaLabel,
      hexBytes: cfg.spaHex,
      desc: "IPv4 address associated with the Sender Hardware Address.",
    },
    {
      id: "tha_tpa",
      name: "Target MAC & IPv4 (THA + TPA)",
      rustField: "pub tha: [u8; 6], pub tpa: [u8; 4],",
      rustType: "[u8; 10]",
      offsetStart: 32,
      offsetEnd: 42,
      layer: "ARP PAYLOAD (28B)",
      color: "#88c0d0",
      valueLabel: `${cfg.tpaLabel}`,
      hexBytes: [...cfg.dstMacHex, ...cfg.tpaHex],
      desc: "Destination host hardware MAC (6 octets) and IPv4 address (4 octets) completing the 42-byte frame.",
    },
  ];

  // Flatten all 42 bytes with segment reference for the interactive hex dump
  const allBytes = segments.flatMap((seg) =>
    seg.hexBytes.map((hex, idx) => ({
      offset: seg.offsetStart + idx,
      hex,
      segmentId: seg.id,
      color: seg.color,
    })),
  );

  const activeSegment =
    segments.find((s) => s.id === activeFieldId) || segments[0];

  return (
    <div className="w-full">
      {/* Top Mode Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222222] bg-[#111111] px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(MODE_CONFIGS) as FrameMode[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                mode === k
                  ? "border-[#a3be8c]/50 bg-[#222222] text-[#f0efeb] shadow-[inset_2px_0_0_#a3be8c]"
                  : "border-[#222222] bg-[#181818] text-[#8e8c87] hover:border-[#3a3a3a] hover:text-[#c8c6c1]"
              }`}
            >
              {MODE_CONFIGS[k].label}
            </button>
          ))}
        </div>

        <div className="num text-[11px] text-[#8e8c87]">
          FRAME SIZE: <strong className="text-[#f0efeb]">42 OCTETS (336 BITS)</strong>
        </div>
      </div>

      {/* Mode Summary Banner */}
      <div className="border-b border-[#222222] bg-[#141414] px-6 py-4 text-[13.5px] text-[#c8c6c1]">
        {cfg.summary}
      </div>

      {/* Main Split: Left 7 Cols Interactive Octet Grid | Right 5 Cols Synchronized Hex & Rust FFI Struct */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left 7 Cols: Interactive 42-Octet Field Dissector */}
        <div className="min-w-0 lg:col-span-7 border-b lg:border-b-0 lg:border-r border-[#222222] bg-[#141414] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between text-[11px] text-[#8e8c87]">
            <span className="num font-semibold text-[#f0efeb]">
              INTERACTIVE OCTET MAP — HOVER OR CLICK ANY FIELD
            </span>
            <span className="num">OFFSET [00..42]</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {segments.map((seg) => {
              const isFocused = seg.id === activeFieldId;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onMouseEnter={() => setActiveFieldId(seg.id)}
                  onClick={() => setActiveFieldId(seg.id)}
                  style={{
                    borderColor: isFocused ? seg.color : "#262626",
                    boxShadow: isFocused ? `inset 2px 0 0 ${seg.color}` : "none",
                  }}
                  className={`flex flex-col justify-between border p-3 text-left transition-colors ${
                    isFocused ? "bg-[#1c1c1c]" : "bg-[#111111] hover:bg-[#181818]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="num text-[#8e8c87]">
                        [{String(seg.offsetStart).padStart(2, "0")}..
                        {String(seg.offsetEnd).padStart(2, "0")}]
                      </span>
                      <span
                        className="num font-semibold"
                        style={{ color: seg.color }}
                      >
                        {seg.offsetEnd - seg.offsetStart}B
                      </span>
                    </div>

                    <div className="mt-1.5 text-[12.5px] font-bold text-[#f0efeb]">
                      {seg.name}
                    </div>
                    <div className="num mt-0.5 truncate text-[11px] text-[#c8c6c1]">
                      {seg.valueLabel}
                    </div>
                  </div>

                  <div className="num mt-3 border-t border-[#222222] pt-1.5 text-[10px] text-[#8e8c87] truncate">
                    {seg.hexBytes.join(" ")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Field Explanation Box */}
          <div
            className="mt-4 border bg-[#0c0c0c] p-4"
            style={{ borderColor: activeSegment.color }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className="num text-[11.5px] font-bold"
                style={{ color: activeSegment.color }}
              >
                FIELD [{activeSegment.offsetStart}..{activeSegment.offsetEnd}] · {activeSegment.name}
              </span>
              <span className="num text-[11px] text-[#c8c6c1]">
                Rust Type: <code>{activeSegment.rustType}</code>
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#c8c6c1]">
              {activeSegment.desc}
            </p>
          </div>
        </div>

        {/* Right 5 Cols: Synchronized Raw Hex Dump + Rust #[repr(C, packed)] Memory Layout */}
        <div className="min-w-0 lg:col-span-5 flex flex-col justify-between divide-y divide-[#222222] bg-[#0c0c0c]">
          {/* Top Half: Live Cross-Highlighted 42-Byte Hex Dump */}
          <div className="p-5 sm:p-6 min-w-0">
            <div className="mb-3 flex items-center justify-between text-[11px]">
              <span className="num font-semibold text-[#f0efeb]">
                RAW WIRE MEMORY DUMP (42 BYTES)
              </span>
              <span className="num text-[#8e8c87]">NETWORK BYTE ORDER</span>
            </div>

            <div className="space-y-1.5 border border-[#222222] bg-[#111111] p-3.5 font-mono text-[11.5px]">
              {[0, 16, 32].map((rowStart) => {
                const rowBytes = allBytes.slice(rowStart, rowStart + 16);
                return (
                  <div key={rowStart} className="flex items-center gap-3">
                    <span className="num w-11 shrink-0 text-[#6e6c68]">
                      {rowStart.toString(16).padStart(4, "0")}:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {rowBytes.map((b) => {
                        const isHighlighted = b.segmentId === activeFieldId;
                        return (
                          <button
                            key={b.offset}
                            type="button"
                            onMouseEnter={() => setActiveFieldId(b.segmentId)}
                            onClick={() => setActiveFieldId(b.segmentId)}
                            style={{
                              backgroundColor: isHighlighted
                                ? b.color
                                : "transparent",
                              color: isHighlighted ? "#0c0c0c" : "#c8c6c1",
                            }}
                            className="num px-1 py-0.5 text-[11px] font-semibold transition-colors hover:bg-[#222222]"
                          >
                            {b.hex}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Half: Synchronized Rust FFI Struct Definition */}
          <div className="p-6">
            <div className="mb-3 flex items-center justify-between text-[11px]">
              <span className="num font-semibold text-[#f0efeb]">
                RUST FFI STRUCT · #[repr(C, packed)]
              </span>
              <span className="num text-[#a3be8c]">src-tauri/src/packet.rs</span>
            </div>

            <div className="border border-[#222222] bg-[#111111] p-3.5 font-mono text-[11px] leading-[1.65]">
              <div className="text-[#8e8c87]">#[repr(C, packed)]</div>
              <div className="text-[#f0efeb]">pub struct ArpFrame &#123;</div>
              {segments.map((seg) => {
                const isHighlighted = seg.id === activeFieldId;
                return (
                  <div
                    key={seg.id}
                    onMouseEnter={() => setActiveFieldId(seg.id)}
                    onClick={() => setActiveFieldId(seg.id)}
                    style={{
                      backgroundColor: isHighlighted
                        ? "rgba(240, 239, 235, 0.07)"
                        : "transparent",
                      color: isHighlighted ? seg.color : "#c8c6c1",
                    }}
                    className="flex cursor-pointer items-center justify-between px-2 transition-colors"
                  >
                    <span>  {seg.rustField}</span>
                    <span className="num text-[10px] text-[#6e6c68]">
                      // +{seg.offsetStart}..{seg.offsetEnd}
                    </span>
                  </div>
                );
              })}
              <div className="text-[#f0efeb]">&#125;</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
