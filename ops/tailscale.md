# Remote Access with Tailscale

Tailscale is the recommended approach for accessing the hands-free reviewer from a phone when the backend is running on a desktop.

1. Install Tailscale on the desktop computer that runs Anki and the backend.
2. Install the Tailscale mobile app on the phone that will access the Progressive Web App.
3. Authenticate both devices into the same Tailscale tailnet.
4. Start the backend (`uvicorn app.main:app --host 0.0.0.0`). The service will be reachable via the machine's Tailscale IP.
5. Update the client `.env` or settings to point `backendUrl` to `http://<tailscale-ip>:8000`.
6. Optionally set `API_TOKEN` and configure Bearer auth when exposing the API beyond localhost.

This approach keeps all traffic within a private, encrypted mesh network without exposing ports directly to the internet.
