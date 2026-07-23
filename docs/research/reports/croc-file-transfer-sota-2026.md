# Croc File Transfer — State of the Art 2026

**Topic:** Croc integration for vivim-final networked workspace sync  
**Date:** 2026-07-23  
**Status:** Research complete, integration assessment pending  

---

## 1. What is Croc

Croc is a Go-based, cross-platform file transfer tool by schollz (37.7K GitHub stars, MIT license). It enables direct, encrypted file and folder transfers between computers over the internet or local network using a shared code (9-character human-readable phrase). No server configuration required.

**Key properties:**
- **Encryption:** PAKE (Password-Authenticated Key Exchange) — relay never sees plaintext
- **Transport:** TCP relay (ports 9009–9013) + direct TCP when possible
- **IPv6:** First-class support with IPv4 fallback
- **Resumable:** Transfers can resume after interruption
- **Multi-file:** Send entire directories or multiple files
- **Text transfer:** Can send clipboard/text snippets
- **Self-hostable:** Docker image or Go binary for private relay

**Version:** v10.5.0 (latest as of 2026-07-21)

---

## 2. Architecture

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│  Sender   │──PAKE──▶│ Relay Server │◀──PAKE──│ Receiver  │
│  (croc    │  TCP    │ (ports       │  TCP    │  (croc    │
│   send)   │         │  9009-9013)  │         │   recv)  │
└──────────┘         └──────────────┘         └──────────┘
     │                                               │
     └──────────── Direct TCP (if possible) ─────────┘
```

**Protocol flow:**
1. Sender calls `croc send <file>` → generates 9-char code
2. Receiver calls `croc recv <code>`
3. PAKE handshake over relay (code is the password)
4. If on same network: direct TCP connection established
5. If different networks: relay proxies encrypted data
6. File transfer with progress, resume support
7. Transfer complete, connection closed

**Relay server:**
- Default: public relay at `croc.schollz.com`
- Self-hosted: run `croc relay` or Docker container
- Ports: 9009 (control), 9010-9013 (data channels)
- No auth required (rate limiting by IP)

---

## 3. API Surface

### 3.1 CLI Interface (Primary)

```bash
# Send a file
croc send <file-or-dir>

# Receive with code
croc recv <9-char-code>

# Self-hosted relay
croc send --relay <relay-address> <file>
croc recv --relay <relay-address> <code>

# Resume interrupted transfer
croc send --resume <file>
croc recv --resume <code>

# Text transfer
croc send --text "hello world"
```

### 3.2 Go Library (Exported API)

```go
import "github.com/schollz/croc/src/croc"

// Send file programmatically
croc.Send(croc.SendOptions{
    Code:      "code-from-sender",
    FilePath:  "./myfile.txt",
    RelayAddress: "localhost:9009",
    // ...
})

