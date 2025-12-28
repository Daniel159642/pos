import Statistics from '../components/Statistics'

function StatisticsPage() {
  return (
    <div style={{ 
      padding: '32px 24px', 
      backgroundColor: '#f5f5f5', 
      minHeight: 'calc(100vh - 200px)',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <div style={{
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '28px',
        backgroundColor: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        minHeight: '600px'
      }}>
        <h1 style={{ 
          margin: '0 0 24px 0', 
          fontSize: '28px', 
          fontWeight: 600,
          color: '#1a1a1a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
        }}>
          Statistics
        </h1>
        <div style={{ height: 'calc(100vh - 350px)', minHeight: '500px' }}>
          <Statistics />
        </div>
      </div>
    </div>
  )
}

export default StatisticsPage

