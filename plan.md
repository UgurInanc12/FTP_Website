# Multi-Server FTP Browser with Grid and Media Previews

## Summary

On every refresh, detect and scan all private PC network adapters as bounded `/24` subnets. List every discovered FTP endpoint in the sidebar, require an explicit Connect action, maintain independent sessions and folder locations per server, and display the selected server's files in a scalable preview grid.

## Discovery and Connections

- Convert every private IPv4 interface into its containing `/24` and scan all distinct subnets sequentially.
- Deduplicate FTP endpoints by `host:port`; retain manual server entry.
- Keep independent connection, authentication, path, items, loading, and error state for every endpoint.
- Store credentials only in opaque server-memory sessions that expire after 60 minutes.
- Never connect automatically. Users explicitly connect and disconnect each server.

## Paths and Media

- Remember the last successful path for each `host:port` in local storage without storing credentials.
- Restore the saved path after reconnecting, falling back to `/` when it is unavailable.
- Preserve cached directory state while switching between connected servers.
- Use session-based listing and range-capable media routes for previews, seeking, and downloads.
- Normalize FTP paths and reject traversal, control characters, invalid ranges, and oversized text previews.

## Grid and Preview

- Render directories first in a responsive virtualized grid suitable for thousands of files.
- Provide persistent Compact, Standard, and Large grid sizes.
- Provide persistent server-order, newest, oldest, name, and size sorting; creation dates are not claimed because FTP does not expose them.
- Lazy-load cached image thumbnails and browser-native video frames only for visible cards.
- Limit video poster extraction to two concurrent streams and capture each card poster as a maximum 640×360 WebP; fullscreen preview remains full quality.
- Support per-folder multi-selection with Select all and Unselect all without changing selection when a file preview opens.
- Preview images, video, audio, PDF, and safe text files in an accessible modal.
- Keep unsupported files download-only and stream large downloads without browser blob buffering.

## Verification

- Verify multiple `/24` adapters, deduplication, explicit login, and multiple simultaneous server sessions.
- Verify per-server path restoration across switching, reconnecting, and page refresh.
- Validate the 4,456-item Camera folder, virtualization, thumbnails, range seeking, previews, and downloads.
- Run lint, production build, API checks, and desktop/mobile browser checks.
