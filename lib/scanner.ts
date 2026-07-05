import net from 'net';
import { ScanResult } from '@/types/network';
import { generateIpsForCidr } from './ip';

/**
 * Scan a single host and port for TCP socket connectivity and detect FTP signature.
 */
export function scanHostPort(host: string, port: number, timeoutMs = 600): Promise<ScanResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;
    let banner = '';
    let bannerTimer: NodeJS.Timeout | null = null;

    const cleanupAndResolve = (status: 'open' | 'closed', likelyFtp: boolean, bannerText: string) => {
      if (isResolved) return;
      isResolved = true;

      if (bannerTimer) {
        clearTimeout(bannerTimer);
      }

      socket.destroy();
      resolve({
        host,
        port,
        status,
        banner: bannerText,
        likelyFtp,
      });
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      // Connected! We wait a short duration (up to 350ms) to read the initial FTP greeting (usually starting with 220).
      bannerTimer = setTimeout(() => {
        // If no greeting but connected, it might still be an FTP server (some servers wait for command first or are slow),
        // or just an open port. We mark as open.
        const isStandardPort = [21, 2121, 2221, 8021, 3721].includes(port);
        cleanupAndResolve('open', isStandardPort, banner || '(Connected, no banner received)');
      }, 350);
    });

    socket.on('data', (data) => {
      const text = data.toString('utf8').trim();
      banner = text;
      
      // Typical FTP banner starts with '220' (e.g. "220 Android FTP Server ready")
      const isFtpBanner = text.startsWith('220') || text.toLowerCase().includes('ftp');
      cleanupAndResolve('open', isFtpBanner, text);
    });

    socket.on('error', () => {
      cleanupAndResolve('closed', false, '');
    });

    socket.on('timeout', () => {
      cleanupAndResolve('closed', false, '');
    });
  });
}

/**
 * Promise-pool implementation for concurrent network operations.
 */
async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: Promise<R>[] = [];
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const p = fn(item);
    results.push(p);

    if (limit <= items.length) {
      const e: Promise<any> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

interface ScanTarget {
  host: string;
  port: number;
}

/**
 * Scan a full CIDR block for FTP ports under controlled concurrency (default: 50 concurrent checks).
 */
export async function scanSubnet(
  cidr: string,
  ports: number[],
  concurrencyLimit = 50,
  timeoutMs = 600
): Promise<ScanResult[]> {
  // Generate list of IPs
  const ips = generateIpsForCidr(cidr);
  const targets: ScanTarget[] = [];

  // Create targets array (all IP/Port combinations)
  for (const ip of ips) {
    for (const port of ports) {
      targets.push({ host: ip, port });
    }
  }

  // Scan all targets concurrently with a limit
  const allResults = await runWithLimit<ScanTarget, ScanResult>(
    targets,
    concurrencyLimit,
    (target) => scanHostPort(target.host, target.port, timeoutMs)
  );

  // Return only positive (open) results
  return allResults.filter((r) => r.status === 'open');
}
