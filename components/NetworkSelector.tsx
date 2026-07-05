'use client';

import React, { useEffect, useState } from 'react';
import { NetworkInterfaceInfo } from '@/types/network';
import { Radio } from 'lucide-react';

interface NetworkSelectorProps {
  onCidrChange: (cidr: string) => void;
  selectedCidr: string;
}

export default function NetworkSelector({ onCidrChange, selectedCidr }: NetworkSelectorProps) {
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'preset' | 'manual'>('preset');
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    async function fetchInterfaces() {
      try {
        const res = await fetch('/api/network/interfaces');
        if (!res.ok) {
          throw new Error('Failed to retrieve network adapters');
        }
        const data = await res.json();
        setInterfaces(data);

        // Auto-select first active network if present
        if (data.length > 0) {
          onCidrChange(data[0].cidr);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading interfaces');
      } finally {
        setLoading(false);
      }
    }

    fetchInterfaces();
  }, [onCidrChange]);

  const handleSelectPreset = (cidr: string) => {
    setMode('preset');
    onCidrChange(cidr);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput) return;
    onCidrChange(manualInput.trim());
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 shadow-sm" id="network-selector-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Radio className="w-4 h-4 text-blue-500" />
          Network Selection
        </h2>
        <div className="flex bg-[#0D1117] border border-[#30363D] rounded p-0.5" id="interface-mode-selector">
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded transition-colors ${
              mode === 'preset'
                ? 'bg-[#21262D] text-white font-medium border border-[#30363D]/50'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setMode('preset');
              if (interfaces.length > 0) {
                onCidrChange(interfaces[0].cidr);
              }
            }}
            id="mode-preset-btn"
          >
            Auto Detect
          </button>
          <button
            type="button"
            className={`px-3 py-1 text-xs rounded transition-colors ${
              mode === 'manual'
                ? 'bg-[#21262D] text-white font-medium border border-[#30363D]/50'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setMode('manual');
              if (manualInput) {
                onCidrChange(manualInput);
              }
            }}
            id="mode-manual-btn"
          >
            Manual Subnet
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Detecting networks...
        </div>
      ) : error ? (
        <div className="p-3 bg-red-950/40 border border-red-900/50 rounded text-red-400 text-xs mb-3">
          {error}
        </div>
      ) : mode === 'preset' ? (
        <div className="space-y-2">
          {interfaces.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-2">
              No private network adapters detected.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="network-interfaces-grid">
              {interfaces.map((item) => (
                <button
                  key={item.name + item.address}
                  type="button"
                  onClick={() => handleSelectPreset(item.cidr)}
                  className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                    selectedCidr === item.cidr
                      ? 'bg-[#21262D] border-blue-500/50 ring-1 ring-blue-500/20'
                      : 'bg-[#0D1117] border-[#30363D] hover:border-[#3C444D] hover:bg-[#21262D]/60'
                  }`}
                  id={`interface-${item.name.toLowerCase()}`}
                >
                  <span className="text-xs font-semibold text-gray-300 mb-1 flex items-center justify-between w-full">
                    <span>{item.name}</span>
                    {selectedCidr === item.cidr && (
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    Host IP: <span className="text-gray-200">{item.address}</span>
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    Subnet: <span className="text-blue-400 font-medium">{item.cidr}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-3" id="manual-cidr-form">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 192.168.1.0/24"
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value);
                onCidrChange(e.target.value);
              }}
              className="flex-1 bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm font-mono text-[#E0E0E0] placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="manual-cidr-input"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium px-4 py-2 transition-colors shadow-lg shadow-blue-900/20"
              id="manual-cidr-apply-btn"
            >
              Apply
            </button>
          </div>
          <p className="text-[10px] text-gray-500 leading-normal">
            Note: For performance safety, scanning is locked to standard private Class C networks of suffix <span className="font-mono">/24</span> (254 potential hosts) up to <span className="font-mono">/32</span>.
          </p>
        </form>
      )}
    </div>
  );
}
