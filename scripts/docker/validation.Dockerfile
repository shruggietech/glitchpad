FROM mcr.microsoft.com/powershell:7.5-debian-12 AS powershell

FROM ubuntu:22.04 AS linux-package

ARG NODE_VERSION=24.11.0
ARG RUST_VERSION=1.96.0

ENV COREPACK_HOME=/opt/corepack
ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/usr/local/cargo/bin:${PATH}"
ENV GLITCHPAD_LINUX_PACKAGE_CONTAINER=true
ENV GLITCHPAD_VALIDATION_TARGET=linux-package

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        dbus-x11 \
        desktop-file-utils \
        file \
        git \
        jq \
        libayatana-appindicator3-dev \
        libfuse2 \
        librsvg2-dev \
        libssl-dev \
        libwebkit2gtk-4.1-dev \
        patchelf \
        pkg-config \
        shared-mime-info \
        squashfs-tools \
        xdg-utils \
        xvfb \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup

RUN set -eux; \
    rustup_url="https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init"; \
    curl -fsSLo /tmp/rustup-init "${rustup_url}"; \
    curl -fsSLo /tmp/rustup-init.sha256 "${rustup_url}.sha256"; \
    expected="$(cut -d ' ' -f 1 /tmp/rustup-init.sha256)"; \
    echo "${expected}  /tmp/rustup-init" | sha256sum -c -; \
    chmod +x /tmp/rustup-init; \
    /tmp/rustup-init -y --profile minimal --default-toolchain "${RUST_VERSION}" --component clippy,rustfmt; \
    rm /tmp/rustup-init /tmp/rustup-init.sha256

RUN set -eux; \
    archive="node-v${NODE_VERSION}-linux-x64.tar.xz"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${archive}"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
    grep " ${archive}$" SHASUMS256.txt | sha256sum -c -; \
    tar -xJf "${archive}" -C /usr/local --strip-components=1; \
    rm "${archive}" SHASUMS256.txt; \
    mkdir -p "${COREPACK_HOME}"; \
    corepack enable; \
    corepack prepare pnpm@10.28.2 --activate; \
    chmod -R a+rX "${COREPACK_HOME}"

RUN useradd --create-home --uid 1000 validator

WORKDIR /workspace

FROM ubuntu:24.04 AS linux-lifecycle-24

ENV DEBIAN_FRONTEND=noninteractive
ENV CARGO_HOME=/usr/local/cargo
ENV PATH="/usr/local/cargo/bin:${PATH}"
ENV RUSTUP_HOME=/usr/local/rustup

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        dbus-x11 \
        desktop-file-utils \
        libfuse2t64 \
        libgtk-3-0t64 \
        libwebkit2gtk-4.1-0 \
        pkg-config \
        shared-mime-info \
        xdg-utils \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

COPY --from=linux-package /usr/local /usr/local
COPY --from=linux-package /opt/corepack /opt/corepack

WORKDIR /workspace

FROM ubuntu:22.04 AS android-package

ARG ANDROID_COMMAND_LINE_TOOLS_VERSION=15859902
ARG ANDROID_COMMAND_LINE_TOOLS_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583
ARG ANDROID_PLATFORM=36
ARG ANDROID_BUILD_TOOLS=36.0.0
ARG ANDROID_NDK=28.2.13676358
ARG BUNDLETOOL_VERSION=1.18.3
ARG BUNDLETOOL_SHA256=a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV BUNDLETOOL_JAR=/opt/android/bundletool.jar
ENV CARGO_BUILD_JOBS=2
ENV CARGO_HOME=/usr/local/cargo
ENV COREPACK_HOME=/opt/corepack
ENV DEBIAN_FRONTEND=noninteractive
ENV GLITCHPAD_ANDROID_PACKAGE_CONTAINER=true
ENV GLITCHPAD_VALIDATION_TARGET=android-package
ENV GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=2 -Dfile.encoding=UTF-8"
ENV NDK_HOME=/opt/android-sdk/ndk/28.2.13676358
ENV PATH="/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/36.0.0:/usr/local/cargo/bin:${PATH}"
ENV RUSTUP_HOME=/usr/local/rustup

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        file \
        git \
        jq \
        libssl-dev \
        openjdk-17-jdk-headless \
        pkg-config \
        unzip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=linux-package /usr/local /usr/local
