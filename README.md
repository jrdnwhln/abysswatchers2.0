# Abyss Watchers Signal Mesh

A local-first static web app for tracking:

- live crypto market movement via CoinGecko public endpoints
- recent scientific publication records via NCBI PubMed
- a personal or community watchlist, notes, and shareable "signal packs"
- a browser-generated node identity that signs exported packs and verifies imported ones
- an optional YouTube-powered radio panel that starts a default station only after explicit accept

## Run locally

Serve the folder with any static server. For example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Data sources

- CoinGecko public market endpoints
- NCBI E-utilities for PubMed research records
- YouTube embeds for the optional radio station

## Local-first behavior

- watchlist and notes are saved in `localStorage`
- the current topic and watchlist are mirrored into the URL hash for easy sharing
- the service worker caches the app shell for offline reopening
- radio consent and the last pasted YouTube station are also stored locally
- a local ECDSA keypair identifies the node and signs exported signal packs
- imported packs are checked against the included public key and marked verified, unsigned, or failed

## Accuracy notes

- the research stream surfaces legitimate NCBI PubMed records and metadata, not verified summaries of scientific truth
- the app now has a self-sovereign decentralized ownership layer for packs, but it is not yet a full peer-to-peer sync network

## Next decentralization step

- add browser-to-browser peer discovery and sync with libp2p/WebRTC so nodes can exchange signed packs directly instead of relying only on manual export/import
