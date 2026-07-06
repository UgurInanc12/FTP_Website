import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Local FTP',
  description: 'Discover, browse, and download files from FTP servers on your local network.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
