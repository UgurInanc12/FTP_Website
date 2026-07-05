import { NextRequest, NextResponse } from 'next/server';
import { ftpListRequestSchema } from '@/lib/validation';
import { listFtpDirectory } from '@/lib/ftp';
import { isCloudEnvironment, isLocalLanIp } from '@/lib/ip';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate body
    const parseResult = ftpListRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid FTP connection request' },
        { status: 400 }
      );
    }

    const { host, port, username, password, path } = parseResult.data;

    const items = await listFtpDirectory(
      {
        host,
        port,
        username,
        password,
        timeoutMs: 6000, // 6 seconds connection timeout
      },
      path
    );

    return NextResponse.json({
      path,
      items,
    });
  } catch (error: any) {
    // Return friendly readable errors for typical FTP network conditions
    let errorMessage = error.message || 'Unknown FTP error';
    
    // Check if we are running in the cloud and connecting to a private LAN IP
    const hostHeader = req.headers.get('host');
    const isTargetLocal = req.body ? true : false; // We can parse the host from request data if validation succeeded
    
    // Fallback: extract host from body safely
    let targetHost = '';
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.json();
      targetHost = body.host || '';
    } catch {
      // Ignore
    }

    if (targetHost && isLocalLanIp(targetHost) && isCloudEnvironment(hostHeader)) {
      errorMessage = `Cloud Sandbox Limitation: You are accessing this application via Google Cloud. The cloud server cannot reach your phone's local network IP address (${targetHost}) because private addresses are not routable over the public internet. To connect successfully, please click the settings/export menu in the top right, download this project as a ZIP, and run it locally on your computer using 'npm install && npm run dev'.`;
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      errorMessage = 'Connection timed out. Ensure the FTP server is running and accessible on this port.';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused. Check host IP and Port.';
    } else if (errorMessage.includes('530') || errorMessage.toLowerCase().includes('login failed')) {
      errorMessage = 'Login failed. Invalid username or password.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
