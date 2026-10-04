#!/usr/bin/env bash
set -e

: "${BUILD:=stable}"
: "${DISABLE_CACHE:=false}"

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
    echo "BUILD ${BUILD} not recognized, falling back to public"
    BRANCHE="public"
fi

echo "=========================================================="
echo " Downloading Project Zomboid Dedicated Server [${BUILD}]... "
echo " Steam Branch: ${BRANCHE}                                  "
echo "=========================================================="

if [[ "$DISABLE_CACHE" =~ ^(0|false|False|n|N)$ ]]; then
    cache.sh restore_steamcmd || true
    cache.sh restore_app "$BUILD" || true
fi

BETA_ARG=""
if [ -n "$BRANCHE" ] && [ "$BRANCHE" != "public" ]; then
    BETA_ARG="-beta ${BRANCHE}"
fi

steamcmd.sh +force_install_dir /app +login anonymous +app_info_print 380870 +app_update 380870 ${BETA_ARG} validate +quit

if [[ "$DISABLE_CACHE" =~ ^(0|false|False|n|N)$ ]]; then
    cache.sh backup_steamcmd || true
    cache.sh backup_app "$BUILD" || true
fi

configure_server.sh "$BUILD"
