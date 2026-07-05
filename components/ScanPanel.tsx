'use client';

import React, { useState } from 'react';
import { ScanResult } from '@/types/network';
import { Server, Play, ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

interface ScanPanelProps {
  cidr: string;
  onConnectServer: (host: string, port: number) => void;
}

const DEFAULT_PORTS = [21, 2121, 2221, 8021, 3721];

export default function ScanPanel({ cidr, onConnectServer }: ScanPanelProps) {
  const [selectedPorts, setSelectedPorts] = useState<number[]>(DEFAULT_PORTS);
  const [customPortInput, setCustomPortInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleTogglePort = (port: number) => {
    if (selectedPorts.includes(port)) {
      setSelectedPorts(selectedPorts.filter((p) => p !== port));
    } else {
      setSelectedPorts([...selectedPorts, port]);
    }
  };

  const handleAddCustomPort = (e: React.FormEvent) => {
    e.preventDefault();
    const port = parseInt(customPortInput);
    if (isNaN(port) || port < 1 || port > 65535) return;
    if (!selectedPorts.includes(port)) {
      setSelectedPorts([...selectedPorts, port]);
    }
    setCustomPortInput('');
  };

  const handleStartScan = async () => {
    if (selectedPorts.length === 0) {
      setError('Please select at least one port to scan.');
      return;
    }
    setError(null);
    setWarning(null);
    setScanning(true);
    setResults(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cidr,
          ports: selectedPorts,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Network scanning failed.');
      }

      if (data.warning) {
        setWarning(data.warning);
      }
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || 'Error occurred while scanning.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 shadow-sm space-y-5" id="scan-panel-container">
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1">
          <Server className="w-4 h-4 text-blue-500" />
          FTP Port Scanner
        </h2>
        <p className="text-xs text-gray-400">
          Scan the selected range <span className="text-blue-400 font-mono font-medium">{cidr}</span> for active FTP file-sharing services.
        </p>
      </div>

      {/* Warning Notice */}
      <div className="flex gap-2.5 p-3 bg-[#0D1117] border border-[#30363D] rounded" id="scan-warning-box">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span className="text-[11px] text-gray-400 leading-normal">
          Only scan devices and networks you own or have permission to access.
        </span>
      </div>

      {/* Ports Configuration */}
      <div className="space-y-3" id="ports-config-box">
        <label className="text-xs text-gray-400 mb-1.5 block">Target Ports</label>
        <div className="flex flex-wrap gap-2" id="preset-ports-checkboxes">
          {DEFAULT_PORTS.map((port) => (
            <button
              key={port}
              type="button"
              onClick={() => handleTogglePort(port)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all border ${
                selectedPorts.includes(port)
                  ? 'bg-[#21262D] border-[#30363D] text-[#E0E0E0]'
                  : 'bg-[#0D1117] border-[#30363D] text-gray-500 hover:border-[#3C444D]'
              }`}
              id={`port-toggle-${port}`}
            >
              Port {port}
            </button>
          ))}
        </div>

        {/* Custom Port Adder */}
        <form onSubmit={handleAddCustomPort} className="flex gap-2 max-w-xs" id="custom-port-form">
          <input
            type="number"
            min="1"
            max="65535"
            placeholder="Custom port (e.g. 5000)"
            value={customPortInput}
            onChange={(e) => setCustomPortInput(e.target.value)}
            className="flex-1 bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs font-mono text-[#E0E0E0] placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            id="custom-port-input"
          />
          <button
            type="submit"
            className="bg-[#30363D] hover:bg-[#3C444D] text-[#E0E0E0] border border-[#30363D]/50 px-3 py-1.5 text-xs font-semibold rounded transition-colors"
            id="custom-port-add-btn"
          >
            Add
          </button>
        </form>
      </div>

      {/* Trigger Button */}
      <div className="pt-1">
        <button
          type="button"
          disabled={scanning || !cidr}
          onClick={handleStartScan}
          className={`w-full py-2 rounded text-sm font-medium transition-all ${
            scanning
              ? 'bg-[#30363D]/50 border border-[#30363D] text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg shadow-blue-900/20 active:scale-[0.99]'
          }`}
          id="trigger-scan-btn"
        >
          {scanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500 inline mr-2" />
              Scanning subnet... (Controlled Concurrency Pool Active)
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current inline mr-2" />
              Scan Subnet {cidr}
            </>
          )}
        </button>
      </div>

      {/* Display Scan Errors */}
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-900/50 rounded text-red-400 text-xs font-medium" id="scan-error-msg">
          {error}
        </div>
      )}

      {/* Display Scan Warnings */}
      {warning && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded text-amber-200 text-xs leading-relaxed" id="scan-warning-msg">
          <p className="font-semibold mb-1 flex items-center gap-1 text-amber-400">
            <span>⚠️ Environment Advisory</span>
          </p>
          {warning}
        </div>
      )}

      {/* Scan Results Table */}
      {results !== null && (
        <div className="space-y-3 pt-2" id="scan-results-box">
          <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-blue-500" />
            Discovered Services ({results.length})
          </h3>

          {results.length === 0 ? (
            <div className="text-center py-6 bg-[#0D1117] border border-[#30363D] rounded text-xs text-gray-500">
              No FTP servers found. Verify that the server application (e.g. Android WiFi FTP) is active and connected to the same network.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#30363D] rounded bg-[#0D1117]" id="scan-results-table">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#30363D] bg-[#161B22] text-gray-500 text-[11px] font-semibold tracking-wider font-sans uppercase">
                    <th className="px-4 py-3">Host IP</th>
                    <th className="px-4 py-3">Port</th>
                    <th className="px-4 py-3">Server Greeting / Banner</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21262D] text-xs font-mono text-[#E0E0E0]">
                  {results.map((srv) => (
                    <tr key={`${srv.host}:${srv.port}`} className="hover:bg-[#21262D]/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-blue-400">{srv.host}</td>
                      <td className="px-4 py-3 text-gray-400">
                        <span className="text-[10px] px-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-mono">PORT {srv.port}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[240px] truncate text-gray-400 italic text-[11px]" title={srv.banner}>
                        {srv.banner}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onConnectServer(srv.host, srv.port)}
                          className="px-2.5 py-1.5 text-xs bg-blue-600/10 text-blue-400 border border-blue-600/30 rounded hover:bg-blue-600/20 font-sans"
                        >
                          Connect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
