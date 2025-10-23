# Secure Tunnel with Cloudflared

Cloudflare Tunnel provides an alternative to Tailscale when you need HTTPS ingress from the public internet.

1. Install the `cloudflared` daemon on the desktop running Anki and the backend.
2. Authenticate `cloudflared` with your Cloudflare account (`cloudflared login`).
3. Create a tunnel: `cloudflared tunnel create anki-voice`.
4. Configure the tunnel to forward to the local backend by editing the generated YAML to include:

```yaml
url: http://localhost:8000
```

5. Run the tunnel: `cloudflared tunnel run anki-voice`.
6. Update DNS in the Cloudflare dashboard to map a hostname to the tunnel.
7. Configure the client settings to use the public hostname and ensure `API_TOKEN` is set for Bearer authentication.

This approach allows remote access without opening firewall ports while leveraging Cloudflare's edge network for TLS termination.
