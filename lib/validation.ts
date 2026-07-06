import { z } from 'zod';
import { isValidPrivateCidr, isPrivateIp } from './ip';

/**
 * Validator for the /api/scan endpoint.
 * Restricts scanning to private LAN subnets with maximum size /24.
 */
export const scanRequestSchema = z.object({
  cidr: z.string().refine((val) => {
    const result = isValidPrivateCidr(val);
    return result.isValid;
  }, {
    message: 'Must be a valid private LAN IPv4 CIDR block (e.g. 192.168.1.0/24), max size /24',
  }),
  ports: z.array(z.number().int().min(1).max(65535)).min(1, 'At least one port must be specified'),
});

/**
 * Base validator for FTP connection parameters.
 * Restricts connection host to private LAN IPs only.
 */
export const ftpCredentialsSchema = z.object({
  host: z.string().refine((val) => isPrivateIp(val), {
    message: 'FTP host must be a valid private LAN IPv4 address',
  }),
  port: z.number().int().min(1).max(65535),
  username: z.string().optional().default('anonymous'),
  password: z.string().optional().default(''),
});

/**
 * Validator for directory listing.
 */
export const ftpListRequestSchema = ftpCredentialsSchema.extend({
  path: z.string().min(1, 'Directory path is required'),
});

/**
 * Validator for file downloads.
 */
export const ftpDownloadRequestSchema = ftpCredentialsSchema.extend({
  remotePath: z.string().min(1, 'Remote file path is required'),
});

export const ftpSessionRequestSchema = ftpCredentialsSchema.extend({
  path: z.string().min(1).default('/'),
});

export const ftpSessionListRequestSchema = z.object({
  sessionId: z.string().uuid(),
  path: z.string().min(1, 'Directory path is required'),
});
