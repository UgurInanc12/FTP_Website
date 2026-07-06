import path from 'path';

export function normalizeFtpPath(input: string): string {
  if (!input || /[\0\r\n\\]/.test(input)) {
    throw new Error('Invalid FTP path');
  }

  const segments = input.split('/');
  if (segments.includes('..')) {
    throw new Error('Path traversal is not allowed');
  }

  const absolute = input.startsWith('/') ? input : `/${input}`;
  const normalized = path.posix.normalize(absolute);
  if (!normalized.startsWith('/')) {
    throw new Error('Invalid FTP path');
  }
  return normalized;
}

export function joinFtpPath(parent: string, name: string): string {
  if (!name || name === '.' || name === '..' || /[\/\\\0\r\n]/.test(name)) {
    throw new Error('Invalid FTP item name');
  }
  return normalizeFtpPath(path.posix.join(parent, name));
}
