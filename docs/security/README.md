# Security assessment harness

This repository contains a repeatable, deliberately low-impact assessment for the deployed Amuse-ical Chairs web app.

## Run locally

```bash
npm ci
npm test
node scripts/security-assessment.mjs \
  --target https://amuseical.com \
  --report docs/security/assessment-latest.md \
  --json docs/security/assessment-latest.json
```

The live assessment performs safe HTTP/TLS checks, a headless player/host browser smoke check, static client-sink checks, a production dependency audit, sensitive-path/traversal probes, CORS and TRACE inspection, and one short-lived Socket.IO room to verify host-only authorization. It does **not** brute-force, load-test, access accounts, upload files, or perform destructive actions.

Use `--no-socket` when only the public HTTP surface should be assessed. Set `SECURITY_TARGET` instead of `--target` for CI or another approved deployment. CI should set `SECURITY_ALLOWED_HOSTS`, `SECURITY_ALLOWED_ORIGINS`, and `SECURITY_REQUIRE_HTTPS=true`; the checked-in workflow allows only the exact origin `https://amuseical.com`.

## Interpretation

A penetration test is time- and scope-limited. A clean run means that this harness did not observe the checked conditions at that time; it does not prove that the site has no vulnerabilities. Credentialed testing, authenticated role separation, browser clickjacking/XSS verification, deep dependency-supply-chain review beyond `npm audit`, cloud configuration, business-logic abuse, room-code enumeration resistance, and sustained event-rate/DoS resilience require separate approved scope. The source sink scan is heuristic, and legacy TLS acceptance is not independently tested because the TLS probe enforces TLS 1.2. Medium-or-higher findings cause the assessment command to exit non-zero so a whitelist workflow fails closed.

Generated reports belong under `docs/security/` and must identify the target, UTC timestamp, exact scope, observed evidence, limitations, and remediation status. Do not commit credentials, host keys, player IDs, or unredacted personal data.

Methodology references: [OWASP WSTG-CONF-14](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/14-Test_Other_HTTP_Security_Header_Misconfigurations), [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption), and [Socket.IO CORS documentation](https://socket.io/docs/v4/handling-cors).
