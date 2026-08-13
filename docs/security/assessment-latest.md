# Amuse-ical Chairs penetration-test assessment

- **Target:** https://amuseical.com
- **Assessment time (UTC):** 2026-08-13T16:46:17.550Z
- **Method:** Authorized, low-impact external web assessment plus source-backed authorization checks
- **Status:** Findings require remediation or risk acceptance before a security whitelist decision.

> This is an assessment of the reachable surface at a point in time, not a guarantee that the site has no vulnerabilities. It does not include credentialed testing, source-code exploitation, load testing, brute force, social engineering, or destructive actions.

## Executive summary

Observed findings: **11** — Critical: **0**, High: **1**, Medium: **2**, Low: **6**, Informational: **2**.

Checks run:

| Status | Count |
|---|---:|
| Pass | 33 |
| Warnings | 10 |
| Failures | 1 |
| Errors / not run | 0 |

## Findings

### SOCKET-PLAYER-IDENTITY-REBIND — Player identity can be rebound using a broadcast player ID

- **Severity:** high
- **Status:** open — this assessment did not apply remediation
- **Category:** authentication / session management
- **Description:** The player:join handler accepted an existing playerId from a different socket and rebound the existing player identity without proof of possession. The room roster/snapshot also exposes player IDs to room participants. A participant who learns another player ID can impersonate that player and submit game data on their behalf or disrupt their connection.
- **Evidence:**
  - `A second socket supplied the first test player’s playerId and received ok=true with the original player name.`
  - `Source: server/room.js:219-231 accepts playerId and rebinds the socket without a second credential.`
  - `Source: server/room.js:203-214 broadcasts player IDs in room:players summaries.`
  - `All identifiers were redacted from this report.`
- **Recommendation:** Use a separate unguessable reconnect credential that is never broadcast in room roster data; require that credential for reconnects and treat player IDs as non-secret identifiers only.

### SRC-ROOM-CODE-ONLINE-ENUMERATION — Short room codes have no evident online-guessing throttle

- **Severity:** medium
- **Status:** source-confirmed; dynamic rate test not performed — this assessment did not apply remediation
- **Category:** session management / abuse resistance
- **Description:** The player:join endpoint uses a 4-character room code drawn from 24 symbols (331776 possible combinations), returns a distinguishable room-not-found response, and has no explicit server-side rate-limit or failed-attempt control in the reviewed HTTP/Socket.IO wiring. This creates an online room-existence oracle; practical enumeration speed and edge protections were not stress-tested.
- **Evidence:**
  - `Source: server/room.js defines CODE_ALPHABET (24 symbols) and a 4-character generator.`
  - `Source: server/sockets.js handles player:join with a direct room lookup and distinguishable error.`
  - `Source review found no explicit rate-limit, throttle, quota, or failed-attempt control in server/sockets.js or server/app.js.`
- **Recommendation:** Add edge and application rate limits for failed joins, consider longer/high-entropy invite tokens, and avoid exposing a highly distinguishable room-existence oracle. Validate with an approved bounded rate-limit test.

### SRC-SOCKET-EVENT-RATE-LIMITS — Socket.IO player events lack an evident application rate-control layer

- **Severity:** medium
- **Status:** source-confirmed; dynamic flood test not performed — this assessment did not apply remediation
- **Category:** availability / input validation
- **Description:** The reviewed Socket.IO handlers forward player:submit and redemption:report payloads into room logic and allow sync:report to trigger roster broadcasts. No explicit per-socket rate limit, event quota, or shared schema/serialized-size guard was found in the reviewed wiring. A connected client may therefore cause disproportionate CPU, memory, or broadcast work; sustained impact was not tested.
- **Evidence:**
  - `Source: server/sockets.js forwards player:submit and redemption:report payloads directly to room methods.`
  - `Source: server/sockets.js forwards sync:report; server/room.js recordSync broadcasts player summaries.`
  - `Source review found no explicit rate-limit, throttle, or quota control in server/sockets.js or server/app.js.`
- **Recommendation:** Add per-socket and per-room event budgets, validate each payload against strict schemas and serialized-size limits, and add bounded local flood tests before exposing the service to untrusted clients.

### CORS-SOCKETIO-WEBSOCKET-ORIGIN — Socket.IO WebSocket accepts an untrusted Origin

