FROM mcr.microsoft.com/powershell:7.5-debian-12 AS powershell

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
