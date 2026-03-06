

## Fix: Nginx 500 persists after deploy — bind mount inode issue

### Root Cause

The Nginx container mounts `./frontend` as a bind volume. When `update.sh` runs:

```bash
rm -rf "$DEPLOY_DIR/frontend"    # deletes directory (and its inode)
cp -r "$REPO_ROOT/dist" "$DEPLOY_DIR/frontend"  # creates NEW directory with NEW inode
```

Docker bind mounts track the **original inode**. After `rm -rf` + `cp -r`, the container still points to the old (deleted) directory. `docker compose up -d` shows Nginx as "Running" (not restarted), so it never re-binds.

### Fix

Two changes in `deploy/update.sh`:

1. **Replace `rm -rf` + `cp -r` with `rsync`** to update files in-place (preserving the directory inode), OR use `rm contents + cp contents` pattern.
2. **Force restart Nginx** after copying to guarantee the bind mount is refreshed.

```bash
# Replace frontend files (preserve directory for bind mount)
rm -rf "$DEPLOY_DIR/frontend/"*
cp -r "$REPO_ROOT/dist/"* "$DEPLOY_DIR/frontend/"

# ... after docker compose up -d:
docker compose restart nginx
```

This approach:
- Creates `frontend/` if it doesn't exist (first deploy)
- Preserves the directory inode if it does exist (updates)
- Force-restarts Nginx to guarantee it picks up changes regardless

### Single file change
**`deploy/update.sh`** — Fix the frontend copy logic and add explicit Nginx restart.

