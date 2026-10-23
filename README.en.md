# @amor-harness/memory

[中文](./README.md) · **English**

The long-term memory plugin for Amor. It organizes memory as **store → domain → entry** and owns automatic extraction, hybrid recall, prompt injection, the `/memory` virtual file system, and image memory.

## Capabilities

- **Memory stores**: multiple stores, a default store, sharing, and ACL
- **Domains**: real-life, fictional, project, work, and other contexts; domains constrain both reads and writes
- **Automatic extraction**: extract facts asynchronously after a reply with `set_memory` / `append_memory` / `delete_memory`
- **Hybrid recall**: vectors + tags + lexical search + cross-encoder + time decay + MMR
- **Injection**: a stable system baseline plus a per-turn dynamic context
- **VFS**: `/memory/<domain>/<key>.md`, `INDEX.yaml`, and a per-user `EXTRACTION.md`
- **Image memory**: normalization, dHash near-duplicate detection, image vectors, text/image cross-search
- **UI**: memory panel, message cards, agent memory settings, and store sharing

Memory is isolated per user. A store is the isolation unit. Stable memories form the baseline, while ephemeral memories are recalled per turn; the two paths never inject the same key twice.

## Architecture

```text
Browser UI
  ├─ memory panel / message cards / agent settings
  └─ plugin API
        │
        ▼
memory runtime (plugin kernel child process)
  ├─ turn, conversation, image, and VFS lifecycle events
  ├─ plugin API for memories and stores
  ├─ extraction, recall, injection, images
  └─ /memory VFS provider
        │
        ├─ MongoDB: store / domain / entry / version / image
        └─ PostgreSQL + pgvector: text and image vectors
```

The host only notifies the plugin at the right turn boundaries; the plugin owns memory reads, writes, recall, and formatting.

## Requirements

The plugin runs inside an Amor plugin host and needs:

- **database** — MongoDB and PostgreSQL/pgvector connections
- **permissions** — store ACL and sharing
- **i18n** — client translations
- **agent-runtime** — agent lifecycle and tool runtime

It also uses optional embedding and rerank HTTP services. Without embeddings, recall falls back to tags and lexical search; without a reranker, the original ordering is kept.

## Installation

Place the directory in the host's plugin root (for example `plugin/memory`); `plugin.json` defines the entries. Copy `config.example.json` to `config.json`, fill in the embedding/rerank endpoints, then build:

```bash
npm install
npm run build
```

The build uses shared packages from the host monorepo (`@amor-harness/api` / `data-provider` / `data-schemas`). A standalone clone needs those packages resolvable.

## Configuration

`config.json` is a flat key map grouped by concern:

```json
{
  "embedding": { "MEMORY_EMBED_URL": "http://127.0.0.1:8788", "MEMORY_EMBED_DIM": "1024" },
  "rerank": { "MEMORY_RERANK_URL": "http://127.0.0.1:8787" },
  "recall": { "MEMORY_RAG_CANDIDATES": "15", "MEMORY_RAG_LIMIT": "3" }
}
```

Environment variables override the file. See [docs/config.md](./docs/config.md) for every field, defaults, and tuning guidance.

## Usage

### UI

- Sidebar **Memories**: browse, search, create, edit, delete, toggle stable/locked, and inspect versions
- Message cards: **memory updated** / **recalled** results for the turn
- Agent settings → Memory: choose the memory store and domains
- Sharing dialog: share a store with users, groups, or public access

### Automatic extraction

After a message is persisted, the plugin reads the conversation window asynchronously and writes memories through tools. It never blocks the reply. Extractions for one conversation are serialized, and a new turn interrupts the previous extraction.

### Recall and injection

Before a turn, the plugin recalls ephemeral memories from the active store and domains. Stable memories form a separately cacheable system baseline. Both paths deduplicate keys and never spend tokens on the same memory twice.

### VFS

```text
/memory/
  INDEX.yaml
  EXTRACTION.md
  <domain>/<key>.md
  <key>.md
  images/<id>.<ext>
```

`INDEX.yaml` is read-only; `EXTRACTION.md` is the user's extraction prompt; ordinary memory files are writable. See [docs/vfs.md](./docs/vfs.md).

## Documentation

- [Documentation index](./docs/README.md)
- [Architecture](./docs/architecture.md)
- [Data model](./docs/data-model.md)
- [Extraction](./docs/extraction.md)
- [Recall](./docs/recall.md)
- [Injection](./docs/injection.md)
- [Client](./docs/client.md)
- [RPC](./docs/rpc.md)
- [VFS](./docs/vfs.md)
- [Images](./docs/images.md)
- [Services](./docs/services.md)
- [Configuration](./docs/config.md)
- [Testing](./docs/testing.md)

## Development

```bash
npm run typecheck
npm run typecheck:client
npm run build
npm test
```

Artifacts: `runtime/dist/index.mjs` and `client/dist/index.mjs`. See [docs/testing.md](./docs/testing.md) for tests and end-to-end verification.

## License

MIT
