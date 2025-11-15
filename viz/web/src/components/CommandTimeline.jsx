import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const CATEGORY_COLORS = {
  git: '#f1502f',
  npm: '#cb3837',
  shell: '#4a90e2',
  python: '#3776ab',
  php: '#777bb4',
  brew: '#fbb040',
  test: '#44cc11',
  filesystem: '#95a5a6'
};

function CommandTimeline({ events }) {
  // Filter to command events only
  const commandEvents = events
    .filter(e => e.command_category)
    .map(e => ({
      timestamp: new Date(e.timestamp).getTime(),
      category: e.command_category,
      command: e.command,
      duration: e.duration_ms || 0
    }));

  if (commandEvents.length === 0) {
    return <div className="empty-viz">No command events yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="timestamp"
          name="Time"
          domain={['auto', 'auto']}
          tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
        />
        <YAxis
          type="category"
          dataKey="category"
          name="Category"
        />
        <Tooltip
          content={({ payload }) => {
            if (!payload || !payload[0]) return null;
            const data = payload[0].payload;
            return (
              <div className="custom-tooltip">
                <p><strong>{data.category}</strong></p>
                <p>{data.command?.slice(0, 50)}</p>
                <p>{new Date(data.timestamp).toLocaleTimeString()}</p>
                {data.duration > 0 && <p>{data.duration}ms</p>}
              </div>
            );
          }}
        />
        <Scatter data={commandEvents}>
          {commandEvents.map((entry, index) => (
            <Cell
              key={index}
              fill={CATEGORY_COLORS[entry.category] || '#95a5a6'}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export default CommandTimeline;
