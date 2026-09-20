#!/usr/bin/env bash
# Refresh MEUT source backup for Travis. Run after every code change.
set -euo pipefail
ROOT="/workspace/harvestcems"
STAMP="$(date +%Y%m%d)"
OUT="/workspace/MEUT-source-backup-${STAMP}.tar.gz"
LATEST="/workspace/MEUT-source-backup-latest.tar.gz"

cat > /workspace/MEUT-BACKUP-README.txt << README
MEUT source backup — $(date -Iseconds)

Contents: harvestcems/modern (Next.js app)
Excluded: node_modules, .next, .env secrets, .creator-password.local

Restore: extract → cd modern → npm ci → set env → npx prisma db push → npm run build
Live URL: https://meut-web-production.up.railway.app
README

tar -czf "$OUT" \
  --exclude='modern/node_modules' \
  --exclude='modern/.next' \
  --exclude='modern/.git' \
  --exclude='modern/.creator-password.local' \
  --exclude='**/.env' \
  --exclude='**/.env.*' \
  -C /workspace MEUT-BACKUP-README.txt \
  -C "$ROOT" modern

cp -f "$OUT" "$LATEST"
ls -lh "$OUT" "$LATEST"
echo "BACKUP_PATH=$OUT"
echo "LATEST_PATH=$LATEST"
