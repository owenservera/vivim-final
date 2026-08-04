# 06 — DNS & SSL Architecture

> **Status:** FINAL | **Date:** 2026-08-02

---

## 1. DNS Architecture

### 1.1 Wildcard Subdomain Strategy (Recommended)

```
*.vivim.live   →  CNAME  →  proxy.vivim.live
```

This single DNS record enables instant subdomain provisioning for every user. When a visitor navigates to `user1.vivim.live`, the DNS resolves to the central proxy, which reads the `Host` header and routes the request to the correct tunnel.

**Advantages:**
- Zero DNS changes per user
- Instant provisioning (no DNS propagation delay)
- Single SSL certificate covers all subdomains
- Simple to manage

**Disadvantages:**
- All subdomains point to the same IP
- No per-user IP isolation
- Subdomain length limited by DNS (63 characters per label)

### 1.2 DNS Records

| Record | Type | Value | TTL |
|--------|------|-------|-----|
| `*.vivim.live` | CNAME | `proxy.vivim.live` | 300 |
| `proxy.vivim.live` | A | `<proxy-ip>` | 300 |
| `tunnel.vivim.live` | A | `<tunnel-ip>` | 300 |
| `p2p.vivim.live` | A | `<p2p-ip>` | 300 |
| `auth.vivim.live` | A | `<auth-ip>` | 300 |
| `vivim.live` | A | `<web-ip>` | 300 |
| `www.vivim.live` | CNAME | `vivim.live` | 300 |

### 1.3 Bring Your Own Domain (Future — Phase 1)

Users can point their own domain to the VIVIM proxy:

1. User adds CNAME: `workspace.theircompany.com` → `proxy.vivim.live`
2. User verifies domain ownership via TXT record
3. Proxy reads `Host` header and routes to the correct tunnel
4. SSL certificate is provisioned via Let's Encrypt (HTTP-01 challenge)

---

## 2. SSL/TLS Architecture

### 2.1 Certificate Strategy

| Domain | Certificate | Provider | Auto-Renew |
|--------|-------------|----------|------------|
| `*.vivim.live` | Wildcard | Let's Encrypt (DNS-01) | Yes (Caddy/certbot) |
| `tunnel.vivim.live` | Covered by wildcard | — | — |
| `p2p.vivim.live` | Covered by wildcard | — | — |
| `auth.vivim.live` | Covered by wildcard | — | — |

### 2.2 TLS Termination

```
Visitor ──HTTPS──► Edge (Caddy/Cloudflare) ──WSS──► Tunnel Server ──WSS──► Desktop
                         │
                    TLS terminates here
                    (wildcard cert)
```

**Key Points:**
- TLS terminates at the edge (Caddy or Cloudflare)
- The tunnel is WSS (encrypted) from edge to desktop
- No certificates needed on the desktop machine
- The desktop client connects to `wss://tunnel.vivim.live/connect` (already encrypted)

### 2.3 Caddy Configuration (Recommended)

```caddyfile
# Caddyfile for vivim.live

*.vivim.live {
    # Wildcard SSL via DNS-01 challenge
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }

    # Route to tunnel server
    reverse_proxy tunnel:7000 {
        # WebSocket support
        header_up Connection {>Connection}
        header_up Upgrade {>Upgrade}
    }
}

tunnel.vivim.live {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy tunnel:7000
}

p2p.vivim.live {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy p2p-relay:443
}

auth.vivim.live {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy auth:3000
}
```

### 2.4 Cloudflare Alternative

If using Cloudflare instead of Caddy:

1. Add `*.vivim.live` to Cloudflare
2. Enable "Full (Strict)" SSL mode
3. Create a wildcard origin certificate
4. Install origin certificate on tunnel server
5. Cloudflare handles edge TLS + DDoS protection

---

## 3. Security Considerations

### 3.1 DNSSEC

Enable DNSSEC for `vivim.live` to prevent DNS hijacking:

```
vivim.live  DS  <key-tag> <algorithm> <digest-type> <digest>
```

### 3.2 HSTS

Add Strict-Transport-Security header:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 3.3 Certificate Pinning (Future)

For high-security deployments, consider certificate pinning in the desktop client:

- Pin the root CA of the Let's Encrypt certificate
- Pin the specific intermediate certificate
- Allow fallback to system trust store

---

## 4. Reserved Subdomains

The following subdomains are reserved and cannot be claimed by users:

| Subdomain | Purpose |
|-----------|---------|
| `www` | Main website |
| `api` | Public API |
| `tunnel` | Tunnel server |
| `p2p` | P2P relay |
| `auth` | Authentication service |
| `admin` | Admin dashboard |
| `status` | Status page |
| `docs` | Documentation |
| `app` | Web application |
| `staging` | Staging environment |
| `test` | Test environment |
| `demo` | Demo workspace |
| `blog` | Blog |
| `mail` | Email (MX) |
| `cdn` | CDN |

---

## 5. CDN Integration

### 5.1 Static Assets

Static assets (CSS, JS, images) for the workspace UI SHOULD be served from a CDN:

```
cdn.vivim.live/assets/{version}/...
```

This reduces bandwidth through the tunnel and improves performance.

### 5.2 Offline Page CDN

The offline page is served from a CDN for reliability:

```
cdn.vivim.live/offline/{subdomain}.html
```

When the proxy has no active tunnel for a subdomain, it serves the CDN-hosted offline page.
