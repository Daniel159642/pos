import { Outlet } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  return (
    <div className="app-layout">
      <main className="app-layout-main">
        <Outlet />
      </main>
    </div>
  )
}
