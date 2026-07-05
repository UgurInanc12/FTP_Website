import ipaddr from 'ipaddr.js';

/**
 * Checks if a given IP address is in the private LAN IPv4 ranges or loopback.
 * Private IPv4 ranges (RFC 1918):
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - 127.0.0.0/8 (Loopback)
 */
export function isPrivateIp(ip: string): boolean {
  if (!ipaddr.IPv4.isValid(ip)) return false;
  try {
    const parsed = ipaddr.IPv4.parse(ip);
    const octets = parsed.octets;
    const [o1, o2] = octets;

    // 10.0.0.0/8
    if (o1 === 10) return true;
    // 172.16.0.0/12
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16
    if (o1 === 192 && o2 === 168) return true;
    // 127.0.0.0/8
    if (o1 === 127) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if a CIDR block is valid and resides in private IPv4 ranges.
 */
export function isValidPrivateCidr(cidr: string): { isValid: boolean; error?: string; prefix?: number } {
  if (!ipaddr.isValidCIDR(cidr)) {
    return { isValid: false, error: 'Invalid CIDR format (must be e.g. 192.168.1.0/24)' };
  }

  try {
    const [parsedIp, prefix] = ipaddr.parseCIDR(cidr);
    if (parsedIp.kind() !== 'ipv4') {
      return { isValid: false, error: 'Only IPv4 ranges are supported' };
    }

    if (!isPrivateIp(parsedIp.toString())) {
      return { isValid: false, error: 'Only private LAN IP ranges are allowed (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, or 127.0.0.0/8)' };
    }

    if (prefix < 24 || prefix > 32) {
      return { isValid: false, error: 'CIDR ranges larger than /24 are not allowed for scanning' };
    }

    return { isValid: true, prefix };
  } catch {
    return { isValid: false, error: 'Could not parse CIDR block' };
  }
}

/**
 * Generates all scanable host IP addresses for a given CIDR block.
 * For /24, returns the 254 active host IPs (skipping network and broadcast addresses).
 */
export function generateIpsForCidr(cidr: string): string[] {
  const validation = isValidPrivateCidr(cidr);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid CIDR');
  }

  const [parsedIp, prefix] = ipaddr.parseCIDR(cidr);
  const ipv4 = parsedIp as ipaddr.IPv4;
  const octets = ipv4.octets;

  // Use base-10 math to avoid 32-bit signed bitwise shifts issues in JavaScript
  const ipNum = octets[0] * 16777216 + octets[1] * 65536 + octets[2] * 256 + octets[3];
  
  // Calculate mask
  const numAddresses = Math.pow(2, 32 - prefix);
  const mask = 0xffffffff - (numAddresses - 1);
  const networkNum = (ipNum & mask) >>> 0;

  const ips: string[] = [];

  if (prefix === 32) {
    ips.push(ipv4.toString());
  } else if (prefix === 31) {
    ips.push(numToIp(networkNum), numToIp(networkNum + 1));
  } else {
    // Skip 0 (network address) and last (broadcast address)
    for (let i = 1; i < numAddresses - 1; i++) {
      ips.push(numToIp(networkNum + i));
    }
  }

  return ips;
}

function numToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

/**
 * Checks if the current execution is in a cloud-hosted environment (Google Cloud Run, etc.)
 */
export function isCloudEnvironment(hostHeader?: string | null): boolean {
  if (process.env.K_SERVICE || process.env.CLOUD_RUN_JOB) return true;
  if (hostHeader) {
    const lowerHost = hostHeader.toLowerCase();
    if (
      lowerHost.includes('.run.app') || 
      lowerHost.includes('europe-west') || 
      lowerHost.includes('googleusercontent') ||
      lowerHost.includes('aistudio')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the IP is a local LAN IP (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x) excluding 127.0.0.1.
 */
export function isLocalLanIp(ip: string): boolean {
  if (!ipaddr.IPv4.isValid(ip)) return false;
  try {
    const parsed = ipaddr.IPv4.parse(ip);
    const octets = parsed.octets;
    const [o1, o2] = octets;

    // 10.0.0.0/8
    if (o1 === 10) return true;
    // 172.16.0.0/12
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
    // 192.168.0.0/16
    if (o1 === 192 && o2 === 168) return true;

    return false;
  } catch {
    return false;
  }
}
