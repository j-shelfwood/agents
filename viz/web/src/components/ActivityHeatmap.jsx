import './ActivityHeatmap.css';

const CATEGORY_COLORS = {
  git: '#f1502f',
  npm: '#cb3837',
  shell: '#4a90e2',
  python: '#3776ab',
  php: '#777bb4',
  brew: '#fbb040',
  test: '#44cc11'
};

function ActivityHeatmap({ stats }) {
  if (!stats || stats.length === 0) {
    return <div className="empty-viz">No command data yet</div>;
  }

  const maxCount = Math.max(...stats.map(s => s.count));

  return (
    <div className="activity-heatmap">
      {stats.map(stat => (
        <div key={stat.command_category} className="stat-row">
          <div className="stat-label">{stat.command_category}</div>
          <div className="stat-bar-container">
            <div
              className="stat-bar"
              style={{
                width: `${(stat.count / maxCount) * 100}%`,
                backgroundColor: CATEGORY_COLORS[stat.command_category] || '#95a5a6'
              }}
            />
          </div>
          <div className="stat-count">{stat.count}</div>
        </div>
      ))}
    </div>
  );
}

export default ActivityHeatmap;
