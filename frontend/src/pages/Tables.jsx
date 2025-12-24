import { useState, useEffect } from 'react'
import Table from '../components/Table'
import Tabs from '../components/Tabs'

const TABS = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'shipments', label: 'Shipments' },
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
  { id: 'employees', label: 'Employees' }
]

function Tables() {
  const [activeTab, setActiveTab] = useState('inventory')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/${activeTab}`)
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError('Error loading data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div style={{ padding: '20px', overflowX: 'auto' }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>}
        {error && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>{error}</div>}
        {!loading && !error && data && (
          data.data && data.data.length > 0 ? (
            <Table columns={data.columns} data={data.data} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No data</div>
          )
        )}
      </div>
    </div>
  )
}

export default Tables

