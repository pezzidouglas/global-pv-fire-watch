# Security policy

## Supported version

The current production version is supported. Older snapshots are retained for provenance but do not receive fixes.

## Reporting a vulnerability

Use the public contact form at <https://www.greenwatts.solar/> and begin the message with `PV Fire Watch security report`. Do not include secrets or exploit other users' data. Provide the affected URL, impact, reproduction steps and a safe proof of concept.

Please allow a reasonable private remediation period before public disclosure. Data corrections and source disputes should use the process at `/corrections` instead.

## Current dependency note

The 2026-07-12 production audit reports no high or critical runtime findings. It reports two moderate instances of the PostCSS stringification advisory through Next.js's bundled dependency, with no upstream fix currently available. The app does not accept user-supplied CSS, applies a restrictive content security policy, and tracks upstream releases through Dependabot. This exception should be reviewed when Next.js publishes an updated dependency.
