'use client';

import React, { useState } from 'react';
import { KeyRound, ShieldCheck, User } from 'lucide-react';

interface ManualConnectionProps {
  initialHost: string;
  initialPort: number;
  onConnect: (credentials: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  }) => void;
  loading: boolean;
}

export default function ManualConnection({
  initialHost,
  initialPort,
  onConnect,
  loading,
}: ManualConnectionProps) {
  const [host, setHost] = useState(initialHost);
  const [port, setPort] = useState(initialPort);
  const [username, setUsername] = useState('anonymous');
  const [password, setPassword] = useState('');
  const [anonymous, setAnonymous] = useState(true);

  // Synchronously adjust username/password based on anonymous toggle
  const handleAnonymousChange = (checked: boolean) => {
    setAnonymous(checked);
    if (checked) {
      setUsername('anonymous');
      setPassword('');
    } else {
      if (username === 'anonymous') {
        setUsername('');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host) return;
    
    onConnect({
      host,
      port: Number(port),
      username: anonymous ? 'anonymous' : username,
      password: anonymous ? '' : password,
    });
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 shadow-sm space-y-5" id="manual-connection-container">
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-blue-500" />
          FTP Credentials & Login
        </h2>
        <p className="text-xs text-gray-400">
          Enter target connection parameters or verify the credentials of the scanned device.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="credentials-form">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="address-port-fields">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Host IPv4 Address</label>
            <input
              type="text"
              required
              placeholder="e.g. 192.168.1.44"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm font-mono text-[#E0E0E0] placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="ftp-host-input"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Port</label>
            <input
              type="number"
              required
              min="1"
              max="65535"
              placeholder="2121"
              value={port || ''}
              onChange={(e) => setPort(Number(e.target.value))}
              className="bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm font-mono text-[#E0E0E0] placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="ftp-port-input"
            />
          </div>
        </div>

        {/* Anonymous Login Toggle */}
        <div className="flex items-center gap-2 py-1" id="anonymous-checkbox-box">
          <input
            type="checkbox"
            id="anonymous-login-check"
            checked={anonymous}
            onChange={(e) => handleAnonymousChange(e.target.checked)}
            className="rounded border-[#30363D] bg-[#0D1117] text-blue-600 focus:ring-blue-500/25 w-4 h-4 focus:outline-none cursor-pointer"
          />
          <label htmlFor="anonymous-login-check" className="text-xs text-gray-300 font-medium select-none cursor-pointer">
            Anonymous Connection (No password required)
          </label>
        </div>

        {/* Custom Username & Password (only active if not anonymous) */}
        {!anonymous && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in" id="credentials-fields">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-gray-400" /> Username
              </label>
              <input
                type="text"
                required={!anonymous}
                placeholder="FTP username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm font-mono text-[#E0E0E0] placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                id="ftp-username-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-gray-400" /> Password
              </label>
              <input
                type="password"
                placeholder="Leave blank if none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#0D1117] border border-[#30363D] rounded px-3 py-2 text-sm font-mono text-[#E0E0E0] placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                id="ftp-password-input"
              />
            </div>
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={loading || !host}
            className={`w-full py-2 rounded text-sm font-medium transition-all ${
              loading
                ? 'bg-[#30363D]/50 border border-[#30363D] text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg shadow-blue-900/20 border-0'
            }`}
            id="connect-submit-btn"
          >
            {loading ? 'Establishing Connection...' : 'Connect to Server'}
          </button>
        </div>
      </form>
    </div>
  );
}
