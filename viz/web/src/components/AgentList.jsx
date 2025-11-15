import './AgentList.css';

function AgentList({ sessions, activeSession, onSelectSession }) {
  return (
    <div className="agent-list">
      <h3>Active Agents ({sessions.length})</h3>

      <div className="agent-items">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`agent-item ${
              activeSession?.id === session.id ? 'active' : ''
            }`}
            onClick={() => onSelectSession(session)}
          >
            <div className="agent-name">{session.id}</div>
            <div className="agent-project">
              {session.project_dir?.split('/').pop() || 'Unknown'}
            </div>
            <div className="agent-time">
              {new Date(session.spawned_at).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentList;
