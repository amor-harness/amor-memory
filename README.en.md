# @amor-harness/memory

**English** · [中文](./README.md)

The memory system plugin for Amor.

It organizes long-term memory as **store → domain → entry**, and provides automatic extraction, hybrid recall, prompt injection, a `/memory` virtual file system, and image memory.

## Capabilities

- **Memory stores**: multiple stores, default store, sharing and ACL
- **Domains**: real life, fiction, projects, work, and other contexts
- **Automatic extraction**: extract facts asynchronously after a reply, using `set_memory` / `append_memory` / `delete_memory`
- **Hybrid recall**: vectors + tags + lexical + cross-encoder + time decay + MMR
- **Injection**: a stable system baseline plus a per-turn dynamic context
- **VFS**: `/memory/<domain>/<key>.md`, `INDEX.yaml`, and a per-user `EXTRACTION.md`
- **Image memory**: normalization, dHash deduplication, image vectors, text/image cross-search
- **UI**: memory panel, message cards, and agent memory settings

## Requirements

- MongoDB for memory entries, stores, domains, and versions
- PostgreSQL + pgvector for text and image vectors
- An OpenAI-compatible embedding service
- An optional cross-encoder rerank service

## Configuration

Copy `config.example.json` to `config.json` and fill in the embedding, pgvector, and rerank endpoints for your deployment.

Main configuration groups:

```text
embedding   embedding service and dimensions
postgres    pgvector connection
rerank      cross-encoder
recall      candidate count, injection count, similarity thresholds
tags        tag-recall parameters
images      image vectors and recall thresholds
decay       time decay
mmr         redundancy reduction
limits      token/character limits
```

## Installation

This is a cordis plugin package, not a standalone service. It depends on the `database` plugin for shared MongoDB/PostgreSQL connections and creates the pgvector tables it needs on startup.

```text
plugin/database/
  plugin.json
  runtime/

plugin/memory/
  plugin.json
  runtime/
  client/dist/
  config.json
  docs/
```

`plugin.json` points to:

```json
{
  "client": { "entry": "./client/dist/index.mjs" },
  "runtime": { "entry": "./runtime/index.mjs" }
}
```

## Documentation

See [docs/README.md](./docs/README.md) for the full design:

- Architecture and lifecycle
- Data model
- Extraction, recall, and injection algorithms
- VFS and image memory
- Configuration and testing
- Embedding and rerank service API requirements

## License

MIT.
