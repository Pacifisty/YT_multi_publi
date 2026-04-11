# YT Multi Publi - Release 2026-04-11.1

Data: 2026-04-11

## Highlights

- Persisted campaign audit events in Prisma with migration support.
- Added a unified campaign-detail activity timeline combining job and audit events.
- Added activity filters in campaign detail (`all`, `jobs`, `audit`, `targetId`) with filtered summary and timeline.

## Technical Changes

- API and persistence:
  - Added Prisma-backed audit event repository wiring.
  - Added `AuditEvent` model and migration.
- Web route/view:
  - Added `activitySummary` and `activityTimeline` on campaign detail route.
  - Added `activityFilters` contract with selected option, options list, filtered summary, and filtered timeline.
- Tests:
  - Expanded integration coverage for campaign detail timeline/filter behavior.
  - Added/updated persistence and migration wiring tests.

## Validation

- Focused test suites passed for campaign detail and client integration.
- Full test suite passed:
  - `1808` passed
  - `5` skipped

## Commits Included

- `2f91325` feat: persist campaign audit events via prisma
- `a553449` feat: add unified activity timeline to campaign detail
- `e314e27` feat: add activity filters for campaign detail timeline