// Receive file programmatically
croc.Receive(croc.ReceiveOptions{
    Code:      "code-from-sender",
    OutPath:   "./received/",
    RelayAddress: "localhost:9009",
    // ...
})
```

**Limitation:** Go library is not directly callable from TypeScript/Bun. Would require FFI bridge (bun-go) or subprocess.

### 3.3 JSON Output

**Not yet implemented.** GitHub issue #284 requests JSON output mode. Current CLI outputs human-readable text to stdout. Any TypeScript integration must parse stdout text patterns:
- `"Sending file '...' (X.X KB)"` — send started
- `"Receiving file '...' (X.X KB)"` — receive started  
- `"Progress: XX%"` — progress update (not always present)
- `"File received to ..."` — receive complete
- `"Code is: XXX-XXX-XXX"` — code for receiver

---

## 4. Security Model

- **PAKE encryption:** Code (9-char phrase) used as password via SRP-like protocol
- **E2E encryption:** Relay never sees plaintext data
- **No auth:** Relay doesn't authenticate users (rate limiting by IP)
- **No persistence:** Relay doesn't store files after transfer completes
- **MIT license:** Can self-host without restrictions

---

## 5. Comparison with Alternatives

| Feature | Croc | Magic Wormhole | rsync | Syncthing | OnionShare |
|---------|------|----------------|-------|-----------|------------|
| **Language** | Go | Python | C | Go | Python |
| **Encryption** | PAKE (E2E) | WAMP (PAKE) | SSH | TLS | Tor |
| **Self-host relay** | ✅ Docker | ✅ | N/A | N/A | N/A |
| **Resume** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Directory** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **No config** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Speed** | Fast | Medium | Fast | Fast | Slow |
| **Stars** | 37.7K | 13K | 12K | 60K | 9K |
| **Auth required** | No | No | SSH key | Device pairing | No |

**Why Croc over alternatives:**
- Fastest for ad-hoc transfers (Go vs Python)
- Self-hostable relay without config
- Resume support for large files
- No device pairing required (just share code)
- Works on all platforms without setup

---

## 6. Integration Assessment for vivim-final

### 6.1 Current State

vivim-final currently:
- Runs on a single machine (local-first)
- Backend: Bun + Prisma + TypeScript
- Frontend: Next.js 16 + React 19
- Chrome profiles in `chrome-profiles/<provider>/<account>/`
- Database in SQLite (Prisma)

### 6.2 Future Networked Use Cases

1. **Multi-device workspace sync** — Share chrome profiles, conversation history, parser configs between devices
2. **Collaborative sessions** — Multiple users accessing same provider accounts
3. **Profile backup/restore** — Transfer authenticated chrome profiles between machines
4. **Development handoff** — Send working dev environment to another developer

### 6.3 Recommended Integration: CLI Wrapper

```
┌─────────────────────────────────────────────┐
│  vivim-final Backend (Bun)                  │
│                                             │
│  ┌─────────────────────┐                    │
│  │ CrocTransferEngine  │ (new engine)       │
│  │  - sendFile(path)   │                    │
│  │  - recvFile(code)   │                    │
│  │  - selfHostRelay()  │                    │
│  └─────────┬───────────┘                    │
│            │ child_process.spawn            │
│            ▼                                │
│  ┌─────────────────────┐                    │
│  │ croc CLI binary     │                    │
│  │ (installed via      │                    │
│  │  npm/bun wrapper)   │                    │
│  └─────────────────────┘                    │
└─────────────────────────────────────────────┘
```

**Why CLI wrapper over Go library:**
- No FFI bridge needed (bun-go is experimental)
- Works on all platforms without compilation
- Can upgrade croc independently
- Simpler error handling (exit codes + stdout parsing)

---

## 7. Implementation Estimate

| Task | Effort | Notes |
|------|--------|-------|
| CrocTransferEngine | 2 days | CLI wrapper, progress parsing, error handling |
| Self-hosted relay | 1 day | Docker compose or embedded relay |
| UnifiedCapability registration | 1 day | `send_file`, `recv_file` capabilities |
| Profile sync feature | 2 days | Chrome profile serialization + transfer |
| Conversation sync | 2 days | DB export/import + transfer |
| Tests | 1 day | Unit + integration tests |
| **Total** | **9 days** | |

---

## 8. Risks & Open Questions

1. **No JSON output** — Must parse stdout text (fragile)
2. **Relay reliability** — Self-hosted relay needs monitoring
3. **Large file handling** — Chrome profiles can be 500MB+
4. **NAT traversal** — Direct TCP may fail behind some firewalls
5. **Concurrent transfers** — Croc code is single-use per transfer
6. **Bun compatibility** — `child_process.spawn` works but needs testing

---

## 9. Recommendation

**Proceed with CLI wrapper integration** for future networked features. Croc is mature, well-maintained, and fits vivim-final's local-first philosophy. Start with:

1. Install croc binary via npm wrapper or direct download
2. Implement `CrocTransferEngine` as new engine
3. Register `send_file` / `recv_file` capabilities
4. Use for chrome profile backup/restore as first use case

**Do not** invest in Go library embedding until bun-go FFI is more stable.
