import OverviewDashboard from '../components/dashboard/OverviewDashboard'

function StatisticsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <OverviewDashboard />
    </div>
  )
}

export default StatisticsPage