COPY --from=linux-package /opt/corepack /opt/corepack

RUN set -eux; \
    archive="commandlinetools-linux-${ANDROID_COMMAND_LINE_TOOLS_VERSION}_latest.zip"; \
    curl -fsSLo "/tmp/${archive}" "https://dl.google.com/android/repository/${archive}"; \
    echo "${ANDROID_COMMAND_LINE_TOOLS_SHA256}  /tmp/${archive}" | sha256sum -c -; \
    mkdir -p "${ANDROID_HOME}/cmdline-tools"; \
    unzip -q "/tmp/${archive}" -d /tmp/android-command-line-tools; \
    mv /tmp/android-command-line-tools/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest"; \
    rm -rf "/tmp/${archive}" /tmp/android-command-line-tools; \
    yes | sdkmanager --licenses >/dev/null; \
    sdkmanager \
        "platforms;android-${ANDROID_PLATFORM}" \
        "build-tools;${ANDROID_BUILD_TOOLS}" \
        "platform-tools" \
        "ndk;${ANDROID_NDK}"

RUN set -eux; \
    mkdir -p /opt/android; \
    curl -fsSLo "${BUNDLETOOL_JAR}" "https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar"; \
    echo "${BUNDLETOOL_SHA256}  ${BUNDLETOOL_JAR}" | sha256sum -c -

RUN rustup target add aarch64-linux-android x86_64-linux-android \
    && useradd --create-home --uid 1000 validator \
    && mkdir -p /opt/gradle \
    && chown -R validator:validator /opt/gradle

ENV GRADLE_USER_HOME=/opt/gradle
WORKDIR /workspace

FROM rust:1.96.0-bookworm

ARG NODE_VERSION=24.11.0
ARG CARGO_DENY_VERSION=0.20.2
ARG PLAYWRIGHT_VERSION=1.62.1
ARG PUPPETEER_VERSION=25.9.0

ENV COREPACK_HOME=/opt/corepack

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        fonts-liberation \
        libayatana-appindicator3-dev \
        libdbus-1-dev \
        libnspr4 \
        libnss3 \
        librsvg2-dev \
        libwebkit2gtk-4.1-dev \
        pkg-config \
        ripgrep \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    archive="node-v${NODE_VERSION}-linux-x64.tar.xz"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${archive}"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
    grep " ${archive}$" SHASUMS256.txt | sha256sum -c -; \
    tar -xJf "${archive}" -C /usr/local --strip-components=1; \
    rm "${archive}" SHASUMS256.txt; \
    mkdir -p "${COREPACK_HOME}"; \
    corepack enable; \
    corepack prepare pnpm@10.28.2 --activate; \
    chmod -R a+rX "${COREPACK_HOME}"

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PUPPETEER_CACHE_DIR=/ms-puppeteer
RUN pnpm dlx "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium \
    && pnpm dlx "puppeteer@${PUPPETEER_VERSION}" browsers install chrome-headless-shell \
    && chmod -R a+rX "${PLAYWRIGHT_BROWSERS_PATH}" "${PUPPETEER_CACHE_DIR}"

RUN useradd --create-home --uid 1000 validator

RUN rustup component add clippy rustfmt

RUN cargo install cargo-deny --version "${CARGO_DENY_VERSION}" --locked

COPY --from=powershell /opt/microsoft/powershell/7 /opt/microsoft/powershell/7
RUN ln -s /opt/microsoft/powershell/7/pwsh /usr/local/bin/pwsh

ENV PATH="/usr/local/cargo/bin:${PATH}"
ENV GLITCHPAD_VALIDATION_CONTAINER=true
WORKDIR /workspace
