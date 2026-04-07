

# Fix: `boleto_recovery_templates` losing RLS policies on every `update.sh` run

## Root Cause

The `migrate-workspace.sql` script has two key sections:
1. **Drop all non-workspace RLS policies** on every public table (except `workspaces`, `workspace_members`, `user_roles`, `profiles`)
2. **Re-create `ws_*` policies** only for tables listed in the `_tables` array

`boleto_recovery_templates` is affected by step 1 (its policies get dropped) but is NOT in the `_tables` array in step 2, so it ends up with **zero RLS policies** after every update. This blocks all authenticated operations (insert, update, select, delete).

## Solution

Two changes needed:

### 1. Add `boleto_recovery_templates` to `migrate-workspace.sql`

Add `'boleto_recovery_templates'` to all three `_tables` arrays in the migration script (the column addition array, the backfill array, and the RLS policy creation array). This ensures:
- `workspace_id` column exists
- Existing data gets backfilled
- `ws_select`, `ws_insert`, `ws_update`, `ws_delete` policies are re-created

### 2. Add `boleto_recovery_templates` creation to `update.sh`

Add a `CREATE TABLE IF NOT EXISTS` block for `boleto_recovery_templates` in the base schema section of `update.sh` (before the workspace migration runs), similar to how `transactions`, `email_templates`, etc. are defined. This ensures the table exists on fresh installs.

## Files Modified

| File | Change |
|------|--------|
| `deploy/migrate-workspace.sql` | Add `'boleto_recovery_templates'` to all 3 `_tables` arrays |
| `deploy/update.sh` | Add `CREATE TABLE IF NOT EXISTS public.boleto_recovery_templates` block before workspace migration |

