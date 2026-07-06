import { FtpItem } from './ftp';
import { ScanResult } from './network';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionEntry {
  key: string;
  server: ScanResult;
  status: ConnectionStatus;
  sessionId?: string;
  path: string;
  items: FtpItem[];
  loading: boolean;
  error?: string;
  anonymous: boolean;
  username: string;
  password: string;
}

export interface LoginValues {
  anonymous: boolean;
  username: string;
  password: string;
}
