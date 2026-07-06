# Local FTP

A local Next.js application for discovering multiple FTP servers on private networks, browsing large directories, previewing media, and downloading files.

## Requirements

- Node.js 20 or newer
- A computer connected to the same network as the FTP server
- The FTP server address and credentials if anonymous login is disabled

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Discovery starts automatically.

The app scans every detected private adapter as a bounded `/24`. Select a discovered server, choose anonymous access or enter credentials, and click Connect. Credentials remain in server memory only and expire after one hour.

Image thumbnails are cached under `.cache/ftp-thumbnails` and automatically limited to 512 MB.
