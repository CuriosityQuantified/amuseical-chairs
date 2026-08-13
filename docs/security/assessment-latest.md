# Amuse-ical Chairs penetration-test assessment

- **Target:** https://amuseical.com
- **Assessment time (UTC):** 2026-08-13T19:14:35.718Z
- **Method:** Authorized, low-impact external web assessment plus source-backed authorization checks
- **Status:** No critical, high, or medium findings were observed by this limited assessment; this is not a claim that the site has no vulnerabilities.

> This is an assessment of the reachable surface at a point in time, not a guarantee that the site has no vulnerabilities. It does not include credentialed testing, source-code exploitation, load testing, brute force, social engineering, or destructive actions.

## Executive summary

Observed findings: **1** — Critical: **0**, High: **0**, Medium: **0**, Low: **0**, Informational: **1**.

Checks run:

| Status | Count |
|---|---:|
| Pass | 43 |
| Warnings | 1 |
| Failures | 0 |
| Errors / not run | 0 |

## Findings

### HDR-PLATFORM-DISCLOSURE — Platform/framework response headers are exposed

- **Severity:** informational
- **Status:** partially mitigated; edge-managed headers require hosting-provider configuration — this assessment did not apply remediation
- **Category:** information disclosure
- **Description:** Edge-managed platform headers remain observable. The application layer no longer discloses Express; any remaining platform headers are set by the hosting edge and can only be removed there. This is normally low risk but gives reconnaissance information to an attacker.
- **Evidence:**
  - `server: edge-managed`
  - `x-railway-edge: edge-managed`
- **Recommendation:** Keep x-powered-by removed in the application; configure Cloudflare/Railway to strip or minimize edge-managed headers (server, x-railway-edge) where operationally safe, and re-run this assessment after any edge change.

## Check results

| ID | Status | Check | Evidence |
|---|---|---|---|
| SRC-UNSAFE-DOM-SINK | pass | Application source avoids direct HTML/code sinks | No matches in the checked browser application modules. |
| DEP-AUDIT | pass | Production dependency audit has no high/critical advisories | {"total":0,"high":0,"critical":0} |
| SRC-ROOM-CODE-ONLINE-ENUMERATION | pass | Room-code join attempts have server-side throttling or a larger code space | Source-confirmed failed-join throttle is present. |
| SRC-SOCKET-EVENT-RATE-LIMITS | pass | Socket.IO player events have explicit rate and payload-size limits | Source-confirmed per-event quotas and transport/application payload limits are present. |
| BROWSER-PLAYER | pass | Player page renders its public join controls in a real browser | {"status":200,"controls":2} |
| BROWSER-HOST | pass | Host page renders its public create control in a real browser | {"status":200,"controls":1} |
| BROWSER-CONSOLE | pass | Public player/host page smoke flow has no browser errors | {"consoleErrors":0,"pageErrors":0} |
| TLS-CERT | pass | TLS certificate validates for the target hostname | {"authorized":true,"authorizationError":null,"protocol":"TLSv1.3","validTo":"Oct 18 14:38:34 2026 GMT"} |
| TLS-PROTOCOL | pass | Negotiated TLS protocol is TLS 1.2 or newer | Protocol: TLSv1.3 |
| HTTP-ROOT | pass | Public home page responds | HTTP 200 |
| HTTP-CONTENT-TYPE | pass | Home page declares an HTML content type | HTML content type present |
| HTTP-HOST.HTML | pass | Host page responds | 200 body_bytes=3493; sha256_16=0b0a25bbc13f7790 |
| HTTP-HEALTHZ | pass | Health endpoint responds | 200 body_bytes=11; sha256_16=4062edaf750fb807 |
| HTTP-SOCKET.IO | pass | Socket.IO handshake responds | 200 body_bytes=116; sha256_16=394162a157d2435f |
| HDR-STRICT_TRANSPORT_SECURITY | pass | Strict-Transport-Security (HSTS) | present and effective for the checked policy |
| HDR-CONTENT_SECURITY_POLICY | pass | Content-Security-Policy (CSP) | present and effective for the checked policy |
| HDR-X_CONTENT_TYPE_OPTIONS | pass | X-Content-Type-Options | present and effective for the checked policy |
| HDR-X_FRAME_OPTIONS | pass | Clickjacking protection (X-Frame-Options or frame-ancestors) | present and effective for the checked policy |
| HDR-REFERRER_POLICY | pass | Referrer-Policy | present and effective for the checked policy |
| HDR-PERMISSIONS_POLICY | pass | Permissions-Policy | present and effective for the checked policy |
| HDR-DISCLOSURE | warn | Response does not unnecessarily disclose platform details | server: edge-managed; x-railway-edge: edge-managed |
| TLS-HTTP-REDIRECT | pass | HTTP redirects to the canonical HTTPS origin | 301 Location: https://amuseical.com (path/query redacted) |
| CORS-UNTRUSTED-ORIGIN | pass | Untrusted origin is not granted permissive CORS access | (missing) |
| CORS-SOCKETIO-UNTRUSTED-ORIGIN | pass | Socket.IO handshake does not grant permissive access to an untrusted origin | (missing) |
| CORS-SOCKETIO-WEBSOCKET-ORIGIN | pass | Socket.IO WebSocket rejects an untrusted Origin | WebSocket origin rejected |
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
| SOCKET-JOIN | pass | Two test players can join the assessment room | {"one":{"ok":true,"error":false,"nameLength":16,"playerId":"[redacted]","reconnectToken":"[redacted]","snapshot":{"phasePresent":true,"solo":false,"playerCount":1,"configKeyCount":5}},"two":{"ok":true,"error":false,"nameLength":20,"playerId":"[redacted]","reconnectToken":"[redacted]","snapshot":{"phasePresent":true,"solo":false,"playerCount":2,"configKeyCount":5}}} |
| SOCKET-NAME-BOUND | pass | Player display names are bounded server-side | returned length=20 |
| SOCKET-PLAYER-RECONNECT-AUTH | pass | A different socket cannot rebind an existing player identity | {"error":true} |
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
