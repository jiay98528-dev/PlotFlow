# Fablevia feedback service

This Node.js 22 service is the server-side boundary for public feedback. It listens only on
`127.0.0.1:18081`, sends plain-text email through deployment-owned SMTP credentials, and
returns a report ID. The desktop application reaches it through the existing
`www.leankom.com` TLS virtual host at the exact public path
`/api/fablevia-feedback/v1/reports`.

## HTTP contract

Nginx proxies the public path to `POST /v1/feedback`. The JSON body contains exactly:

```json
{
  "message": "What happened and how to reproduce it",
  "appVersion": "0.1.1",
  "releaseChannel": "Preview",
  "platform": "win32",
  "architecture": "x64",
  "locale": "en-US",
  "submittedAt": "2026-08-02T01:02:03.000Z",
  "requestId": "123e4567-e89b-42d3-a456-426614174000"
}
```

No other fields are accepted. The body is limited to 16 KiB and `message` to 8,000 Unicode
characters. The service never accepts story content, file paths, recent files, logs, contact
details or an installation identifier. A successful first delivery returns HTTP 202 with
`status: "accepted"`. The same `requestId` within 24 hours returns HTTP 200 with
`status: "duplicate"` and the original `reportId`.

Successful mappings are atomically persisted for 24 hours in systemd's state directory. The
state file contains only request ID, report ID and success time; it never contains feedback
text. Service logs contain only report ID, status, latency and curated error class names.

Nginx limits each IP to 2 requests per minute with burst 4. The service independently limits
the entire process to 100 new submissions per hour; duplicates are checked before consuming
that budget.

## Build and test

```powershell
pnpm.cmd --dir packages/feedback-service test
pnpm.cmd --dir packages/feedback-service build
```

SMTP credentials exist only in `/etc/fablevia-feedback/service.env`, owned by root with mode
`0600`. The desktop package does not contain Nodemailer, SMTP settings or this environment
file. `deploy/fablevia-feedback.service` runs under the non-root `fablevia-feedback` account
with a constrained systemd sandbox.

## Atomic deployment and smoke checks

Stage each build in a new `/opt/fablevia-feedback/releases/<version>` directory. Never modify
an active version in place. After installing the unit and root-owned environment file, activate
the staged directory with:

```sh
sudo sh /opt/fablevia-feedback/releases/<version>/deploy/activate-release.sh <version>
```

The script replaces `/opt/fablevia-feedback/current` atomically, restarts the service, checks
the loopback health endpoint, and immediately restores the previous symlink if health fails.

Before changing the existing Nginx server block, copy its configuration to a timestamped
root-only backup. Add `deploy/nginx-location.conf` without changing HAProxy, Xray or VPN ports,
then run `nginx -t` before reload. Release smoke checks are, in order:

1. `curl --fail http://127.0.0.1:18081/healthz`.
2. A schema-valid POST to `https://www.leankom.com/api/fablevia-feedback/v1/reports`.
3. Enough disposable request IDs to confirm the public endpoint returns HTTP 429 at the
   configured per-IP limit.
4. One explicitly approved real report and confirmation that its mail reached the fixed inbox.

Do not log request bodies during these checks. A production deployment and real-email smoke
require server access and SMTP authorization; repository tests intentionally do not simulate
that authority.
