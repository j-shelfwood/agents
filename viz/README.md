# Agent Visualization System

Real-time monitoring and visualization of autonomous agent activity.

## Project Structure

- `monitor/` - Event collection daemon (Phase 1)
- `server/` - Web server + API (Phase 2)
- `web/` - React dashboard (Phase 3)
- `shared/` - Shared type definitions
- `data/` - SQLite database storage
- `logs/` - Daemon logs

## Development

```bash
# Install dependencies
npm install

# Run monitor daemon
npm run dev

# Run all services (Phases 2+)
npm run dev:all
```

## Architecture

See `../VISUALIZATION_SPEC.md` for complete technical specification.
