import { useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'
import './ProfileButton.css'

export default function ProfileButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="profile-btn"
      onClick={() => navigate('/profile')}
      aria-label="Profile"
    >
      <User size={22} strokeWidth={2} />
    </button>
  )
}
