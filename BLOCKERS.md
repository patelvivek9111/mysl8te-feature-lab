# Blockers

**Last updated**: 2026-11-18

## Active

- No authorized hosted deployment. Do not invent a URL or spend money on external infrastructure. Local preview is `bash .cursor/start.sh`, then `http://localhost:5173`.
- No OCR engine (`tesseract`) and no LibreOffice conversion, so image OCR and legacy Office text extraction stay unavailable.
- AI-writing assessment has no independent, consented labeled dataset (human, AI-generated, AI-paraphrased, hybrid; non-native writers; several disciplines) sized per `docs/evaluations/AI_WRITING_RELEASE_GATES.md`. It stays experimental and non-consequential until one is provided. Self-written samples are not evidence.
- Similarity has no licensed internet or publication index. It compares against reference texts and peer submissions only.
- `main` is protected from direct product edits. Integration waits on review of PR #4.

## Closed

- Two divergent product branches (2026-11-18): resolved by ADR-010.
- PostgreSQL unavailable in the VM: it installs via apt; `install.sh` installs it.
- ADR-001 removed AI assessment. The product owner reversed that. The feature is experimental, not removed.
- Postgres TCP password auth failed. The app uses the local socket as the `ubuntu` role.
