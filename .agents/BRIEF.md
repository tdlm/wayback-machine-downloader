# Project Brief

## Goal

Build a robust, efficient CLI tool to download archived websites from the Internet Archive Wayback Machine. The tool should be publishable to npm and usable via `npx wayback-dl`.

## Motivation

- Preserve and restore archived websites locally
- Enable offline access to historical web content
- Provide a modern, TypeScript-based alternative to existing tools

## Target Audience

- Archivists and researchers
- Developers recovering legacy sites
- Anyone needing bulk download of Wayback Machine archives

## Design Principles

1. **Robustness** – Exponential backoff on failures, graceful error handling
2. **Efficiency** – Concurrent downloads, configurable parallelism
3. **Usability** – Color-coded output, progress bars, clear CLI flags
4. **Testability** – Unit tests for core logic, mockable dependencies

## Non-Goals

- Not a general-purpose web crawler
- Not a mirror of the live web (only archived content)
- No direct dependency on the reference Ruby implementation
