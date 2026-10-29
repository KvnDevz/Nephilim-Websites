import React, { useState } from "react";
import {
  Download,
  Copy,
  Check,
  Terminal,
  ExternalLink,
} from "lucide-react";

const PACKAGES = [
  {
    id: "nsis",
    name: "AirCut Setup (NSIS Desktop Installer)",
    filename: "AirCut_1.0.0_x64-setup.exe",
    url: "/downloads/AirCut_1.0.0_x64-setup.exe",
    size: "1.92 MB",
    bytes: "2,014,451 bytes",
    arch: "Windows 10 / 11 (x86_64)",
    sha256: "7128D7CCAF596DF28D2E57E63A0D076CC478ABC78AD8A3C05FB0DA21839EF2B4",
    primary: true,
    desc: "Standard production installer with automatic Start Menu registration, UAC elevation manifest, and clean uninstaller.",
  },
  {
    id: "portable",
    name: "AirCut Portable (Standalone Executable)",
    filename: "AirCut_1.0.0_portable.exe",
    url: "/downloads/AirCut_1.0.0_portable.exe",
    size: "7.10 MB",
    bytes: "7,443,456 bytes",
    arch: "Windows 10 / 11 (x86_64)",
    sha256: "290D2BBA1CBD33AE4C2879B0ADBA703DE2B6BD0336E38BF41595A52447ED09B1",
    primary: false,
    desc: "Single self-contained binary with zero registry writes. Ideal for USB incident-response toolkits and ephemeral lab audits.",
  },
];

export function DownloadHub() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <section
      id="downloads"
      className="scroll-mt-12 w-full border-b border-[#222222] bg-[#141414]"
    >
      <div className="mx-auto max-w-[1360px] border-x border-[#222222]">
        {/* Section Header Row (Split 5 / 7, Zero Eyebrow Kicker) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-[#222222] bg-[#111111]">
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#222222] p-6 sm:p-10">
            <h2 className="text-[clamp(1.65rem,2.8vw,2.4rem)] font-bold tracking-[-0.03em] text-[#f0efeb] leading-[1.1] [text-wrap:balance]">
              Production Binary Distribution.
            </h2>
          </div>
          <div className="lg:col-span-7 flex items-center p-6 sm:p-10">
            <p className="max-w-[64ch] text-[14.5px] leading-[1.65] text-[#c8c6c1]">
              Compiled directly from the clean-room Rust + Tauri v2 source tree. Verify every artifact against its cryptographic SHA-256 digest before execution.
            </p>
          </div>
        </div>

        {/* Side-by-Side Flush Binary Dispatch Cells (No Floating Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#222222] border-b border-[#222222]">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className="min-w-0 flex flex-col justify-between bg-[#141414] p-6 sm:p-10"
            >
              <div>
                <div className="flex items-baseline justify-between gap-4 border-b border-[#222222] pb-4">
                  <h3 className="text-[20px] font-bold tracking-[-0.02em] text-[#f0efeb]">
                    {pkg.name}
                  </h3>
                  <span className="num shrink-0 text-[14px] font-bold text-[#a3be8c]">
                    {pkg.size}
                  </span>
                </div>

                <p className="mt-3 text-[13.5px] leading-[1.6] text-[#c8c6c1]">
                  {pkg.desc}
                </p>

                {/* Tabular Artifact Specification Ledger */}
                <div className="mt-6 border border-[#222222] bg-[#0c0c0c] divide-y divide-[#222222] text-[12px]">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#8e8c87]">Artifact Filename</span>
                    <span className="num font-semibold text-[#f0efeb]">
                      {pkg.filename}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[#8e8c87]">Target Architecture</span>
                    <span className="num text-[#c8c6c1]">
                      {pkg.arch} · {pkg.bytes}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-[#8e8c87]">
                        SHA-256 CHECKSUM
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(pkg.id, pkg.sha256)}
                        className="num flex items-center gap-1.5 text-[11px] font-semibold text-[#a3be8c] hover:text-[#f0efeb] transition-colors"
                      >
                        {copiedId === pkg.id ? (
                          <>
                            <Check size={12} />
                            <span>COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>COPY SHA-256</span>
                          </>
                        )}
                      </button>
                    </div>
                    <code className="num block break-all text-[11px] text-[#c8c6c1]">
                      {pkg.sha256}
                    </code>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <a
                  href={pkg.url}
                  download={pkg.filename}
                  className={`flex h-12 w-full items-center justify-center gap-2.5 text-[13.5px] font-bold transition-colors ${
                    pkg.primary
                      ? "bg-[#a3be8c] text-[#0c0c0c] hover:bg-[#b5cea0]"
                      : "border border-[#3a3a3a] bg-[#181818] text-[#f0efeb] hover:bg-[#222222]"
                  }`}
                >
                  <Download size={16} className="stroke-[2.3]" />
                  <span>Download {pkg.filename}</span>
                  <span className="num text-[11.5px] opacity-80">
                    ({pkg.size})
                  </span>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Driver Dependency & PowerShell Verification Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#222222] bg-[#111111]">
          <div className="min-w-0 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-[15.5px] font-bold text-[#f0efeb]">
                Kernel Driver Prerequisite: WinPcap 4.1.3
              </h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-[#c8c6c1]">
                AirCut communicates directly with the NPF packet driver via{" "}
                <code className="num text-[#88c0d0]">wpcap.dll</code> and{" "}
                <code className="num text-[#88c0d0]">packet.dll</code>. Ensure{" "}
                <strong className="text-[#f0efeb]">WinPcap 4.1.3</strong> is installed prior to launching the engine.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#222222]">
              <a
                href="https://www.winpcap.org/install/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#88c0d0] hover:text-[#f0efeb] transition-colors"
              >
                <span>Obtain Official WinPcap 4.1.3 Driver</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div className="min-w-0 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[15.5px] font-bold text-[#f0efeb]">
                  PowerShell Integrity Verification
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      "ps-cmd",
                      "Get-FileHash .\\AirCut_1.0.0_x64-setup.exe -Algorithm SHA256",
                    )
                  }
                  className="num flex items-center gap-1.5 text-[11px] font-semibold text-[#a3be8c] hover:text-[#f0efeb]"
                >
                  {copiedId === "ps-cmd" ? (
                    <>
                      <Check size={12} />
                      <span>COPIED</span>
                    </>
                  ) : (
                    <>
                      <Terminal size={12} />
                      <span>COPY COMMAND</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[13px] text-[#c8c6c1]">
                Validate the downloaded installer checksum locally in Windows PowerShell:
              </p>
            </div>
            <div className="mt-4 border border-[#222222] bg-[#0c0c0c] px-3.5 py-2.5">
              <code className="num block text-[11.5px] text-[#a3be8c] overflow-x-auto">
                PS C:\Downloads&gt; Get-FileHash .\AirCut_1.0.0_x64-setup.exe -Algorithm SHA256
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
