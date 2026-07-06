export interface FtpItem {
  name: string;
  type: 'directory' | 'file' | 'link';
  size: number;
  modifiedAt: string | null;
}

export interface FtpListResponse {
  path: string;
  items: FtpItem[];
}
