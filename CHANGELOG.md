Changelog
=========

All notable changes to this project will be documented in this file.

0.3.0 - 2025-09-19
-------------------

- Added support for Taproot Assets:
  - New payment kind `taprootasset` (receive and send).
  - Expanded `Currency` to accept asset strings in the form `asset:<66-hex>`.
  - Receive requests can use `amount` with `unit: 'base units'` for assets.
  - Responses include taproot asset data with `amount`, `asset` group key, and optional `quote`.
- Added new transient status `approved`:
  - Included in `SendStatus` and handled in polling (treated as loading).
  - Included in `ReceiveStatus` to handle pre-generation transitions.
- TDD coverage:
  - Tests for taproot asset receive and send flows.
  - Tests for polling through `approved` state.
- Documentation & examples:
  - README now includes generic Taproot Asset receive/send examples.
  - `examples/payment-requests.ts` includes a taproot asset receive example.

Notes:
- This is a backward‑compatible feature release, but it broadens the public type surface. Projects that exhaustively check payment kinds or statuses may need to update their TypeScript unions.

