function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #ddd' }}>
      {tabs.map(tab => (
        <span
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            cursor: 'pointer',
            color: activeTab === tab.id ? '#000' : '#666',
            marginRight: '8px',
            borderBottom: activeTab === tab.id ? '1px solid #000' : 'none'
          }}
        >
          {tab.label}
        </span>
      ))}
    </div>
  )
}

export default Tabs












