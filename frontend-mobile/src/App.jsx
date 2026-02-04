import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Checkout from './pages/Checkout'
import RecentOrders from './pages/RecentOrders'
import Calendar from './pages/Calendar'
import Inventory from './pages/Inventory'
import Profile from './pages/Profile'
import Placeholder from './pages/Placeholder'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<RecentOrders />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/shipment" element={<Placeholder title="Shipment" />} />
          <Route path="/accounting" element={<Placeholder title="Accounting" />} />
          <Route path="/tables" element={<Placeholder title="Tables" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
          <Route path="/statistics" element={<Placeholder title="Statistics" />} />
        </Route>
      </Routes>
    </div>
  )
}
