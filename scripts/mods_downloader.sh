#!/usr/bin/env bash
set -euo pipefail

SERVER_NAME="${SERVER_NAME:-server}"
mods_dir="/data/Zomboid/mods"
server_ini_file="/data/Zomboid/Server/${SERVER_NAME}.ini"

if [ ! -f "$server_ini_file" ]; then
    echo "Server configuration file ${server_ini_file} does not exist yet."
    exit 0
fi

mkdir -p "${mods_dir}"

function ini_get() {
    local file="$1"
    local key="$2"
    grep -E "^\s*${key}\s*=" "$file" | sed -E "s/^\s*${key}\s*=\s*//" || true
}

workshop_ids=$(ini_get "$server_ini_file" "WorkshopItems")

if [ -z "$workshop_ids" ]; then
    echo "No WorkshopItems specified in ${server_ini_file}"
    exit 0
fi

IFS=";" read -ra ids <<< "$workshop_ids"

mkdir -p /home/pzserver/Steam/steamapps/workshop/content/108600/

for item in "${ids[@]}"; do
    item_clean=$(echo "$item" | xargs)
    if [ -n "$item_clean" ]; then
        echo "Downloading workshop mod: \"${item_clean}\"..."
        steamcmd.sh +login anonymous +workshop_download_item 108600 "${item_clean}" +quit || true
    fi
done

echo "Copying downloaded mods to ${mods_dir}..."
find /home/pzserver/Steam/steamapps/workshop/content/108600/ -maxdepth 3 -type d -path "*/mods/*" -exec cp -r -u {} "$mods_dir" \; 2>/dev/null || true
echo "Workshop mods synchronized successfully."
