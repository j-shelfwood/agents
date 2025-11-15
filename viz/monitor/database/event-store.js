import Database from 'better-sqlite3';
import { initializeDatabase } from './migrations.js';

export class EventStore {
  constructor(dbPath = './viz-data.db') {
    this.db = initializeDatabase(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._prepareStatements();
  }

  _prepareStatements() {
    // Session statements
    this.stmts = {
      createSession: this.db.prepare(`
        INSERT INTO sessions (
          id, copilot_session_id, project_dir, task_file,
          spawned_at, spawned_by, status, importance, pid, last_activity
        ) VALUES (
          @id, @copilot_session_id, @project_dir, @task_file,
          @spawned_at, @spawned_by, @status, @importance, @pid, @last_activity
        )
      `),
      
      updateSession: this.db.prepare(`
        UPDATE sessions 
        SET copilot_session_id = COALESCE(@copilot_session_id, copilot_session_id),
            project_dir = COALESCE(@project_dir, project_dir),
            task_file = COALESCE(@task_file, task_file),
            spawned_by = COALESCE(@spawned_by, spawned_by),
            status = COALESCE(@status, status),
            importance = COALESCE(@importance, importance),
            pid = COALESCE(@pid, pid),
            last_activity = COALESCE(@last_activity, last_activity),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `),
      
      getSession: this.db.prepare('SELECT * FROM sessions WHERE id = ?'),
      
      listSessions: this.db.prepare('SELECT * FROM sessions ORDER BY spawned_at DESC'),
      
      listSessionsFiltered: null, // Dynamic based on filters
      
      // Event statements
      insertEvent: this.db.prepare(`
        INSERT INTO events (
          session_id, copilot_event_id, parent_event_id,
          timestamp, event_type, tool_name, tool_call_id, tool_arguments,
          file_path, operation, command, command_category,
          status, duration_ms, source, raw_data
        ) VALUES (
          @session_id, @copilot_event_id, @parent_event_id,
          @timestamp, @event_type, @tool_name, @tool_call_id, @tool_arguments,
          @file_path, @operation, @command, @command_category,
          @status, @duration_ms, @source, @raw_data
        )
      `),
      
      getEvents: this.db.prepare(`
        SELECT * FROM events 
        WHERE session_id = ? 
        ORDER BY timestamp ASC
      `),
      
      getEventsFiltered: null, // Dynamic based on filters
      
      getFileActivity: this.db.prepare(`
        SELECT * FROM file_activity 
        WHERE session_id = ?
        ORDER BY total_operations DESC
      `),
      
      getCommandStats: this.db.prepare(`
        SELECT * FROM command_stats 
        WHERE session_id = ?
        ORDER BY count DESC
      `)
    };
  }

  // Session management
  async createSession(sessionData) {
    const data = {
      id: sessionData.id,
      copilot_session_id: sessionData.copilot_session_id || null,
      project_dir: sessionData.project_dir,
      task_file: sessionData.task_file || null,
      spawned_at: sessionData.spawned_at || new Date().toISOString(),
      spawned_by: sessionData.spawned_by || null,
      status: sessionData.status || 'running',
      importance: sessionData.importance || 'normal',
      pid: sessionData.pid || null,
      last_activity: sessionData.last_activity || new Date().toISOString()
    };

    try {
      const existing = this.getSession(data.id);
      
      if (existing) {
        console.log(`Session ${data.id} already exists, skipping creation`);
        return existing;
      }

      this.stmts.createSession.run(data);
      return this.getSession(data.id);
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  async updateSession(sessionId, updates) {
    const data = {
      id: sessionId,
      copilot_session_id: updates.copilot_session_id,
      project_dir: updates.project_dir,
      task_file: updates.task_file,
      spawned_by: updates.spawned_by,
      status: updates.status,
      importance: updates.importance,
      pid: updates.pid,
      last_activity: updates.last_activity
    };

    try {
      this.stmts.updateSession.run(data);
      return this.getSession(sessionId);
    } catch (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  getSession(sessionId) {
    try {
      if (!this.stmts || !this.stmts.getSession) {
        throw new Error('Prepared statements not initialized');
      }
      return this.stmts.getSession.get(sessionId);
    } catch (error) {
      throw new Error(`Failed to get session (${sessionId}): ${error.message}`);
    }
  }

  async listSessions(filters = {}) {
    try {
      if (Object.keys(filters).length === 0) {
        return this.stmts.listSessions.all();
      }

      let query = 'SELECT * FROM sessions WHERE 1=1';
      const params = [];

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.importance) {
        query += ' AND importance = ?';
        params.push(filters.importance);
      }

      if (filters.project_dir) {
        query += ' AND project_dir = ?';
        params.push(filters.project_dir);
      }

      query += ' ORDER BY spawned_at DESC';

      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
  }

  // Event management
  async insertEvent(eventData) {
    const data = {
      session_id: eventData.session_id,
      copilot_event_id: eventData.copilot_event_id || null,
      parent_event_id: eventData.parent_event_id || null,
      timestamp: eventData.timestamp || new Date().toISOString(),
      event_type: eventData.event_type,
      tool_name: eventData.tool_name || null,
      tool_call_id: eventData.tool_call_id || null,
      tool_arguments: eventData.tool_arguments ? JSON.stringify(eventData.tool_arguments) : null,
      file_path: eventData.file_path || null,
      operation: eventData.operation || null,
      command: eventData.command || null,
      command_category: eventData.command_category || null,
      status: eventData.status || null,
      duration_ms: eventData.duration_ms || null,
      source: eventData.source,
      raw_data: eventData.raw_data ? JSON.stringify(eventData.raw_data) : null
    };

    try {
      const result = this.stmts.insertEvent.run(data);
      return result.lastInsertRowid;
    } catch (error) {
      throw new Error(`Failed to insert event: ${error.message}`);
    }
  }

  async insertEvents(eventsArray) {
    const insert = this.db.transaction((events) => {
      const results = [];
      for (const event of events) {
        const data = {
          session_id: event.session_id,
          copilot_event_id: event.copilot_event_id || null,
          parent_event_id: event.parent_event_id || null,
          timestamp: event.timestamp || new Date().toISOString(),
          event_type: event.event_type,
          tool_name: event.tool_name || null,
          tool_call_id: event.tool_call_id || null,
          tool_arguments: event.tool_arguments ? JSON.stringify(event.tool_arguments) : null,
          file_path: event.file_path || null,
          operation: event.operation || null,
          command: event.command || null,
          command_category: event.command_category || null,
          status: event.status || null,
          duration_ms: event.duration_ms || null,
          source: event.source,
          raw_data: event.raw_data ? JSON.stringify(event.raw_data) : null
        };
        results.push(this.stmts.insertEvent.run(data).lastInsertRowid);
      }
      return results;
    });

    try {
      return insert(eventsArray);
    } catch (error) {
      throw new Error(`Failed to insert events batch: ${error.message}`);
    }
  }

  async getEvents(sessionId, filters = {}) {
    try {
      if (Object.keys(filters).length === 0) {
        return this.stmts.getEvents.all(sessionId);
      }

      let query = 'SELECT * FROM events WHERE session_id = ?';
      const params = [sessionId];

      if (filters.event_type) {
        query += ' AND event_type = ?';
        params.push(filters.event_type);
      }

      if (filters.tool_name) {
        query += ' AND tool_name = ?';
        params.push(filters.tool_name);
      }

      if (filters.file_path) {
        query += ' AND file_path = ?';
        params.push(filters.file_path);
      }

      if (filters.command_category) {
        query += ' AND command_category = ?';
        params.push(filters.command_category);
      }

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      query += ' ORDER BY timestamp ASC';

      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      throw new Error(`Failed to get events: ${error.message}`);
    }
  }

  async getEventByCopilotId(sessionId, copilotEventId) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM events
        WHERE session_id = ? AND copilot_event_id = ?
        LIMIT 1
      `);
      return stmt.get(sessionId, copilotEventId);
    } catch (error) {
      throw new Error(`Failed to get event by copilot ID: ${error.message}`);
    }
  }

  async getFileActivity(sessionId) {
    try {
      return this.stmts.getFileActivity.all(sessionId);
    } catch (error) {
      throw new Error(`Failed to get file activity: ${error.message}`);
    }
  }

  async getCommandStats(sessionId) {
    try {
      return this.stmts.getCommandStats.all(sessionId);
    } catch (error) {
      throw new Error(`Failed to get command stats: ${error.message}`);
    }
  }

  // Utilities
  async close() {
    try {
      this.db.close();
    } catch (error) {
      throw new Error(`Failed to close database: ${error.message}`);
    }
  }

  async healthCheck() {
    try {
      const result = this.db.prepare('SELECT 1 as status').get();
      return result.status === 1;
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }
}
