import { NextResponse } from 'next/server';
import os from 'os';
import { isPrivateIp } from '@/lib/ip';
import { NetworkInterfaceInfo } from '@/types/network';

/**
 * Converts a dotted-decimal netmask string to prefix length (e.g. "255.255.255.0" -> 24).
 */
function netmaskToPrefix(netmask: string): number {
  return netmask
    .split('.')
    .map(Number)
    .map((num) => {
      // Validate bounds
      if (isNaN(num) || num < 0 || num > 255) return 0;
      return num.toString(2).split('1').length - 1;
    })
    .reduce((a, b) => a + b, 0);
}

/**
 * Computes the network address given an IP address and a netmask (e.g., "192.168.1.34", "255.255.255.0" -> "192.168.1.0").
 */
function getNetworkAddress(ip: string, netmask: string): string {
  const ipOctets = ip.split('.').map(Number);
  const maskOctets = netmask.split('.').map(Number);
  
  if (ipOctets.length !== 4 || maskOctets.length !== 4) {
    return ip;
  }

  const netOctets = ipOctets.map((octet, idx) => octet & maskOctets[idx]);
  return netOctets.join('.');
}

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const results: NetworkInterfaceInfo[] = [];

    for (const [name, infoList] of Object.entries(interfaces)) {
      if (!infoList) continue;

      for (const info of infoList) {
        // We only scan IPv4 and private local networks (e.g., Wi-Fi, Ethernet, localhost)
        if (info.family === 'IPv4' && !info.internal && isPrivateIp(info.address)) {
          const prefix = netmaskToPrefix(info.netmask);
          const baseNetwork = getNetworkAddress(info.address, info.netmask);
          
          results.push({
            name,
            address: info.address,
            netmask: info.netmask,
            family: 'IPv4',
            cidr: `${baseNetwork}/${prefix}`,
          });
        }
      }
    }

    // Always ensure we return localhost/loopback if no other adapter is active
    if (results.length === 0) {
      results.push({
        name: 'Loopback',
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        cidr: '127.0.0.0/8',
      });
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to read network interfaces: ' + error.message },
      { status: 500 }
    );
  }
}