- **Severity:** low
- **Status:** open — this assessment did not apply remediation
- **Category:** cross-origin access control
- **Description:** A WebSocket-only Socket.IO connection succeeded while sending Origin: https://evil.example. WebSocket handshakes are not governed by browser CORS headers, so an explicit Socket.IO origin allowRequest policy is needed if cross-origin connections should be blocked.
- **Evidence:**
  - `WebSocket connection succeeded with Origin: https://evil.example`
  - `No application event or room data was sent during this probe.`
- **Recommendation:** Configure Socket.IO allowRequest (or an equivalent edge policy) to allow only the exact application origins required, then verify both polling and WebSocket transports.

### HDR-CONTENT_SECURITY_POLICY-MISSING — Missing Content-Security-Policy (CSP)

- **Severity:** low
- **Status:** open — this assessment did not apply remediation
- **Category:** security headers
- **Description:** The response from https://amuseical.com/ did not include Content-Security-Policy (CSP). This is a defense-in-depth configuration gap, not proof of an exploitable vulnerability by itself.
- **Evidence:**
  - `GET / → 200`
  - `Content-Security-Policy (CSP): missing`
- **Recommendation:** Deploy a tested CSP appropriate for the external font and Socket.IO resources.

### HDR-REFERRER_POLICY-MISSING — Missing Referrer-Policy

- **Severity:** low
- **Status:** open — this assessment did not apply remediation
- **Category:** security headers
- **Description:** The response from https://amuseical.com/ did not include Referrer-Policy. This is a defense-in-depth configuration gap, not proof of an exploitable vulnerability by itself.
- **Evidence:**
  - `GET / → 200`
  - `Referrer-Policy: missing`
- **Recommendation:** Send a restrictive policy such as strict-origin-when-cross-origin.

### HDR-STRICT_TRANSPORT_SECURITY-MISSING — Missing Strict-Transport-Security (HSTS)

- **Severity:** low
- **Status:** open — this assessment did not apply remediation
- **Category:** security headers
- **Description:** The response from https://amuseical.com/ did not include Strict-Transport-Security (HSTS). This is a defense-in-depth configuration gap, not proof of an exploitable vulnerability by itself.
- **Evidence:**
  - `GET / → 200`
  - `Strict-Transport-Security (HSTS): missing`
- **Recommendation:** Enable HSTS after confirming every production subdomain is HTTPS-only.

### HDR-X_CONTENT_TYPE_OPTIONS-MISSING — Missing X-Content-Type-Options

- **Severity:** low
- **Status:** open — this assessment did not apply remediation
- **Category:** security headers
- **Description:** The response from https://amuseical.com/ did not include X-Content-Type-Options. This is a defense-in-depth configuration gap, not proof of an exploitable vulnerability by itself.
- **Evidence:**
  - `GET / → 200`
  - `X-Content-Type-Options: missing`
- **Recommendation:** Send X-Content-Type-Options: nosniff.

### HDR-X_FRAME_OPTIONS-MISSING — Missing Clickjacking protection (X-Frame-Options or frame-ancestors)

- **Severity:** low
- **Status:** open — this assessment did not apply remediation
- **Category:** security headers
- **Description:** The response from https://amuseical.com/ did not include Clickjacking protection (X-Frame-Options or frame-ancestors). This is a defense-in-depth configuration gap, not proof of an exploitable vulnerability by itself.
- **Evidence:**
  - `GET / → 200`
  - `Clickjacking protection (X-Frame-Options or frame-ancestors): missing`
- **Recommendation:** Send X-Frame-Options or a CSP frame-ancestors directive appropriate for the host/player pages.

### HDR-PERMISSIONS_POLICY-MISSING — Missing Permissions-Policy

- **Severity:** informational
- **Status:** open — this assessment did not apply remediation
- **Category:** security headers
- **Description:** The response from https://amuseical.com/ did not include Permissions-Policy. This is a defense-in-depth configuration gap, not proof of an exploitable vulnerability by itself.
- **Evidence:**
  - `GET / → 200`
  - `Permissions-Policy: missing`
- **Recommendation:** Restrict browser capabilities not needed by the application.

### HDR-PLATFORM-DISCLOSURE — Platform/framework response headers are exposed

- **Severity:** informational
- **Status:** open — this assessment did not apply remediation
- **Category:** information disclosure
- **Description:** The edge response identifies deployment or framework details. This is normally low risk but gives reconnaissance information to an attacker.
- **Evidence:**
  - `server: cloudflare`
  - `x-powered-by: Express`
  - `x-railway-edge: jfk1`
- **Recommendation:** Remove or minimize nonessential framework/platform headers at the edge where operationally safe.

## Check results

