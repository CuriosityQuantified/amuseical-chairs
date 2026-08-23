# Security Penetration Test Report

**Generated:** 2026-08-23 05:10:01 UTC

# Executive Summary

# Executive Summary

A combined source-assisted assessment of the **Amuse-ical Chairs** application identified **two confirmed medium-severity vulnerabilities** affecting session control and competitive game integrity.

**Overall risk posture:** Moderate.

**Key findings**
- **Replayable reconnect secrets** allow repeated takeover of a live **host** or **player** role once a room-scoped reconnect secret has been copied.
- **Client-trusted metronome scoring** allows a normal participant to submit synthetically perfect timing data and win that round without playing.

**Business impact**
- The reconnect-secret issue can disrupt active sessions, displace legitimate participants, and allow unauthorized room control if a room-scoped secret is exposed through a shared device, debugging output, or another disclosure path.
- The scoring issue undermines trust in competitive outcomes and can materially alter leaderboards and session results.

**Positive observations**
- No exploitable **XSS**, **host-action authorization bypass**, **cross-origin Socket.IO CSRF**, **race-condition integrity bug**, or **known dependency CVE** was confirmed during this assessment.
- The application shows several defensive strengths, including server-side host-action checks, restrictive response headers, origin enforcement for browser Socket.IO handshakes, and text-safe rendering patterns in the reviewed social/game flows.

# Methodology

# Methodology

The assessment was performed as a **white-box review with live validation** against the provided running application and source repository, aligned to the **OWASP Web Security Testing Guide (WSTG)** and **PTES** principles.

**Scope**
- Live web application at `http://host.docker.internal:3123`
- Provided application source repository for the same service

**Approach**
- Built a source-aware architecture map of the Express and Socket.IO application, including routes, room lifecycle, trust boundaries, reconnect logic, and scoring paths.
- Performed baseline static triage with security-focused scanning, structural code mapping, secrets review, and dependency review.
- Mapped the live attack surface through bounded crawling and browser/socket workflow inspection.
- Validated priority categories including **authentication/session handling**, **action/object authorization**, **business logic and score integrity**, **cross-origin/CSRF behavior**, **text-driven XSS**, and **race-condition/TOCTOU** scenarios.
- Confirmed findings only when a live proof of concept demonstrated a real unauthorized consequence.

**Assessment constraints**
- Testing was bounded and non-destructive.
- No brute-force room-code guessing, load testing, or denial-of-service activity was performed.

# Technical Analysis

# Technical Analysis

**Confirmed findings**

1. **Replayable room reconnect tokens allow repeated host and player takeover** (**Medium**)
   - The application stores room-scoped reconnect secrets in browser storage and treats them as reusable bearer credentials for both host and player rejoin flows.
   - A copied `hostKey` or player reconnect token can be replayed from a fresh browser session to seize the live role, evict the legitimate participant, and then be replayed again because the secret is not rotated after successful takeover.
   - The validated impact is limited to scenarios where the attacker already possesses the room-scoped secret; however, once copied, the secret remains sufficient for repeated unauthorized control throughout the room lifetime.

2. **Client-trusted metronome submissions allow score forgery** (**Medium**)
   - The competitive **Metronome Blackout** round exposes all timing data needed to synthesize a perfect result and then scores a client-supplied `offsets` array directly.
   - A normal joined player can submit forged timing offsets immediately on round start and receive a perfect raw result plus the maximum normalized score without actually playing the game.
   - This materially impacts fairness and leaderboard integrity for hosted competitive sessions.

**Systemic themes**
- **Bearer-state trust in browser storage:** room-lifetime reconnect secrets are treated as durable authority rather than one-time or rotated recovery credentials.
- **Residual trust in client-supplied game metrics:** at least one enabled competitive game still relies on attacker-controlled submission data for final scoring.
- **Generally stronger server-side control boundaries elsewhere:** targeted validation did not reproduce bypasses in host-only action authorization, cross-origin browser handshake enforcement, text rendering, or the prioritized race-condition paths.

**Attack-chaining assessment**
- The confirmed issues were evaluated for higher-impact chaining.
- No additional end-to-end chain was validated beyond the reported consequences.
- The session-takeover issue requires prior acquisition of a reconnect secret, and no separate vulnerability in this assessment provided a practical path to obtain that secret.
- The score-forgery issue is impactful on competitive integrity but did not combine with the other validated results into a broader confidentiality or systemic privilege-escalation chain.

**Coverage highlights from non-reportable validation**
- Host-only Socket.IO actions remained enforced against unauthorized players.
- Browser-origin enforcement blocked untrusted cross-origin Socket.IO handshakes.
- Text-centric flows rendered attacker-controlled content as inert text rather than executable HTML/JavaScript.
- Targeted race-condition tests did not produce duplicate scoring, unauthorized advancement, or inconsistent state.

# Recommendations

# Recommendations

**Immediate**
1. Rotate **host** and **player reconnect secrets** after every successful rejoin, invalidate the prior secret immediately, and treat reconnect credentials as one-time or narrowly time-bounded recovery tokens.
2. Disable **Metronome Blackout** in hosted competitive sessions until scoring is derived from server-authoritative interaction data rather than a client-supplied summary payload.

**Short-term**
3. Review all competitive minigames for similar **client-trusted scoring** patterns and remove any affected games from competitive play until they are reworked to use server-verifiable metrics.
4. Add regression coverage that proves an old host/player reconnect secret fails after the first successful rejoin and that forged timing payloads cannot yield a competitive win.
5. Review how room-scoped secrets are stored and reused on shared devices, and minimize their lifetime and replay value wherever possible.

**Medium-term**
6. Centralize authority-sensitive session handling so reconnect, host control, and room recovery all follow the same rotation and invalidation rules.
7. Preserve the current safe text-rendering model for player-authored content, and require a focused XSS review before introducing any rich-text or HTML rendering features.
8. Re-run focused business-logic testing whenever new games, scoring logic, or room-recovery behavior are added.

**Retest and validation**
9. Re-test the host/player rejoin flow to confirm that a previously copied secret no longer works after a successful reconnect.
10. Re-test competitive scoring to confirm that forged metronome submissions and similar synthetic payloads are rejected or no longer influence scoring.

