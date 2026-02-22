# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-02-21

### Added

- `--rewrite-links` CLI option to convert absolute URLs to relative paths in downloaded HTML and CSS files. Links are only rewritten when the target file exists locally in the download directory.

## [1.0.0] - 2025-02-21

### Added

- Initial release
- CDX API snapshot discovery with pagination
- Concurrent downloads with configurable concurrency (default: 5)
- Exponential backoff retry logic
- URL filtering via `--only` and `--exclude` (supports regex patterns)
- Timestamp range filtering via `--from` and `--to`
- Progress bars and colored terminal output
- Option to download all snapshot versions with `--all-timestamps`
- Option to include non-200 responses with `--all`
