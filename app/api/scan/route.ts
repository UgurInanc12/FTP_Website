import { NextRequest, NextResponse } from 'next/server';
import { scanRequestSchema } from '@/lib/validation';
import { scanSubnet } from '@/lib/scanner';
import { isCloudEnvironment } from '@/lib/ip';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request schema
    const parseResult = scanRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'Invalid scan request' },
        { status: 400 }
      );
    }

    const { cidr, ports } = parseResult.data;

    // Check if we are running in the cloud
    const hostHeader = req.headers.get('host');
    if (isCloudEnvironment(hostHeader)) {
      return NextResponse.json({
        results: [],
        warning: `Cloud Sandbox Limitation: Scanning the subnet ${cidr} from Google Cloud Run is not supported. The cloud-hosted server has no physical access to your local network router or device subnets. To scan your local network for FTP servers, please export this project and run it locally on your computer with 'npm run dev'.`
      });
    }

    // Scan subnet for open ports
    // Defaulting timeout to 600ms per port check for fast LAN discovery
    const scanResults = await scanSubnet(cidr, ports, 50, 600);

    return NextResponse.json({ results: scanResults });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Subnet scan failed: ' + error.message },
      { status: 500 }
    );
  }
}
