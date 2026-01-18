import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import OnboardingHeader from './OnboardingHeader'

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' }
]

const BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail Store' },
  { value: 'restaurant', label: 'Restaurant/Cafe' },
  { value: 'grocery', label: 'Grocery Store' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'convenience', label: 'Convenience Store' },
  { value: 'other', label: 'Other' }
]

function OnboardingStep1({ onNext, storeInfo, setStoreInfo, direction = 'forward' }) {
  const { themeColor } = useTheme()
  const [formData, setFormData] = useState({
    store_name: storeInfo?.store_name || '',
    store_address: storeInfo?.store_address || '',
    store_city: storeInfo?.store_city || '',
    store_state: storeInfo?.store_state || '',
    store_zip: storeInfo?.store_zip || '',
    store_phone: storeInfo?.store_phone || '',
    store_email: storeInfo?.store_email || '',
    store_website: storeInfo?.store_website || '',
    business_type: storeInfo?.business_type || 'retail'
  })
  
  const [errors, setErrors] = useState({})
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false)
  const [businessTypeDropdownOpen, setBusinessTypeDropdownOpen] = useState(false)
  const addressInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const stateDropdownRef = useRef(null)
  const businessTypeDropdownRef = useRef(null)
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const validate = () => {
    const newErrors = {}
    
    if (!formData.store_name.trim()) {
      newErrors.store_name = 'Store name is required'
    }
    
    if (!formData.store_email.trim()) {
      newErrors.store_email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.store_email)) {
      newErrors.store_email = 'Please enter a valid email'
    }
    
    if (!formData.store_phone.trim()) {
      newErrors.store_phone = 'Phone number is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleNext = () => {
    if (validate()) {
      setStoreInfo(formData)
      // Pass storeInfo directly to onNext so it can be saved immediately
      onNext(formData)
    }
  }
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }
  
  // Initialize Google Maps Places Autocomplete
  useEffect(() => {
    // Load Google Maps script if not already loaded
    const loadGoogleMapsScript = () => {
      return new Promise((resolve, reject) => {
        if (window.google && window.google.maps && window.google.maps.places) {
          resolve()
          return
        }
        
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
        if (existingScript) {
          existingScript.addEventListener('load', resolve)
          return
        }
        
        // Load Google Maps API key from environment variable
        // Set REACT_APP_GOOGLE_MAPS_API_KEY in your .env file or environment
        const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''
        
        if (!API_KEY) {
          console.warn('Google Maps API key not found. Address autocomplete will not work.')
          console.warn('Set REACT_APP_GOOGLE_MAPS_API_KEY environment variable to enable autocomplete.')
          return
        }
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`
        script.async = true
        script.defer = true
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }
    
    const initAutocomplete = () => {
      if (!addressInputRef.current) return
      
      loadGoogleMapsScript()
        .then(() => {
          if (window.google && window.google.maps && window.google.maps.places) {
            const autocomplete = new window.google.maps.places.Autocomplete(
              addressInputRef.current,
              {
                types: ['address'],
                componentRestrictions: { country: 'us' } // Restrict to US addresses
              }
            )
            
            autocompleteRef.current = autocomplete
            
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace()
              
              if (place.geometry) {
                // Extract address components
                let streetNumber = ''
                let route = ''
                let city = ''
                let state = ''
                let zipCode = ''
                
                place.address_components.forEach(component => {
                  const types = component.types
                  
                  if (types.includes('street_number')) {
                    streetNumber = component.long_name
                  }
                  if (types.includes('route')) {
                    route = component.long_name
                  }
                  if (types.includes('locality')) {
                    city = component.long_name
                  }
                  if (types.includes('administrative_area_level_1')) {
                    state = component.short_name
                  }
                  if (types.includes('postal_code')) {
                    zipCode = component.long_name
                  }
                })
                
                // Update form data
                const fullAddress = `${streetNumber} ${route}`.trim()
                setFormData(prev => ({
                  ...prev,
                  store_address: fullAddress || place.formatted_address || prev.store_address,
                  store_city: city || prev.store_city,
                  store_state: state || prev.store_state,
                  store_zip: zipCode || prev.store_zip
                }))
              }
            })
          }
        })
        .catch(err => {
          console.error('Error loading Google Maps:', err)
        })
    }
    
    initAutocomplete()
    
    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current)
      }
    }
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target)) {
        setStateDropdownOpen(false)
      }
      if (businessTypeDropdownRef.current && !businessTypeDropdownRef.current.contains(event.target)) {
        setBusinessTypeDropdownOpen(false)
      }
    }

    if (stateDropdownOpen || businessTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [stateDropdownOpen, businessTypeDropdownOpen])

  const handleStateSelect = (value) => {
    handleChange('store_state', value)
    setStateDropdownOpen(false)
  }

  const handleBusinessTypeSelect = (value) => {
    handleChange('business_type', value)
    setBusinessTypeDropdownOpen(false)
  }

  const selectedStateLabel = formData.store_state 
    ? US_STATES.find(s => s.value === formData.store_state)?.label || 'State'
    : 'State'

  const selectedBusinessTypeLabel = formData.business_type
    ? BUSINESS_TYPES.find(bt => bt.value === formData.business_type)?.label || 'Business Type'
    : 'Business Type'
  
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '40px 20px',
      backgroundColor: 'transparent',
      backdropFilter: 'blur(60px) saturate(200%)',
      WebkitBackdropFilter: 'blur(60px) saturate(200%)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      boxShadow: `0 8px 32px 0 rgba(31, 38, 135, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
    }}>
      <OnboardingHeader step={1} direction={direction} />
      
      <p style={{ 
        marginBottom: '30px',
        color: 'var(--text-secondary, #666)',
        fontSize: '16px',
        lineHeight: '1.6',
        textAlign: 'center'
      }}>
        Tell us about your store. This information will be used for receipts, invoices, and communications.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Store Name */}
        <div>
          <input
            type="text"
            value={formData.store_name}
            onChange={(e) => handleChange('store_name', e.target.value)}
            placeholder="Store Name"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: errors.store_name ? '1px solid #e74c3c' : `1px solid rgba(${themeColorRgb}, 1)`,
              borderRadius: '0',
              fontSize: '16px',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              outline: 'none'
            }}
          />
        </div>
        
        {/* Business Type */}
        <div ref={businessTypeDropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setBusinessTypeDropdownOpen(!businessTypeDropdownOpen)}
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
              borderRadius: '0',
              fontSize: '16px',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              outline: 'none',
              cursor: 'pointer',
              color: formData.business_type ? 'var(--text-primary, #000)' : 'rgba(0, 0, 0, 0.5)',
              lineHeight: '1.5',
              height: '32px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span style={{ 
              color: formData.business_type ? 'var(--text-primary, #000)' : 'rgba(0, 0, 0, 0.5)' 
            }}>{selectedBusinessTypeLabel}</span>
          </div>
          {businessTypeDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              maxHeight: '200px',
              overflowY: 'auto',
              backgroundColor: '#fff',
              border: `1px solid rgba(${themeColorRgb}, 0.3)`,
              borderRadius: '4px',
              boxShadow: `0 4px 12px rgba(0, 0, 0, 0.15)`,
              zIndex: 1000,
              marginTop: '4px'
            }}>
              {BUSINESS_TYPES.map((type) => (
                <div
                  key={type.value}
                  onClick={() => handleBusinessTypeSelect(type.value)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: formData.business_type === type.value ? themeColor : 'var(--text-primary, #000)',
                    backgroundColor: formData.business_type === type.value ? `rgba(${themeColorRgb}, 0.1)` : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (formData.business_type !== type.value) {
                      e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.05)`
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (formData.business_type !== type.value) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  {type.label}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Address */}
        <div>
          <input
            ref={addressInputRef}
            type="text"
            id="store-address-autocomplete"
            value={formData.store_address}
            onChange={(e) => handleChange('store_address', e.target.value)}
            placeholder="Street Address"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
              borderRadius: '0',
              fontSize: '16px',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              outline: 'none'
            }}
            autoComplete="off"
          />
        </div>
        
        {/* City, State, ZIP */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px', alignItems: 'flex-end' }}>
          <div>
            <input
              type="text"
              value={formData.store_city}
              onChange={(e) => handleChange('store_city', e.target.value)}
              placeholder="City"
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                borderRadius: '0',
                fontSize: '16px',
                boxSizing: 'border-box',
                backgroundColor: 'transparent',
                outline: 'none',
                lineHeight: '1.5',
                height: '32px'
              }}
            />
          </div>
          
          <div ref={stateDropdownRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setStateDropdownOpen(!stateDropdownOpen)}
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                borderRadius: '0',
                fontSize: '16px',
                boxSizing: 'border-box',
                backgroundColor: 'transparent',
                outline: 'none',
                cursor: 'pointer',
                color: formData.store_state ? 'var(--text-primary, #000)' : 'rgba(0, 0, 0, 0.5)',
                lineHeight: '1.5',
                height: '32px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <span style={{ 
                color: formData.store_state ? 'var(--text-primary, #000)' : 'rgba(0, 0, 0, 0.5)' 
              }}>{selectedStateLabel}</span>
            </div>
            {stateDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#fff',
                border: `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '4px',
                boxShadow: `0 4px 12px rgba(0, 0, 0, 0.15)`,
                zIndex: 1000,
                marginTop: '4px'
              }}>
                {US_STATES.map((state) => (
                  <div
                    key={state.value}
                    onClick={() => handleStateSelect(state.value)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: formData.store_state === state.value ? themeColor : 'var(--text-primary, #000)',
                      backgroundColor: formData.store_state === state.value ? `rgba(${themeColorRgb}, 0.1)` : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (formData.store_state !== state.value) {
                        e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.05)`
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (formData.store_state !== state.value) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    {state.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <input
              type="text"
              value={formData.store_zip}
              onChange={(e) => handleChange('store_zip', e.target.value.replace(/\D/g, ''))}
              placeholder="ZIP Code"
              maxLength="10"
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                borderRadius: '0',
                fontSize: '16px',
                boxSizing: 'border-box',
                backgroundColor: 'transparent',
                outline: 'none',
                lineHeight: '1.5',
                height: '32px'
              }}
            />
          </div>
        </div>
        
        {/* Phone */}
        <div>
          <input
            type="tel"
            value={formData.store_phone}
            onChange={(e) => handleChange('store_phone', e.target.value)}
            placeholder="Phone Number"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: errors.store_phone ? '1px solid #e74c3c' : `1px solid rgba(${themeColorRgb}, 1)`,
              borderRadius: '0',
              fontSize: '16px',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              outline: 'none'
            }}
          />
        </div>
        
        {/* Email */}
        <div>
          <input
            type="email"
            value={formData.store_email}
            onChange={(e) => handleChange('store_email', e.target.value)}
            placeholder="Email Address"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: errors.store_email ? '1px solid #e74c3c' : `1px solid rgba(${themeColorRgb}, 1)`,
              borderRadius: '0',
              fontSize: '16px',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              outline: 'none'
            }}
          />
        </div>
        
        {/* Website */}
        <div>
          <input
            type="url"
            value={formData.store_website}
            onChange={(e) => handleChange('store_website', e.target.value)}
            placeholder="Website (Optional)"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
              borderRadius: '0',
              fontSize: '16px',
              boxSizing: 'border-box',
              backgroundColor: 'transparent',
              outline: 'none'
            }}
          />
        </div>
      </div>
      
      {/* Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '40px'
      }}>
        <button
          onClick={handleNext}
          style={{
            padding: '12px 24px',
            backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 600,
            boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
            e.currentTarget.style.boxShadow = `0 6px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
            e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default OnboardingStep1
