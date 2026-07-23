# Croc File Transfer — Integration Brief

**For:** vivim-final networked workspace sync  
**Status:** Future — not yet implemented  
**Effort:** ~9 days  

---

## What

[Croc](https://github.com/schollz/croc) is a Go-based file transfer tool with PAKE encryption and self-hostable relay. Enables encrypted file/folder transfers between machines using a 9-character code.

## Why

vivim-final is currently single-machine. Croc enables:
- **Multi-device sync** — Share chrome profiles, conversation history between machines
- **Profile backup** — Transfer authenticated chrome profiles
- **Dev handoff** — Send working environment to another developer
- **Collaborative sessions** — Multiple users on same provider accounts

## How

**Integration:** CLI wrapper via `Bun.child_process.spawn` (not Go library embedding).

```
Bun backend → child_process.spawn('croc') → parse stdout → return result
```

**Why CLI over Go library:** No FFI bridge needed, cross-platform, upgradeable.

## Key Findings

- **Security:** PAKE encryption, relay never sees plaintext (E2E)
- **Relay:** Self-hostable via Docker, ports 9009-9013
- **Resume:** Supports interrupted transfer resume
- **No JSON output:** Must parse stdout text patterns
- **Performance:** Fast for large files, direct TCP when possible

## Comparison

| | Croc | rsync | Syncthing | Wormhole |
|---|---|---|---|---|
| Self-host relay | ✅ | N/A | N/A | ✅ |
| No config | ✅ | ❌ | ❌ | ✅ |
| Resume | ✅ | ✅ | ✅ | ❌ |
| Speed | Fast | Fast | Fast | Medium |

## Implementation Plan

| Task | Days | Description |
|------|------|-------------|
| CrocTransferEngine | 2 | CLI wrapper, progress parsing, error handling |
| Self-hosted relay | 1 | Docker compose or embedded relay |
| Capability registration | 1 | `send_file` / `recv_file` capabilities |
| Profile sync | 2 | Chrome profile serialization + transfer |
| Conversation sync | 2 | DB export/import + transfer |
| Tests | 1 | Unit + integration tests |

## Next Steps

1. **Install croc** — `npm install -g croc` or binary download
2. **Implement CrocTransferEngine** — CLI wrapper with progress events
3. **Register capabilities** — `send_file`, `recv_file`, `start_relay`
4. **First use case** — Chrome profile backup/restore

## References

- GitHub: https://github.com/schollz/croc (37.7K stars)
- Docs: https://github.com/schollz/croc#readme
- Docker: https://hub.docker.com/r/schollz/croc
