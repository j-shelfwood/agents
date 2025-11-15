#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventStore } from '../monitor/database/event-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize EventStore (connect to same DB as monitor daemon)
const dbPath = path.join(__dirname, '../data/viz-data.db');
const eventStore = new EventStore(dbPath);

// Middleware
app.use(cors());
app.use(express.json());

// SSE clients tracking
const sseClients = new Set();

// ============================================================
// REST API ENDPOINTS
// ============================================================

/**
 * GET /api/sessions
 * List all agent sessions
 */
app.get('/api/sessions', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      project_dir: req.query.project_dir
    };

    const sessions = await eventStore.listSessions(filters);

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id
 * Get single session details
 */
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await eventStore.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id/events
 * Get events for a session
 */
app.get('/api/sessions/:id/events', async (req, res) => {
  try {
    const filters = {
      event_type: req.query.event_type,
      tool_name: req.query.tool_name,
      limit: parseInt(req.query.limit) || 1000,
      offset: parseInt(req.query.offset) || 0
    };

    const events = await eventStore.getEvents(req.params.id, filters);

    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id/file-activity
 * Get file operation aggregation for heatmap
 */
app.get('/api/sessions/:id/file-activity', async (req, res) => {
  try {
    const fileActivity = await eventStore.getFileActivity(req.params.id);

    res.json({
      success: true,
      count: fileActivity.length,
      files: fileActivity
    });
  } catch (error) {
    console.error('Error fetching file activity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id/command-stats
 * Get command category statistics
 */
app.get('/api/sessions/:id/command-stats', async (req, res) => {
  try {
    const commandStats = await eventStore.getCommandStats(req.params.id);

    res.json({
      success: true,
      categories: commandStats
    });
  } catch (error) {
    console.error('Error fetching command stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id/file-tree
 * Build hierarchical file tree from file operations
 */
app.get('/api/sessions/:id/file-tree', async (req, res) => {
  try {
    const fileActivity = await eventStore.getFileActivity(req.params.id);

    // Build tree structure
    const tree = buildFileTree(fileActivity);

    res.json({
      success: true,
      tree
    });
  } catch (error) {
    console.error('Error building file tree:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// SERVER-SENT EVENTS (Real-time updates)
// ============================================================

/**
 * GET /api/events/stream
 * SSE endpoint for real-time event streaming
 */
app.get('/api/events/stream', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write('data: {"type":"connected","message":"Event stream connected"}\n\n');

  // Add client to tracking
  const client = { id: Date.now(), res, sessionFilter: req.query.session };
  sseClients.add(client);

  console.log(`📡 SSE client connected (${sseClients.size} total)`);

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(client);
    console.log(`📡 SSE client disconnected (${sseClients.size} remaining)`);
  });
});

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Build hierarchical file tree from flat file list
 */
function buildFileTree(fileActivity) {
  const root = {
    name: 'root',
    type: 'directory',
    children: [],
    operations: 0
  };

  for (const file of fileActivity) {
    const parts = file.file_path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      let child = current.children?.find(c => c.name === part);

      if (!child) {
        child = {
          name: part,
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
          operations: 0,
          reads: 0,
          writes: 0,
          edits: 0
        };
        current.children.push(child);
      }

      if (isFile) {
        child.operations = file.total_operations;
        child.reads = file.reads;
        child.writes = file.writes;
        child.edits = file.edits;
        child.lastModified = file.last_modified;
      }

      current = child;
    }
  }

  return root;
}

/**
 * Broadcast event to all connected SSE clients
 */
function broadcastEvent(event) {
  const data = JSON.stringify(event);

  for (const client of sseClients) {
    // Filter by session if client specified
    if (client.sessionFilter && event.session_id !== client.sessionFilter) {
      continue;
    }

    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('Error broadcasting to client:', error);
      sseClients.delete(client);
    }
  }
}

// ============================================================
// STATIC FILE SERVING (for web dashboard)
// ============================================================

// Serve web dashboard (Phase 3 will build this)
const webDistPath = path.join(__dirname, '../web/dist');
app.use(express.static(webDistPath));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(webDistPath, 'index.html'));
  }
});

// ============================================================
// DATABASE CHANGE NOTIFICATION (for SSE)
// ============================================================

// Poll database for new events and broadcast via SSE
let lastEventId = 0;

setInterval(async () => {
  if (sseClients.size === 0) return;

  try {
    // Get events since last check
    const db = eventStore.db;
    const newEvents = db.prepare(`
      SELECT * FROM events
      WHERE id > ?
      ORDER BY id ASC
      LIMIT 100
    `).all(lastEventId);

    if (newEvents.length > 0) {
      lastEventId = newEvents[newEvents.length - 1].id;

      // Broadcast each event
      for (const event of newEvents) {
        broadcastEvent({
          type: 'event',
          data: event
        });
      }
    }
  } catch (error) {
    console.error('Error polling for new events:', error);
  }
}, 1000); // Poll every second

// ============================================================
// SERVER STARTUP
// ============================================================

app.listen(PORT, () => {
  console.log(`\n🚀 Agent Visualization Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 API Server:  http://localhost:${PORT}`);
  console.log(`📡 SSE Stream:  http://localhost:${PORT}/api/events/stream`);
  console.log(`🌐 Dashboard:   http://localhost:${PORT}\n`);
  console.log(`Database: ${dbPath}`);
  console.log(`\nPress Ctrl+C to stop\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  eventStore.close();
  process.exit(0);
});

export { app, broadcastEvent };
