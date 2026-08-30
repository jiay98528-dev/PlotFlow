#!/bin/sh
set -eu

BASE=/opt/fablevia-feedback
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
VERSION_NAME=${1:?usage: activate-release.sh VERSION_DIRECTORY_NAME}
TARGET="$RELEASES/$VERSION_NAME"

case "$VERSION_NAME" in
  ''|*[!0-9A-Za-z._-]*)
    echo "invalid version directory name" >&2
    exit 2
    ;;
esac

if [ ! -d "$TARGET" ] || [ ! -f "$TARGET/dist/index.js" ]; then
  echo "staged release is incomplete: $TARGET" >&2
  exit 2
fi

PREVIOUS=''
if [ -L "$CURRENT" ]; then
  PREVIOUS=$(readlink -f "$CURRENT")
fi

NEXT_LINK="$BASE/.current-next-$$"
ln -s "$TARGET" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT"

if systemctl restart fablevia-feedback.service; then
  ATTEMPT=0
  while [ "$ATTEMPT" -lt 10 ]; do
    if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:18081/healthz >/dev/null; then
      exit 0
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
  done
fi

echo "health check failed; rolling back" >&2
if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
  ROLLBACK_LINK="$BASE/.current-rollback-$$"
  ln -s "$PREVIOUS" "$ROLLBACK_LINK"
  mv -Tf "$ROLLBACK_LINK" "$CURRENT"
  systemctl restart fablevia-feedback.service
else
  rm -f "$CURRENT"
  systemctl stop fablevia-feedback.service || true
fi
exit 1
