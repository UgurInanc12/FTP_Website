# Project Plan: Local FTP Finder

## Architecture Overview

The "Local FTP Finder" is a full-stack Next.js web application designed to run locally (at `http://localhost:3000`) and safely discover, scan, connect to, browse, and download files from FTP servers on the same local area network (LAN), such as Android devices running FTP server apps.

```text
       Android Phone FTP Server (e.g., 192.168.1.44:2121)
                               ▲
                               │ [FTP Socket / TCP]
                               ▼
                    Next.js API Server Backend
                      (Node.js Net/Socket + basic-ftp)
                               ▲
                               │ [HTTP JSON REST]
                               ▼
                     React UI Frontend (SPA)
                               ▲
                               │ [Local Host / HTTP]
                               ▼
                       User's Web Browser
```

Since browsers are restricted from performing raw socket connections or scanning arbitrary network ports directly (due to security policies like CORS and mixed-content blocking), the **Next.js server-side backend acts as the secure network worker and FTP proxy**.

---

## API Routes Design

### 1. Detect Network Interfaces
- **Endpoint**: `GET /api/network/interfaces`
- **Goal**: Read host machine network adapters and detect private IPv4 subnets.
- **Payload**: None
- **Response**:
  ```json
  [
    {
      "name": "Wi-Fi",
      "address": "192.168.1.23",
      "netmask": "255.255.255.0",
      "family": "IPv4",
      "cidr": "192.168.1.0/24"
    }
  ]
  ```

### 2. Subnet Port Scanner
- **Endpoint**: `POST /api/scan`
- **Goal**: Scan a designated private `/24` subnet for specific FTP-associated ports.
- **Request Body (Zod Validated)**:
  ```json
  {
    "cidr": "192.168.1.0/24",
    "ports": [21, 2121, 2221, 8021, 3721]
  }
  ```
- **Response**:
  ```json
  {
    "results": [
      {
        "host": "192.168.1.44",
        "port": 2121,
        "status": "open",
        "banner": "220 Android FTP Server ready",
        "likelyFtp": true
      }
    ]
  }
  ```

### 3. Browse FTP Directory
- **Endpoint**: `POST /api/ftp/list`
- **Goal**: Establish a transient FTP connection and list contents of the specified path.
- **Request Body (Zod Validated)**:
  ```json
  {
    "host": "192.168.1.44",
    "port": 2121,
    "username": "anonymous",
    "password": "",
    "path": "/"
  }
  ```
- **Response**:
  ```json
  {
    "path": "/",
    "items": [
      {
        "name": "DCIM",
        "type": "directory",
        "size": 0,
        "modifiedAt": "2026-07-05T12:00:00.000Z"
      },
      {
        "name": "photo.jpg",
        "type": "file",
        "size": 2432112,
        "modifiedAt": "2026-07-05T12:00:00.000Z"
      }
    ]
  }
  ```

### 4. Stream FTP File Download
- **Endpoint**: `POST /api/ftp/download` (or `GET` with secure query parameters if needed, but `POST` avoids exposing credentials/paths in query string)
- **Goal**: Establish FTP connection, retrieve a file stream, and pipe it directly to the response with correct Content-Disposition header.
- **Request Body (Zod Validated)**:
  ```json
  {
    "host": "192.168.1.44",
    "port": 2121,
    "username": "anonymous",
    "password": "",
    "remotePath": "/DCIM/Camera/photo.jpg"
  }
  ```
- **Response**: Stream of `application/octet-stream` bytes.

---

## Data Flow Diagram

1. **Discovery Flow**:
   - UI Mounts ➔ Request `GET /api/network/interfaces` ➔ Backend inspects `os.networkInterfaces()` and filters private ranges ➔ UI populates subnet selection dropdown.

2. **Scanning Flow**:
   - User inputs CIDR or selects interface, clicks "Scan Network" ➔ POSTs to `/api/scan` ➔ Backend validates CIDR as a private `/24` range ➔ Generates list of 254 potential host IPs ➔ Initiates a controlled concurrency runner (max 50 concurrent sockets) ➔ Connects to target TCP ports with a 600ms timeout ➔ Read initial `220` greeting banner ➔ Cleanly close sockets ➔ Aggregates positive hosts and returns response ➔ UI renders found devices in a clean table.

