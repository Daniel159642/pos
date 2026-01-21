import { useState, useEffect } from 'react'
import { useSignUp, useAuth } from '@clerk/clerk-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import '../index.css'

function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { themeColor } = useTheme()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(false)

  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)

  // Check if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Check if onboarding is complete
      fetch('/api/onboarding/status')
        .then(res => res.json())
        .then(data => {
          if (data.setup_completed) {
            navigate('/login')
          } else {
            // Redirect to onboarding to complete setup
            navigate('/onboarding')
          }
        })
        .catch(() => {
          // On error, go to login
          navigate('/login')
        })
    }
  }, [isLoaded, isSignedIn, navigate])

  // Check for verification code from URL
  useEffect(() => {
    const code = searchParams.get('code')
    if (code && signUp?.status === 'missing_requirements') {
      setVerificationCode(code)
      setPendingVerification(true)
    }
  }, [searchParams, signUp?.status])

  const handleEmailSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!isLoaded || !signUp) {
      setError('Please wait for authentication to load')
      setLoading(false)
      return
    }

    try {
      // Create sign-up attempt
      await signUp.create({
        emailAddress: email,
        password: password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      })

      // If email verification is required
      if (signUp.status === 'missing_requirements') {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setPendingVerification(true)
      } else if (signUp.status === 'complete') {
        // Signup complete, set active session
        await setActive({ session: signUp.createdSessionId })
        // Wait a bit for session to be set
        await new Promise(resolve => setTimeout(resolve, 500))
        // Always redirect to onboarding after signup to complete setup
        // This ensures establishment creation happens during onboarding
        const redirectTo = searchParams.get('redirect') || '/onboarding'
        window.location.href = redirectTo // Use window.location to ensure full reload
      }
    } catch (err) {
      console.error('Sign up error:', err)
      setError(err?.errors?.[0]?.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!isLoaded || !signUp) {
      setError('Please wait for authentication to load')
      setLoading(false)
      return
    }

    try {
      // Verify email with code
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      })

      if (result.status === 'complete') {
        // Verification complete, set active session
        await setActive({ session: signUp.createdSessionId })
        // Wait a bit for session to be set
        await new Promise(resolve => setTimeout(resolve, 500))
        // Always redirect to onboarding after signup to complete setup
        // This ensures establishment creation happens during onboarding
        const redirectTo = searchParams.get('redirect') || '/onboarding'
        window.location.href = redirectTo // Use window.location to ensure full reload
      }
    } catch (err) {
      console.error('Verification error:', err)
      setError(err?.errors?.[0]?.message || 'Invalid verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    if (!isLoaded || !signUp) return

    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setError('Verification code sent! Check your email.')
    } catch (err) {
      setError(err?.errors?.[0]?.message || 'Failed to resend code')
    }
  }

  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-secondary)',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '32px 40px 40px 40px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px var(--shadow)',
        width: '100%',
        maxWidth: '450px',
        border: '1px solid var(--border-light)'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          {pendingVerification ? 'Verify Your Email' : 'Create Account'}
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          {pendingVerification 
            ? 'Enter the verification code sent to your email'
            : 'Sign up to get started with your POS system'
          }
        </p>

        {pendingVerification ? (
          <form onSubmit={handleVerification}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}>
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: `2px solid rgba(${themeColorRgb}, 0.4)`,
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                  textAlign: 'center',
                  letterSpacing: '8px',
                  fontFamily: 'monospace',
                  fontSize: '20px'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.4)`
                  e.target.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 600,
                backgroundColor: (loading || verificationCode.length !== 6) 
                  ? 'var(--bg-secondary)' 
                  : `rgba(${themeColorRgb}, 0.7)`,
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: (loading || verificationCode.length !== 6) ? 'not-allowed' : 'pointer',
                opacity: (loading || verificationCode.length !== 6) ? 0.6 : 1,
                boxShadow: (loading || verificationCode.length !== 6) 
                  ? 'none' 
                  : `0 4px 15px rgba(${themeColorRgb}, 0.3)`,
                transition: 'all 0.3s ease',
                marginBottom: '12px'
              }}
              onMouseEnter={(e) => {
                if (!loading && verificationCode.length === 6) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.85)`
                  e.target.style.transform = 'scale(0.98)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && verificationCode.length === 6) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.transform = 'scale(1)'
                }
              }}
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>

            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = 'var(--bg-secondary)'
                  e.target.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = 'transparent'
                  e.target.style.color = 'var(--text-secondary)'
                }
              }}
            >
              Resend Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailSignUp}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}>
                First Name (Optional)
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: `2px solid rgba(${themeColorRgb}, 0.4)`,
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.4)`
                  e.target.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}>
                Last Name (Optional)
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: `2px solid rgba(${themeColorRgb}, 0.4)`,
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.4)`
                  e.target.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: `2px solid rgba(${themeColorRgb}, 0.4)`,
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.4)`
                  e.target.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                minLength={8}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: `2px solid rgba(${themeColorRgb}, 0.4)`,
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = `rgba(${themeColorRgb}, 0.4)`
                  e.target.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }}
              />
              <p style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '6px'
              }}>
                Must be at least 8 characters
              </p>
            </div>

            {/* Google Sign Up Button */}
            <button
              type="button"
              onClick={async () => {
                if (!isLoaded || !signUp) {
                  setError('Please wait for authentication to load')
                  return
                }
                try {
                  setError('')
                  setLoading(true)
                  // Redirect to Google OAuth
                  await signUp.authenticateWithRedirect({
                    strategy: 'oauth_google',
                    redirectUrl: '/onboarding',
                    redirectUrlComplete: '/onboarding'
                  })
                } catch (err) {
                  console.error('Google sign up error:', err)
                  setError(err?.errors?.[0]?.message || 'Failed to sign up with Google. Please try again.')
                  setLoading(false)
                }
              }}
              disabled={loading || !isLoaded}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 600,
                backgroundColor: loading || !isLoaded ? 'var(--bg-secondary)' : '#fff',
                color: loading || !isLoaded ? 'var(--text-secondary)' : '#1f1f1f',
                border: '2px solid var(--border-light)',
                borderRadius: '12px',
                cursor: (loading || !isLoaded) ? 'not-allowed' : 'pointer',
                opacity: (loading || !isLoaded) ? 0.6 : 1,
                boxShadow: (loading || !isLoaded) 
                  ? 'none' 
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                if (!loading && isLoaded) {
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
                  e.target.style.transform = 'scale(0.98)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && isLoaded) {
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
                  e.target.style.transform = 'scale(1)'
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px',
              marginTop: '8px'
            }}>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: 'var(--border-light)'
              }} />
              <span style={{
                padding: '0 16px',
                fontSize: '14px',
                color: 'var(--text-tertiary)'
              }}>
                or
              </span>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: 'var(--border-light)'
              }} />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 600,
                backgroundColor: (loading || !email || !password) 
                  ? 'var(--bg-secondary)' 
                  : `rgba(${themeColorRgb}, 0.7)`,
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: (loading || !email || !password) ? 'not-allowed' : 'pointer',
                opacity: (loading || !email || !password) ? 0.6 : 1,
                boxShadow: (loading || !email || !password) 
                  ? 'none' 
                  : `0 4px 15px rgba(${themeColorRgb}, 0.3)`,
                transition: 'all 0.3s ease',
                marginBottom: '16px'
              }}
              onMouseEnter={(e) => {
                if (!loading && email && password) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.85)`
                  e.target.style.transform = 'scale(0.98)'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && email && password) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.transform = 'scale(1)'
                }
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account with Email'}
            </button>

            {error && (
              <div style={{
                padding: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div style={{
              textAlign: 'center',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-light)'
            }}>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '8px'
              }}>
                Already have an account?
              </p>
              <a
                href="/master-login"
                style={{
                  color: `rgba(${themeColorRgb}, 1)`,
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.textDecoration = 'underline'
                }}
                onMouseLeave={(e) => {
                  e.target.style.textDecoration = 'none'
                }}
              >
                Sign In
              </a>
              <p style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '12px'
              }}>
                Or continue with <a href="/onboarding" style={{ color: `rgba(${themeColorRgb}, 1)`, textDecoration: 'none' }}>onboarding setup</a>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default SignUpPage
