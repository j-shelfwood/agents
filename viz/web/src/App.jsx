import { useState, useEffect } from 'react';
import AgentList from './components/AgentList';
import FileTree from './components/FileTree';
import CommandTimeline from './components/CommandTimeline';
import ActivityHeatmap from './components/ActivityHeatmap';
import { useEventStream } from './hooks/useEventStream';
import './App.css';

const API_URL = 'http://localhost:3001';

function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [fileTree, setFileTree] = useState(null);
  const [events, setEvents] = useState([]);
  const [commandStats, setCommandStats] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Fetch session data when active session changes
  useEffect(() => {
    if (activeSession) {
      fetchSessionData(activeSession.id);
    }
  }, [activeSession]);

  // Connect to SSE stream for real-time updates
  const { connected, lastEvent } = useEventStream(
    `${API_URL}/api/events/stream`,
    activeSession?.id
  );

  // Handle real-time events
  useEffect(() => {
    if (lastEvent && lastEvent.session_id === activeSession?.id) {
      // Add new event to timeline
      setEvents(prev => [...prev, lastEvent].slice(-1000)); // Keep last 1000

      // Refresh file tree if file operation
      if (lastEvent.file_path) {
        fetchFileTree(activeSession.id);
      }
    }
  }, [lastEvent, activeSession?.id]);

  async function fetchSessions() {
    try {
      const res = await fetch(`${API_URL}/api/sessions`);
      const data = await res.json();

      if (data.success) {
        setSessions(data.sessions);

        // Auto-select first session
        if (data.sessions.length > 0 && !activeSession) {
          setActiveSession(data.sessions[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSessionData(sessionId) {
    try {
      // Fetch file tree
      fetchFileTree(sessionId);

      // Fetch events
      const eventsRes = await fetch(
        `${API_URL}/api/sessions/${sessionId}/events?limit=1000`
      );
      const eventsData = await eventsRes.json();
      if (eventsData.success) {
        setEvents(eventsData.events);
      }

      // Fetch command stats
      const statsRes = await fetch(
        `${API_URL}/api/sessions/${sessionId}/command-stats`
      );
      const statsData = await statsRes.json();
      if (statsData.success) {
        setCommandStats(statsData.categories);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  }

  async function fetchFileTree(sessionId) {
    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/file-tree`);
      const data = await res.json();

      if (data.success) {
        setFileTree(data.tree);
      }
    } catch (error) {
      console.error('Error fetching file tree:', error);
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <h2>Loading agent sessions...</h2>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 Agent Visualization Dashboard</h1>
        <div className="connection-status">
          {connected ? (
            <span className="status-connected">● Live</span>
          ) : (
            <span className="status-disconnected">○ Disconnected</span>
          )}
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <AgentList
            sessions={sessions}
            activeSession={activeSession}
            onSelectSession={setActiveSession}
          />
        </aside>

        <main className="main-content">
          {activeSession ? (
            <>
              <section className="session-header">
                <h2>{activeSession.id}</h2>
                <p>{activeSession.project_dir}</p>
                <span className="session-status">{activeSession.status}</span>
              </section>

              <div className="visualizations">
                <div className="viz-panel">
                  <h3>File Activity</h3>
                  {fileTree && <FileTree data={fileTree} />}
                </div>

                <div className="viz-panel">
                  <h3>Command Timeline</h3>
                  <CommandTimeline events={events} />
                </div>

                <div className="viz-panel">
                  <h3>Command Categories</h3>
                  <ActivityHeatmap stats={commandStats} />
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>No agent selected</h2>
              <p>Select an agent from the sidebar to view activity</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
