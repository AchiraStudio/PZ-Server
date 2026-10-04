#!/usr/bin/env bash
set -e

: "${UPDATE_JRE:=false}"
: "${STEAM:=true}"
: "${DISABLE_MOD_DOWNLOADER:=false}"

BUILD="${1:-stable}"

if [ -f /app/ProjectZomboid64.json ]; then
    # Set MAX_RAM
    sed -i "s/Xmx[0-9]*[a-zA-Z]*/Xmx${MAX_RAM:-8g}/g" /app/ProjectZomboid64.json

    # Set STEAM mode (1 for Steam, 0 for Non-Steam)
    if [[ "$STEAM" =~ ^(0|false|False|n|N)$ ]]; then
        sed -i "s/-Dzomboid.steam=1/-Dzomboid.steam=0/" /app/ProjectZomboid64.json
    else
        sed -i "s/-Dzomboid.steam=0/-Dzomboid.steam=1/" /app/ProjectZomboid64.json
    fi
fi

# Ensure all scripts and binaries in /app are executable
chmod +x /app/*.sh /app/ProjectZomboid* 2>/dev/null || true

# Update JRE if requested
if [[ "$UPDATE_JRE" =~ ^(1|true|True|y|Y)$ ]]; then
    if [ "$BUILD" == "41" ]; then
        JRE_MAJOR_VERSION="17"
    else
        JRE_MAJOR_VERSION="25"
    fi

    echo "Updating Java Runtime Environment (Azul Zulu ${JRE_MAJOR_VERSION})..."
    JRE_URL=$(curl -s "https://api.azul.com/metadata/v1/zulu/packages/?java_version=${JRE_MAJOR_VERSION}&os=linux&arch=x64&archive_type=tar.gz&java_package_type=jre&availability_types=ca&crac_supported=false&javafx_bundled=false&latest=true" | jq -r '.[0].download_url')
    
    if [ -n "$JRE_URL" ] && [ "$JRE_URL" != "null" ]; then
        JRE_VERSION=$(echo "$JRE_URL" | sed -n 's/.*zulu\([0-9.]*-ca-jre[0-9.]*\).*/\1/p')
        echo "Installing Azul Zulu JRE version ${JRE_VERSION}..."
        rm -Rf /app/jre64
        wget -q "${JRE_URL}" -O zulu-jre.tar.gz
        tar -xf zulu-jre.tar.gz
        rm -f zulu-jre.tar.gz
        mv "zulu${JRE_VERSION}-linux_x64" /app/jre64
    fi
fi

# Auto-download workshop mods for non-steam server
if [[ "$STEAM" =~ ^(0|false|False|n|N)$ ]] && [[ "$DISABLE_MOD_DOWNLOADER" =~ ^(0|false|False|n|N)$ ]]; then
    echo "Checking mods for non-steam server..."
    mods_downloader.sh || true
fi
