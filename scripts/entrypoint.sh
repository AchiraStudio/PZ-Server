#!/usr/bin/env bash
set -e

: "${PUID:=1000}"
: "${PGID:=1000}"

# Adjust user and group IDs dynamically
if [ "$(id -g pzserver)" != "${PGID}" ]; then
    groupmod -o -g "${PGID}" pzserver
fi

if [ "$(id -u pzserver)" != "${PUID}" ]; then
    usermod -o -u "${PUID}" pzserver
fi

# Ensure critical directories exist
mkdir -p /data /cache /app /home/pzserver /opt/steamcmd
chown -R pzserver:pzserver /app /data /home/pzserver /opt/steamcmd /cache /webui

# If custom command passed, execute it
if [ "$#" -gt 0 ] && [ "$1" != "supervise" ]; then
    exec gosu pzserver "$@"
fi

# Default: Start Web UI & Process Supervisor as pzserver user
echo "=========================================================="
echo "  Starting Project Zomboid Server & Web UI Supervisor     "
echo "  Web UI Port: ${WEBUI_PORT:-5011}                        "
echo "  Server Name: ${SERVER_NAME:-server}                     "
echo "  Server Build: ${BUILD:-stable}                          "
echo "=========================================================="

cd /webui
exec gosu pzserver node server.js
