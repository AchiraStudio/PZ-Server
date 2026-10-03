#!/usr/bin/env bash
set -e

ACTION=$1
APP_VERSION=$2

function backup_steamcmd() {
    echo "Caching steamcmd files..."
    mkdir -p /cache/steamcmd
    cp -r -u /opt/steamcmd/* /cache/steamcmd/ 2>/dev/null || true
}

function restore_steamcmd() {
    if [ -d "/cache/steamcmd" ] && [ "$(ls -A /cache/steamcmd)" ]; then
        echo "Restoring steamcmd cache..."
        cp -r -u /cache/steamcmd/* /opt/steamcmd/ 2>/dev/null || true
    fi
}

function backup_app() {
    local version=${1:-"stable"}
    echo "Caching PZ server app (${version})..."
    mkdir -p "/cache/app/${version}"
    cp -r -u /app/* "/cache/app/${version}/" 2>/dev/null || true
}

function restore_app() {
    local version=${1:-"stable"}
    if [ -d "/cache/app/${version}" ] && [ "$(ls -A /cache/app/${version})" ]; then
        echo "Restoring PZ server app cache (${version})..."
        cp -r -u "/cache/app/${version}/"* /app/ 2>/dev/null || true
    fi
}

case "$ACTION" in
    backup_steamcmd)
        backup_steamcmd
        ;;
    restore_steamcmd)
        restore_steamcmd
        ;;
    backup_app)
        backup_app "$APP_VERSION"
        ;;
    restore_app)
        restore_app "$APP_VERSION"
        ;;
    *)
        echo "Usage: cache.sh {backup_steamcmd|restore_steamcmd|backup_app <ver>|restore_app <ver>}"
        exit 1
        ;;
esac
