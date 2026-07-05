export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  netmask: string;
  family: 'IPv4';
  cidr: string;
}

export interface ScanResult {
  host: string;
  port: number;
  status: 'open' | 'closed';
  banner: string;
  likelyFtp: boolean;
}
