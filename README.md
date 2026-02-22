# wayback-dl

Download archived websites from the [Internet Archive Wayback Machine](https://web.archive.org/).

## Install

```bash
npm install -g wayback-dl
```

Or run without installing:

```bash
npx wayback-dl https://example.com
```

## Usage

```bash
wayback-dl <url> [options]
```

### Examples

```bash
# Download a site to ./websites/example.com/
wayback-dl https://example.com

# Download to a custom directory
wayback-dl https://example.com -d ./my-archive/

# Use 20 concurrent downloads
wayback-dl https://example.com -c 20

# Only download images
wayback-dl https://example.com -o "/\.(jpg|png|gif)$/i"

# Exclude certain paths
wayback-dl https://example.com -x "/ads/"

# Restrict by timestamp (YYYYMMDDHHmmss)
wayback-dl https://example.com -f 20060101000000 -t 20101231235959

# List files as JSON without downloading
wayback-dl https://example.com -l

# Rewrite absolute URLs to relative paths for local browsing
wayback-dl https://example.com --rewrite-links
```

### Options

| Flag | Description |
|------|-------------|
| `-d, --directory <path>` | Output directory (default: `./websites/{domain}/`) |
| `-c, --concurrency <n>` | Parallel downloads (default: 5) |
| `-f, --from <timestamp>` | Only snapshots from this timestamp |
| `-t, --to <timestamp>` | Only snapshots up to this timestamp |
| `-o, --only <filter>` | Only download URLs matching filter (use `/regex/` for regex) |
| `-x, --exclude <filter>` | Exclude URLs matching filter |
| `-a, --all` | Include non-200 responses (errors, redirects) |
| `-s, --all-timestamps` | Download all snapshot versions |
| `-e, --exact-url` | Download only the exact URL, not the full site |
| `-l, --list` | List files as JSON without downloading |
| `--max-pages <n>` | Max CDX API pages (default: 100) |
| `--overwrite` | Re-download existing files |
| `--retry <n>` | Max retries per file (default: 5) |
| `--rewrite-links` | Rewrite absolute URLs to relative paths in downloaded HTML/CSS |
| `--no-color` | Disable colored output |

## Requirements

- Node.js 18+

## License

MIT
