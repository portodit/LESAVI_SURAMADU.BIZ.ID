/**
 * Dynamic public base URL tracker.
 *
 * The Telegram bot sends URLs to users via messages. These URLs must match
 * the host the user actually uses to access the dashboard/API.
 *
 * Since the server binds to 0.0.0.0 and the public IP can change (e.g.
 * NordLynx VPN, different Wi-Fi), we dynamically detect the public URL
 * from incoming HTTP request headers (x-forwarded-host / host).
 *
 * The poller uses this instead of process.env so URLs in Telegram messages
 * always match the host the user is browsing from.
 */

let _currentPublicBaseUrl: string = process.env["PUBLIC_BASE_URL"] || "http://localhost:8000";

export function getPublicBaseUrl(): string {
  return _currentPublicBaseUrl;
}

export function setPublicBaseUrl(url: string): void {
  _currentPublicBaseUrl = url;
}