| ID | Status | Check | Evidence |
|---|---|---|---|
| SRC-UNSAFE-DOM-SINK | pass | Application source avoids direct HTML/code sinks | No matches in the checked browser application modules. |
| DEP-AUDIT | pass | Production dependency audit has no high/critical advisories | {"total":0,"high":0,"critical":0} |
| SRC-ROOM-CODE-ONLINE-ENUMERATION | warn | Room-code join attempts have server-side throttling | Source review: 4-character code over 24 symbols (331776 combinations); no explicit rate-limit or failed-attempt control found in server/sockets.js or server/app.js. |
| SRC-SOCKET-EVENT-RATE-LIMITS | warn | Socket.IO player events have explicit rate and schema limits | Source review found direct forwarding of submit/report payloads and sync-triggered roster broadcasts without an explicit rate-control layer. |
| BROWSER-PLAYER | pass | Player page renders its public join controls in a real browser | {"status":200,"controls":2} |
| BROWSER-HOST | pass | Host page renders its public create control in a real browser | {"status":200,"controls":1} |
| BROWSER-CONSOLE | pass | Public player/host page smoke flow has no browser errors | {"consoleErrors":0,"pageErrors":0} |
| TLS-CERT | pass | TLS certificate validates for the target hostname | {"authorized":true,"authorizationError":null,"protocol":"TLSv1.3","validTo":"Oct 18 14:38:34 2026 GMT"} |
| TLS-PROTOCOL | pass | Negotiated TLS protocol is TLS 1.2 or newer | Protocol: TLSv1.3 |
| HTTP-ROOT | pass | Public home page responds | 200 OK |
| HTTP-CONTENT-TYPE | pass | Home page declares an HTML content type | text/html; charset=UTF-8 |
| HTTP-HOST.HTML | pass | Host page responds | 200 body_bytes=3493; sha256_16=0b0a25bbc13f7790 |
| HTTP-HEALTHZ | pass | Health endpoint responds | 200 body_bytes=11; sha256_16=4062edaf750fb807 |
| HTTP-SOCKET.IO | pass | Socket.IO handshake responds | 200 body_bytes=118; sha256_16=8fe01461feb2e8c8 |
| HDR-STRICT_TRANSPORT_SECURITY | warn | Strict-Transport-Security (HSTS) | (missing) |
| HDR-CONTENT_SECURITY_POLICY | warn | Content-Security-Policy (CSP) | (missing) |
| HDR-X_CONTENT_TYPE_OPTIONS | warn | X-Content-Type-Options | (missing) |
| HDR-X_FRAME_OPTIONS | warn | Clickjacking protection (X-Frame-Options or frame-ancestors) | (missing) |
| HDR-REFERRER_POLICY | warn | Referrer-Policy | (missing) |
| HDR-PERMISSIONS_POLICY | warn | Permissions-Policy | (missing) |
| HDR-DISCLOSURE | warn | Response does not unnecessarily disclose platform details | server: cloudflare; x-powered-by: Express; x-railway-edge: jfk1 |
| TLS-HTTP-REDIRECT | pass | HTTP redirects to the canonical HTTPS origin | 301 Location: https://amuseical.com (path/query redacted) |
| CORS-UNTRUSTED-ORIGIN | pass | Untrusted origin is not granted permissive CORS access | Access-Control-Allow-Origin: (missing) |
| CORS-SOCKETIO-UNTRUSTED-ORIGIN | pass | Socket.IO handshake does not grant permissive access to an untrusted origin | Access-Control-Allow-Origin: (missing) |
| CORS-SOCKETIO-WEBSOCKET-ORIGIN | warn | Socket.IO WebSocket rejects an untrusted Origin | Connected with Origin: https://evil.example |
| HTTP-TRACE | pass | TRACE is not enabled as an HTTP echo | 405 body_bytes=155; sha256_16=c230ff18e2faaf6a |
| EXPOSURE-ENV | pass | Sensitive path is not publicly exposed: /.env | 404 body_bytes=143; sha256_16=88ceef28b7079ede |
| EXPOSURE-GIT_CONFIG | pass | Sensitive path is not publicly exposed: /.git/config | 404 body_bytes=150; sha256_16=b1183fead1817b3b |
| EXPOSURE-PACKAGE_JSON | pass | Sensitive path is not publicly exposed: /package.json | 404 body_bytes=151; sha256_16=ffc372a6ce855e15 |
| EXPOSURE-PACKAGE_LOCK_JSON | pass | Sensitive path is not publicly exposed: /package-lock.json | 404 body_bytes=156; sha256_16=27694ba8b9f154e8 |
| EXPOSURE-SERVER_INDEX_JS | pass | Sensitive path is not publicly exposed: /server/index.js | 404 body_bytes=154; sha256_16=937fad4fd4bf009b |
| EXPOSURE-SERVER_APP_JS | pass | Sensitive path is not publicly exposed: /server/app.js | 404 body_bytes=152; sha256_16=d770d5274a02330c |
| EXPOSURE-2E_2E_SERVER_APP_JS | pass | Sensitive path is not publicly exposed: /%2e%2e/server/app.js | 404 body_bytes=152; sha256_16=d770d5274a02330c |
| EXPOSURE-SHARED_2E_2E_SERVER_APP_JS | pass | Sensitive path is not publicly exposed: /shared/%2e%2e/server/app.js | 404 body_bytes=152; sha256_16=d770d5274a02330c |
| EXPOSURE-2E_2E_2E_2E_ETC_PASSWD | pass | Sensitive path is not publicly exposed: /%2e%2e/%2e%2e/etc/passwd | 404 body_bytes=149; sha256_16=142ac34354696ff9 |
| EXPOSURE-NPMRC | pass | Sensitive path is not publicly exposed: /.npmrc | 404 body_bytes=145; sha256_16=0068c55fb026184b |
| SOCKET-CREATE | pass | Create one temporary assessment room | Room created; identifier redacted. |
| SOCKET-CODE | pass | Room code uses the documented four-letter format | Four-letter format matched; identifier redacted. |
| SOCKET-HOST-KEY | pass | Host rejoin credential is present as a UUID-shaped value | UUID-shaped |
| SOCKET-JOIN | pass | Two test players can join the assessment room | {"one":{"ok":true,"error":false,"nameLength":16,"playerId":"[redacted]","snapshot":{"phase":"lobby","solo":false,"playerCount":1,"configKeys":["enabled","gameDuration","maxDelay","minDelay","roster"]}},"two":{"ok":true,"error":false,"nameLength":20,"playerId":"[redacted]","snapshot":{"phase":"lobby","solo":false,"playerCount":2,"configKeys":["enabled","gameDuration","maxDelay","minDelay","roster"]}}} |
| SOCKET-NAME-BOUND | pass | Player display names are bounded server-side | returned length=20 |
| SOCKET-PLAYER-RECONNECT-AUTH | fail | A different socket cannot rebind an existing player identity | Existing player identity accepted from a different socket; identifiers redacted. |
| SOCKET-HOST-REJOIN-AUTH | pass | Incorrect host rejoin credential is rejected | {"ok":false,"error":true} |
| SOCKET-HOST-ONLY | pass | Player sockets cannot invoke host-only actions | {"unauthorizedStart":true,"unauthorizedConfig":true,"phaseEvents":0,"configEvents":0} |

