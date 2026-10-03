FROM debian:12-slim

ENV DEBIAN_FRONTEND="noninteractive"
ENV LANG="en_US.UTF-8"
ENV LC_ALL="en_US.UTF-8"
ENV WEBUI_PORT="5011"

WORKDIR /app

# Install base dependencies & SteamCMD 32-bit runtime libs
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y --no-install-recommends install \
        ca-certificates \
        gosu \
        wget \
        curl \
        jq \
        locales \
        procps \
        lib32gcc-s1 \
        sqlite3 \
        tar \
        gzip && \
    # Install Node.js 22 LTS
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get -y autoremove && \
    apt-get -y clean && \
    rm -rf /var/lib/apt/lists/*

# Install SteamCMD
RUN wget -q "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" && \
    mkdir -p /opt/steamcmd && \
    tar zxvf steamcmd_linux.tar.gz -C /opt/steamcmd/ && \
    rm -f steamcmd_linux.tar.gz

# Configure locales and create pzserver user
RUN sed -i 's/^# *\(en_US.UTF-8\)/\1/' /etc/locale.gen && \
    locale-gen && \
    groupadd -g 1000 pzserver && \
    useradd -m -u 1000 -g 1000 -s /bin/bash pzserver && \
    mkdir -p /home/pzserver /data /cache /app /webui

# Copy operational scripts
COPY scripts/* /usr/local/bin/
RUN chmod +x /usr/local/bin/*

# Copy Web UI application & install dependencies
COPY webui/ /webui/
WORKDIR /webui
RUN npm install --omit=dev && \
    chown -R pzserver:pzserver /webui /data /cache /app /home/pzserver /opt/steamcmd

# Game Ports
EXPOSE 16261/udp
EXPOSE 16262/udp
EXPOSE 27015

# Web UI Port
EXPOSE 5011

VOLUME [ "/data", "/cache" ]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["supervise"]