3. **File Browsing & Navigation Flow**:
   - User clicks "Connect" on scanned host or fills manual connection form ➔ React updates local Connection State ➔ Requests `/api/ftp/list` for path `/` ➔ Backend connects via `basic-ftp`, logs in, fetches listings, closes client ➔ Returns array of file/folder objects ➔ UI renders paths and list ➔ User clicks folder ➔ React requests `/api/ftp/list` with appended path ➔ User clicks `..` ➔ React trims last path segment and requests parent path listing.

4. **Downloading Flow**:
   - User clicks "Download" for `video.mp4` ➔ Frontend initiates download via a hidden form or safe fetch blob stream ➔ Backend connects to target FTP ➔ Obtains stream via `client.downloadToStream(remotePath)` ➔ Pipes stream straight to Client response ➔ Closes FTP connection cleanly.

---

## Security Rules

To ensure a secure local execution sandbox and conform to standard network guidelines, we strictly implement:

1. **Private Range Restriction**: API will reject any IP or CIDR outside RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and loopback (`127.0.0.1`, `localhost`).
2. **Scan Size Limitation**: CIDR ranges larger than `/24` (more than 256 IPs) are strictly rejected to prevent excessive socket consumption and local denial of service.
3. **No Credential Logging**: Logging of FTP passwords or storing them permanently is completely disabled. All connections are stateless and transient.
4. **Controlled Socket Concurrency**: Concurrency is throttled to 50 active socket checks at any single moment. This prevents hitting system file descriptor limits and local network overload.
5. **Path Traversal Protection**: Inputs to folder navigation and file downloading are scrutinized to prevent remote traversal (e.g., escaping root or injecting arbitrary command streams in paths).
6. **Local Bind Default**: The app runs safely bounded to localhost.
7. **Notice Display**: Includes a tiny, crisp notice in the UI: *"Only scan devices and networks you own or have permission to access."*

---

## Implementation Steps

1. **Setup Project Metadata & Structure**:
   - Update `metadata.json` with descriptive name and description.
   - Setup typescript type definition folders.

2. **Build Library Utilities (`lib/`)**:
   - `lib/ip.ts`: CIDR math, private IP checker, range generators.
   - `lib/scanner.ts`: Concurrency-controlled TCP socket check with connection timeout and FTP signature detection.
   - `lib/ftp.ts`: Stateless wrappers around `basic-ftp` client listing and streaming.
   - `lib/validation.ts`: Zod schema validators for API parameters.

3. **Build Backend API Handlers (`app/api/`)**:
   - Implement `GET /api/network/interfaces`.
   - Implement `POST /api/scan` with concurrency constraints.
   - Implement `POST /api/ftp/list` using transient `basic-ftp` client.
   - Implement `POST /api/ftp/download` using streaming pipes.

4. **Build React UI Components (`components/`)**:
   - `components/NetworkSelector.tsx`: Dropdown selector of local network adapters and manual CIDR fields.
   - `components/ScanPanel.tsx`: Trigger scan button, progress indicator, and clean tabular layout of results.
   - `components/ManualConnection.tsx`: Direct input for FTP credentials & connection toggles.
   - `components/FileBrowser.tsx`: Interactive navigation, parent path links, file lists, and real-time triggers for download.

5. **Integrate into Home Page (`app/page.tsx`)**:
   - Design beautiful dark theme page with generous spacing, elegant typography, clear borders, and high contrast.
   - Assemble state machines to manage: Scanned hosts, Active connection parameters, current directory list, navigation path, and loading flags.

6. **Refinement & Testing**:
   - Test compilation with `compile_applet`.
   - Verify lint configurations with `lint_applet`.
   - Remove any mock indicators or placeholder sections.

---

## Testing Plan

1. **Subnet Generation & IP Check Tests**:
   - Validate `192.168.1.0/24` generates exactly 254 IPs (192.168.1.1 to 192.168.1.254).
   - Validate that passing public IPs like `8.8.8.8/24` or huge subnets like `192.168.0.0/16` returns a valid validation error.

2. **Port Scanner Socket Tests**:
   - Verify timeout works by connecting to an unused private host and ensuring it errors within the specified limit (e.g. 600ms) rather than waiting indefinitely.

3. **FTP Browsing Tests**:
   - Ensure folder links append correct forward slashes.
   - Ensure files trigger a clean attachment stream, download cleanly, and close active connections.

4. **E2E verification & Build Check**:
   - Build successfully in production mode (`npm run build`).
