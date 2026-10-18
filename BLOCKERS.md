# Blockers

**Last updated**: 2026-10-18

## Active

- No authorized hosted deployment. Do not invent a URL or spend money on external infrastructure. Local preview is `bash .cursor/start.sh`, then `http://localhost:5173`.
- No OCR engine (`tesseract`) and no LibreOffice conversion, so image OCR and legacy Office text extraction stay unavailable.
- AI-writing assessment has no independent real-world benchmark. It stays non-consequential until one exists.
- `main` is protected from direct product edits. Integration waits on review of `cursor/academic-review-lab-ba77`.

## Closed

- ADR-001 removed AI assessment. The product owner reversed that. The feature is experimental, not removed.
- Postgres TCP password auth failed. The app uses the local socket as the `ubuntu` role.