## Scope and limitations

- Tested the canonical HTTPS origin and a single short-lived assessment room created through the public application flow.
- HTTP checks were limited to safe GET/HEAD-like inspection, one TRACE capability check, CORS header inspection, encoded traversal probes, and a Socket.IO handshake.
- Host authorization checks used three test player sockets (including an identity-rebind probe) and an incorrect host credential; no existing user room, account, or stored data was accessed.
- No password guessing, token theft, exploit chaining, payload spraying, load generation, file upload, payment flow, or destructive state changes were attempted.
- The source-sink scan and authorization regression tests cover the checked-out repository; deployment-to-commit correlation was not independently verified.
- Dynamic browser XSS behavior and authenticated/role-based flows require a separate approved test plan with test accounts and explicit scope.
- Rate-limit, sustained event-flood, and denial-of-service resilience testing was not performed. Source review indicates follow-up testing is warranted for room-code enumeration and per-event quotas/schema limits.

## Assessment notes

- The TLS probe enforces a TLSv1.2 minimum; it verifies the negotiated protocol but does not independently test whether the endpoint accepts TLS 1.0 or 1.1.

## Methodology references

- [OWASP Web Security Testing Guide — HTTP security header misconfigurations (WSTG-CONF-14)](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/14-Test_Other_HTTP_Security_Header_Misconfigurations)
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [OWASP API Security Top 10 — API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption)
- [Socket.IO — Handling CORS](https://socket.io/docs/v4/handling-cors)

## Reproduction

```bash
npm ci
node scripts/security-assessment.mjs --target https://amuseical.com --report docs/security/assessment-latest.md --json docs/security/assessment-latest.json
```
