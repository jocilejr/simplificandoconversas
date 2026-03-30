

# Fix: Duplicate `reference_id` in external-webhook.ts

## Problem
Line 51 and 52 both declare `reference_id` in the destructuring assignment, causing a TypeScript compilation error.

## Fix
**File**: `deploy/backend/src/routes/external-webhook.ts`, line 52

Remove the duplicate `reference_id,` line (line 52). Keep only one instance on line 51.

## Scope
- 1 file, 1 line removed

