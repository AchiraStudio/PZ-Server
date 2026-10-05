#!/usr/bin/env bash

set -e
: "${BUILD:=stable}"
: "${DISABLE_CACHE:=true}"

mountpoint /cache &> /dev/null || DISABLE_CACHE="true"

if [ "$BUILD" == "42.19" ]; then
    BRANCHE="42.19"
elif [ "$BUILD" == "stable" ] || [ "$BUILD" == "42" ]; then
    BRANCHE="public"
elif [ "$BUILD" == "unstable" ]; then
    BRANCHE="unstable"
elif [ "$BUILD" == "41" ]; then
    BRANCHE="legacy41"
else
    echo "BUILD ${BUILD} not supported"
    exit 1
fi

echo "=========================================================="
echo " Project Zomboid Dedicated Server [${BUILD}]"
echo " Fast Boot Mode: Validation Disabled"
echo "=========================================================="

if [ -f "/app/start-server.sh" ]; then
    echo "[Server Launcher] Server binaries found in /app. Skipping steamcmd validation."
else
    echo "[Server Launcher] Downloading server BUILD ${BUILD} (without validate)..."
    steamcmd.sh +force_install_dir /app +login anonymous +app_update 380870 -beta "${BRANCHE}" +quit
fi

configure_server.sh "$BUILD"
