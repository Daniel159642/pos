import { useState, useEffect, useLayoutEffect, useRef, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { usePermissions } from '../contexts/PermissionContext'
import { useToast } from '../contexts/ToastContext'
import { cachedFetch } from '../services/offlineSync'
import { getApiUrl } from '../utils/backendUrl'
import {
  Settings as SettingsIcon,
  MapPin,
  Monitor,
  Gift,
  ShoppingCart,
  MessageSquare,
  DollarSign,
  ChevronRight,
  ChevronDown,
  PanelLeft,
  CheckCircle,
  XCircle,
  Printer,
  Download,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Trash2,
  X,
  Undo2,
  Redo2,
  ScanBarcode,
  Package,
  MoreVertical,
  RefreshCw,
  Shield,
  Plug,
  Mail,
  Truck
} from 'lucide-react'
import BarcodeScanner from '../components/BarcodeScanner'
import AdminDashboard from '../components/AdminDashboard'
import { FormTitle, FormLabel, FormField, inputBaseStyle, getInputFocusHandlers, compactCancelButtonStyle, compactPrimaryButtonStyle, modalOverlayStyle, modalContentStyle } from '../components/FormStyles'
import Table from '../components/Table'
import '../components/CustomerDisplay.css'
import '../components/CustomerDisplayButtons.css'
import { getDefaultCheckoutUi, mergeCheckoutUiFromApi } from '../utils/checkoutUi'
import { playNewOrderSound, NOTIFICATION_SOUND_OPTIONS } from '../utils/notificationSound'
import { LA_MAISON_RECEIPT_HTML, LA_MAISON_ORDER_HTML, LA_MAISON_ORDER_APP_NOTIFICATION_HTML, LA_MAISON_SCHEDULE_HTML, LA_MAISON_SCHEDULE_APP_NOTIFICATION_HTML, LA_MAISON_CLOCKIN_HTML, LA_MAISON_CLOCKIN_APP_NOTIFICATION_HTML, LA_MAISON_REPORT_HTML, LA_MAISON_REPORT_APP_NOTIFICATION_HTML, LA_MAISON_RESTAURANT_PROMOTION_RECEIPT_HTML } from './laMaisonReceiptTemplate'

function CustomDropdown({ value, onChange, options, placeholder, required, isDarkMode, themeColorRgb, style = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find(opt => (opt.value ?? opt.id) === value)
  const optionValue = (opt) => opt.value ?? opt.id

  return (
    <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: style.padding || '8px 14px',
          border: `1px solid ${isOpen ? `rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? 'var(--border-color, #404040)' : '#ddd')}`,
          borderRadius: '8px',
          fontSize: style.fontSize || '14px',
          ...(style.padding && { padding: style.padding }),
          ...(style.fontSize && { fontSize: style.fontSize }),
          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
          transition: 'all 0.2s ease',
          outline: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflow: 'hidden',
          ...(isOpen && { boxShadow: `0 0 0 3px rgba(${themeColorRgb}, 0.1)` })
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.border = `1px solid rgba(${themeColorRgb}, 0.3)`
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.border = isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'
          }
        }}
      >
        <span style={{
          color: selectedOption ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : (isDarkMode ? 'var(--text-tertiary, #999)' : '#999'),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
          position: 'relative'
        }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          style={{
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
            flexShrink: 0,
            marginLeft: '8px'
          }}
        />
      </div>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 99999,
            maxHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {options.map((option) => {
            const val = optionValue(option)
            return (
              <div
                key={val}
                onClick={() => {
                  onChange({ target: { value: val } })
                  setIsOpen(false)
                }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  backgroundColor: value === val
                    ? `rgba(${themeColorRgb}, 0.2)`
                    : 'transparent',
                  transition: 'background-color 0.15s ease',
                  borderLeft: value === val
                    ? `3px solid rgba(${themeColorRgb}, 0.7)`
                    : '3px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (value !== val) {
                    e.target.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== val) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                {option.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const DEFAULT_RECEIPT_TEMPLATE = {
  receipt_type: 'traditional',
  store_name: 'Store',
  store_tagline: '',
  store_address: '',
  store_city: '',
  store_state: '',
  store_zip: '',
  store_phone: '',
  store_email: '',
  store_website: '',
  footer_message: 'Thank you for your business!',
  return_policy: '',
  show_tax_breakdown: true,
  show_payment_method: true,
  show_signature: false,
  show_tip: true,
  header_alignment: 'center',
  font_family: 'monospace',
  font_size: 12,
  show_item_descriptions: false,
  show_item_skus: true,
  tax_line_display: 'breakdown',
  footer_alignment: 'center',
  receipt_width: 80,
  line_spacing: 1.2,
  bold_item_names: true,
  divider_style: 'dashed',
  template_preset: 'custom',
  store_logo: '',
  store_name_font: 'monospace',
  store_name_bold: true,
  store_name_italic: false,
  store_name_align: 'center',
  store_name_font_size: 14,
  store_address_font: 'monospace',
  store_address_bold: false,
  store_address_italic: false,
  store_address_align: 'center',
  store_address_font_size: 12,
  store_phone_font: 'monospace',
  store_phone_bold: false,
  store_phone_italic: false,
  store_phone_align: 'center',
  store_phone_font_size: 12,
  footer_message_font: 'monospace',
  footer_message_bold: false,
  footer_message_italic: false,
  footer_message_align: 'center',
  footer_message_font_size: 12,
  return_policy_font: 'monospace',
  return_policy_bold: false,
  return_policy_italic: false,
  return_policy_align: 'center',
  return_policy_font_size: 12,
  store_website_font: 'monospace',
  store_website_bold: false,
  store_website_italic: false,
  store_website_align: 'center',
  store_website_font_size: 12,
  store_email_font: 'monospace',
  store_email_bold: false,
  store_email_italic: false,
  store_email_align: 'center',
  store_email_font_size: 12,
  // Body element formatting
  item_name_font: 'monospace',
  item_name_bold: true,
  item_name_italic: false,
  item_name_align: 'left',
  item_name_font_size: 12,
  item_desc_font: 'monospace',
  item_desc_bold: false,
  item_desc_italic: true,
  item_desc_align: 'left',
  item_desc_font_size: 10,
  item_sku_font: 'monospace',
  item_sku_bold: false,
  item_sku_italic: false,
  item_sku_align: 'left',
  item_sku_font_size: 10,
  item_price_font: 'monospace',
  item_price_bold: false,
  item_price_italic: false,
  item_price_align: 'right',
  item_price_font_size: 12,
  subtotal_font: 'monospace',
  subtotal_bold: false,
  subtotal_italic: false,
  subtotal_align: 'right',
  subtotal_font_size: 12,
  tax_font: 'monospace',
  tax_bold: false,
  tax_italic: false,
  tax_align: 'right',
  tax_font_size: 12,
  tip_font: 'monospace',
  tip_bold: false,
  tip_italic: false,
  tip_align: 'right',
  tip_font_size: 12,
  total_font: 'monospace',
  total_bold: true,
  total_italic: false,
  total_align: 'right',
  total_font_size: 14,
  payment_method_font: 'monospace',
  payment_method_bold: false,
  payment_method_italic: false,
  payment_method_align: 'center',
  payment_method_font_size: 11,
  date_line_font: 'monospace',
  date_line_bold: false,
  date_line_italic: false,
  date_line_align: 'center',
  date_line_font_size: 10,
  date_display_mode: 'both', // 'both' | 'date_only' | 'time_only'
  show_barcode: true,
  show_order_number_below_barcode: true,
  barcode_number_font: 'monospace',
  barcode_number_font_size: 10,
  barcode_number_bold: false,
  barcode_number_italic: false,
  barcode_number_align: 'center',
  // Signature
  show_signature_title: true,
  signature_title_font: 'monospace',
  signature_title_bold: false,
  signature_title_italic: false,
  signature_title_align: 'left',
  signature_title_font_size: 10,
  // Customer & Order section (pickup/delivery) - per-line styling
  customer_order_font: 'monospace',
  customer_order_font_size: 12,
  customer_order_bold: false,
  customer_order_italic: false,
  customer_order_align: 'left',
  preview_customer_order: true,
  order_type_font: 'monospace',
  order_type_font_size: 12,
  order_type_bold: false,
  order_type_italic: false,
  order_type_align: 'left',
  customer_name_font: 'monospace',
  customer_name_font_size: 12,
  customer_name_bold: false,
  customer_name_italic: false,
  customer_name_align: 'left',
  customer_phone_font: 'monospace',
  customer_phone_font_size: 12,
  customer_phone_bold: false,
  customer_phone_italic: false,
  customer_phone_align: 'left',
  customer_address_font: 'monospace',
  customer_address_font_size: 12,
  customer_address_bold: false,
  customer_address_italic: false,
  customer_address_align: 'left',
  // Payment preview: card | cash | not_paid_pickup | not_paid_delivery
  preview_payment_type: 'card',
  show_cash_amount_given: true,
  show_cash_change: true,
  cash_amount_given_font: 'monospace',
  cash_amount_given_bold: false,
  cash_amount_given_italic: false,
  cash_amount_given_align: 'center',
  cash_amount_given_font_size: 11,
  cash_change_font: 'monospace',
  cash_change_bold: false,
  cash_change_italic: false,
  cash_change_align: 'center',
  cash_change_font_size: 11
}

// Preset styles - exercise all template parameters (date, barcode, footer, styling, etc.)
const RECEIPT_PRESETS = {
  modern: {
    ...DEFAULT_RECEIPT_TEMPLATE,
    font_family: 'monospace',
    font_size: 11,
    receipt_width: 80,
    line_spacing: 1.3,
    divider_style: 'dashed',
    bold_item_names: true,
    header_alignment: 'center',
    footer_message: 'Thank you for your business!',
    footer_message_font: 'monospace',
    footer_message_font_size: 12,
    footer_message_bold: false,
    footer_message_align: 'center',
    return_policy: 'Returns within 30 days with receipt',
    return_policy_font: 'monospace',
    return_policy_font_size: 10,
    return_policy_align: 'center',
    store_website: 'https://example.com',
    store_website_font: 'monospace',
    store_website_font_size: 10,
    store_website_align: 'center',
    store_email: 'hello@example.com',
    store_email_font: 'monospace',
    store_email_font_size: 10,
    store_email_align: 'center',
    show_signature: true,
    date_display_mode: 'both',
    show_barcode: true,
    show_order_number_below_barcode: true,
    barcode_number_font: 'monospace',
    barcode_number_font_size: 10,
    barcode_number_align: 'center',
    show_item_descriptions: false,
    show_item_skus: true,
    tax_line_display: 'breakdown',
    preview_payment_type: 'card',
    preview_customer_order: true
  },
  classic: {
    ...DEFAULT_RECEIPT_TEMPLATE,
    font_family: 'Courier New',
    font_size: 12,
    receipt_width: 80,
    line_spacing: 1.2,
    divider_style: 'solid',
    bold_item_names: false,
    header_alignment: 'left',
    footer_message: 'Thank you for your business.',
    footer_message_font: 'Courier New',
    footer_message_font_size: 11,
    footer_message_align: 'left',
    return_policy: '',
    store_website: '',
    store_email: '',
    show_signature: true,
    date_display_mode: 'date_only',
    show_barcode: true,
    show_order_number_below_barcode: false,
    show_item_descriptions: false,
    show_item_skus: true,
    tax_line_display: 'single_line',
    preview_payment_type: 'cash',
    preview_customer_order: true
  },
  minimal: {
    ...DEFAULT_RECEIPT_TEMPLATE,
    font_family: 'monospace',
    font_size: 10,
    receipt_width: 58,
    line_spacing: 1.1,
    divider_style: 'none',
    bold_item_names: false,
    header_alignment: 'center',
    footer_message: 'Thanks!',
    footer_message_font: 'monospace',
    footer_message_font_size: 9,
    footer_message_align: 'center',
    return_policy: '',
    store_website: '',
    store_email: '',
    show_signature: false,
    date_display_mode: 'time_only',
    show_barcode: false,
    show_item_descriptions: false,
    show_item_skus: false,
    tax_line_display: 'single_line',
    preview_payment_type: 'card',
    preview_customer_order: false
  }
}

const SAMPLE_LINE_ITEMS = [
  { name: 'Organic Coffee Beans', sku: 'SKU-001', price: 12.99, qty: 2, desc: 'Medium roast' },
  { name: 'Almond Milk', sku: 'SKU-002', price: 4.49, qty: 1 },
  { name: 'Croissant', sku: 'SKU-003', price: 3.50, qty: 3, desc: 'Butter' }
]

// Code 128 Barcode Generator
const CODE128_PATTERNS = {
  '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10010011000',
  '4': '10010001100', '5': '10001001100', '6': '10011001000', '7': '10011000100',
  '8': '10001100100', '9': '11001001000', 'A': '11001000100', 'B': '11000100100',
  'C': '10110011100', 'D': '10011011100', 'E': '10011001110', 'F': '10111001100',
  'G': '10011101100', 'H': '10011100110', 'I': '11001110010', 'J': '11001011100',
  'K': '11001001110', 'L': '11011100100', 'M': '11001110100', 'N': '11101101110',
  'O': '11101001100', 'P': '11100101100', 'Q': '11100100110', 'R': '11101100100',
  'S': '11100110100', 'T': '11100110010', 'U': '11011011000', 'V': '11011000110',
  'W': '11000110110', 'X': '10100011000', 'Y': '10001011000', 'Z': '10001000110',
  '-': '10110001000', '.': '10001101000', ' ': '10001100010', '$': '11010001000',
  '/': '11000101000', '+': '11000100010', '%': '10110111000', '*': '11010111000',
  'START': '11010000100', 'STOP': '1100011101011'
}

function generateBarcodeSVG(text, width = 180, height = 40, showNumberInSvg = true) {
  const orderNum = String(text).toUpperCase()
  let pattern = CODE128_PATTERNS['START']
  for (const char of orderNum) {
    pattern += CODE128_PATTERNS[char] || CODE128_PATTERNS['0']
  }
  pattern += CODE128_PATTERNS['STOP']
  const barWidth = width / pattern.length
  let bars = []
  let x = 0
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      bars.push(`<rect x="${x.toFixed(2)}" y="0" width="${Math.max(barWidth, 1).toFixed(2)}" height="${height}" fill="#000"/>`)
    }
    x += barWidth
  }
  const svgHeight = showNumberInSvg ? height + 14 : height
  const textEl = showNumberInSvg ? `<text x="${width / 2}" y="${height + 11}" text-anchor="middle" font-family="monospace" font-size="10" fill="#000">${orderNum}</text>` : ''
  return `<svg width="${width}" height="${svgHeight}" viewBox="0 0 ${width} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>
    ${bars.join('')}
    ${textEl}
  </svg>`
}

function TextFormattingToolbar({
  font, onFontChange,
  fontSize, onFontSizeChange,
  bold, onBoldToggle,
  italic, onItalicToggle,
  align, onAlignChange,
  isDarkMode,
  themeColorRgb
}) {
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef(null)
  const fontOptions = [
    { value: 'system-ui', label: 'System' },
    { value: 'monospace', label: 'Monospace' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Consolas', label: 'Consolas' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times New Roman', label: 'Times New Roman' }
  ]
  const selectedFont = fontOptions.find(f => f.value === (font || 'system-ui')) || fontOptions[0]

  useEffect(() => {
    if (fontDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [fontDropdownOpen])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fontDropdownOpen && buttonRef.current && !buttonRef.current.contains(event.target)) {
        // Check if click is on dropdown menu
        const dropdown = document.getElementById('font-dropdown-menu')
        if (dropdown && !dropdown.contains(event.target)) {
          setFontDropdownOpen(false)
        }
      }
    }
    if (fontDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [fontDropdownOpen])

  return (
    <div style={{
      position: 'relative',
      marginTop: '6px',
      overflow: 'visible'
    }}>
      <style>{`
        .text-toolbar-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        className="text-toolbar-scroll"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          overflowX: 'auto',
          overflowY: 'visible',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          padding: '0',
          position: 'relative'
        }}
        onScroll={(e) => {
          const el = e.target
          const gradient = el.parentElement?.querySelector('.toolbar-gradient-fade')
          if (gradient) {
            const isAtEnd = el.scrollWidth - el.scrollLeft <= el.clientWidth + 5
            gradient.style.opacity = isAtEnd ? '0' : '1'
          }
        }}
      >
        {/* Font dropdown - rebuilt */}
        <div style={{ position: 'relative', flexShrink: 0, maxWidth: '120px', minWidth: '80px' }}>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: '11px',
              border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
              borderRadius: '4px',
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              textAlign: 'left'
            }}>
              {selectedFont.label}
            </span>
            <ChevronDown
              size={12}
              style={{
                transition: 'transform 0.2s ease',
                transform: fontDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                flexShrink: 0
              }}
            />
          </button>
          {fontDropdownOpen && createPortal(
            <div
              id="font-dropdown-menu"
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '6px',
                boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 999999,
                maxHeight: '180px',
                overflowY: 'auto',
                overflowX: 'hidden'
              }}
            >
              {fontOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    onFontChange({ target: { value: option.value } })
                    setFontDropdownOpen(false)
                  }}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    backgroundColor: font === option.value
                      ? `rgba(${themeColorRgb}, 0.2)`
                      : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (font !== option.value) {
                      e.target.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (font !== option.value) {
                      e.target.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  {option.label}
                </div>
              ))}
            </div>,
            document.body
          )}
        </div>

        {/* Font size */}
        <input
          type="number"
          min={8}
          max={24}
          value={fontSize ?? 12}
          onChange={onFontSizeChange}
          style={{
            width: '40px',
            height: '23px',
            padding: '2px 4px',
            border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
            borderRadius: '4px',
            fontSize: '11px',
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            textAlign: 'center',
            flexShrink: 0,
            boxSizing: 'border-box'
          }}
        />

        {/* Divider */}
        <div style={{ width: '1px', height: '16px', backgroundColor: isDarkMode ? 'var(--border-color, #404040)' : '#ddd', margin: '0 2px', flexShrink: 0 }} />

        {/* Bold button */}
        <button
          type="button"
          onClick={onBoldToggle}
          style={{
            padding: '4px 6px',
            border: `1px solid ${bold ? `rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? 'var(--border-color, #404040)' : '#ddd')}`,
            borderRadius: '4px',
            backgroundColor: bold ? `rgba(${themeColorRgb}, 0.15)` : 'transparent',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          title="Bold"
        >
          <Bold size={14} style={{ fontWeight: bold ? 700 : 400 }} />
        </button>

        {/* Italic button */}
        <button
          type="button"
          onClick={onItalicToggle}
          style={{
            padding: '4px 6px',
            border: `1px solid ${italic ? `rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? 'var(--border-color, #404040)' : '#ddd')}`,
            borderRadius: '4px',
            backgroundColor: italic ? `rgba(${themeColorRgb}, 0.15)` : 'transparent',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          title="Italic"
        >
          <Italic size={14} style={{ fontStyle: italic ? 'italic' : 'normal' }} />
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '16px', backgroundColor: isDarkMode ? 'var(--border-color, #404040)' : '#ddd', margin: '0 2px', flexShrink: 0 }} />

        {/* Alignment buttons */}
        <button
          type="button"
          onClick={() => onAlignChange('left')}
          style={{
            padding: '4px 6px',
            border: `1px solid ${align === 'left' ? `rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? 'var(--border-color, #404040)' : '#ddd')}`,
            borderRadius: '4px',
            backgroundColor: align === 'left' ? `rgba(${themeColorRgb}, 0.15)` : 'transparent',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          title="Align Left"
        >
          <AlignLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => onAlignChange('center')}
          style={{
            padding: '4px 6px',
            border: `1px solid ${align === 'center' ? `rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? 'var(--border-color, #404040)' : '#ddd')}`,
            borderRadius: '4px',
            backgroundColor: align === 'center' ? `rgba(${themeColorRgb}, 0.15)` : 'transparent',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          title="Align Center"
        >
          <AlignCenter size={14} />
        </button>
        <button
          type="button"
          onClick={() => onAlignChange('right')}
          style={{
            padding: '4px 6px',
            border: `1px solid ${align === 'right' ? `rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? 'var(--border-color, #404040)' : '#ddd')}`,
            borderRadius: '4px',
            backgroundColor: align === 'right' ? `rgba(${themeColorRgb}, 0.15)` : 'transparent',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          title="Align Right"
        >
          <AlignRight size={14} />
        </button>
      </div>
      {/* Gradient fade overlay */}
      <div
        className="toolbar-gradient-fade"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '30px',
          height: '100%',
          background: `linear-gradient(to right, transparent, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'})`,
          pointerEvents: 'none',
          zIndex: 1,
          transition: 'opacity 0.2s ease'
        }}
      />
    </div>
  )
}

function ReceiptPreview({ settings, id = 'receipt-preview-print', onSectionClick, activeSection, isDarkMode, themeColorRgb }) {
  const fontMap = { monospace: 'monospace', 'Courier New': '"Courier New", monospace', Consolas: 'Consolas, monospace' }
  const font = fontMap[settings.font_family] || 'monospace'
  const width = settings.receipt_width === 58 ? 58 : 80
  const fs = Number(settings.font_size) || 12
  const ls = Number(settings.line_spacing) || 1.2
  const sub = SAMPLE_LINE_ITEMS.reduce((s, i) => s + i.price * i.qty, 0)
  const tax = sub * 0.08
  const total = sub + tax
  const textAlign = (a) => ({ left: 'left', center: 'center', right: 'right' }[a] || 'center')
  const divider = settings.divider_style === 'solid' ? '1px solid #000' : settings.divider_style === 'dashed' ? '1px dashed #000' : 'none'
  const showTax = settings.tax_line_display !== 'none'
  const highlightColor = `rgba(${themeColorRgb}, 0.2)`

  const sectionStyle = (section) => ({
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    padding: '4px',
    margin: '-4px',
    borderRadius: '4px',
    backgroundColor: activeSection === section ? highlightColor : 'transparent',
    border: activeSection === section ? `2px solid rgba(${themeColorRgb}, 0.5)` : '2px solid transparent'
  })

  return (
    <div
      id={id}
      style={{
        width: `${width}mm`,
        maxWidth: '100%',
        fontFamily: font,
        fontSize: `${fs}px`,
        lineHeight: ls,
        background: '#fff',
        color: '#000',
        padding: '12px 6px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        borderRadius: '4px',
        border: '1px solid #e0e0e0'
      }}
    >
      <div
        onClick={() => onSectionClick && onSectionClick('header')}
        style={sectionStyle('header')}
      >
        <div style={{ textAlign: textAlign(settings.store_name_align || settings.header_alignment || 'center'), marginBottom: '8px' }}>
          {settings.store_logo && (
            typeof settings.store_logo === 'string' && settings.store_logo.startsWith('data:')
              ? <img src={settings.store_logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '40px', marginBottom: '4px', display: 'inline-block' }} />
              : <div style={{ marginBottom: '4px', fontSize: '10px' }}>[Logo]</div>
          )}
          <div style={{
            fontWeight: settings.store_name_bold ? 700 : 400,
            fontStyle: settings.store_name_italic ? 'italic' : 'normal',
            fontSize: `${settings.store_name_font_size || 14}px`,
            fontFamily: settings.store_name_font || 'monospace',
            textAlign: textAlign(settings.store_name_align || settings.header_alignment || 'center')
          }}>{settings.store_name || 'Store'}</div>
          {settings.store_address && <div style={{ whiteSpace: 'pre-wrap', fontSize: `${fs - 1}px` }}>{settings.store_address}</div>}
          {(settings.store_city || settings.store_state || settings.store_zip) && (
            <div style={{ fontSize: `${fs - 1}px` }}>{[settings.store_city, settings.store_state, settings.store_zip].filter(Boolean).join(', ')}</div>
          )}
          {settings.store_phone && <div>{settings.store_phone}</div>}
        </div>
      </div>
      <div style={{ borderTop: divider, margin: '6px 0' }} />
      {/* Customer & Order section (for pickup/delivery) - per-line styling */}
      {(settings.preview_customer_order !== false) && (
        <div
          onClick={() => onSectionClick && onSectionClick('customer_order')}
          style={sectionStyle('customer_order')}
        >
          <div style={{ marginBottom: '6px' }}>
            <div style={{
              fontFamily: settings.order_type_font || settings.customer_order_font || 'monospace',
              fontSize: `${settings.order_type_font_size ?? settings.customer_order_font_size ?? fs}px`,
              fontWeight: (settings.order_type_bold ?? settings.customer_order_bold) ? 700 : 400,
              fontStyle: (settings.order_type_italic ?? settings.customer_order_italic) ? 'italic' : 'normal',
              textAlign: textAlign(settings.order_type_align ?? settings.customer_order_align ?? 'left')
            }}>Order Type: Pickup</div>
            <div style={{
              fontFamily: settings.customer_name_font || settings.customer_order_font || 'monospace',
              fontSize: `${settings.customer_name_font_size ?? settings.customer_order_font_size ?? fs}px`,
              fontWeight: (settings.customer_name_bold ?? settings.customer_order_bold) ? 700 : 400,
              fontStyle: (settings.customer_name_italic ?? settings.customer_order_italic) ? 'italic' : 'normal',
              textAlign: textAlign(settings.customer_name_align ?? settings.customer_order_align ?? 'left')
            }}>Customer: Jane Doe</div>
            <div style={{
              fontFamily: settings.customer_phone_font || settings.customer_order_font || 'monospace',
              fontSize: `${settings.customer_phone_font_size ?? settings.customer_order_font_size ?? fs}px`,
              fontWeight: (settings.customer_phone_bold ?? settings.customer_order_bold) ? 700 : 400,
              fontStyle: (settings.customer_phone_italic ?? settings.customer_order_italic) ? 'italic' : 'normal',
              textAlign: textAlign(settings.customer_phone_align ?? settings.customer_order_align ?? 'left')
            }}>Phone: (555) 123-4567</div>
            <div style={{
              fontFamily: settings.customer_address_font || settings.customer_order_font || 'monospace',
              fontSize: `${settings.customer_address_font_size ?? settings.customer_order_font_size ?? fs}px`,
              fontWeight: (settings.customer_address_bold ?? settings.customer_order_bold) ? 700 : 400,
              fontStyle: (settings.customer_address_italic ?? settings.customer_order_italic) ? 'italic' : 'normal',
              textAlign: textAlign(settings.customer_address_align ?? settings.customer_order_align ?? 'left')
            }}>Address: 123 Main St, City</div>
          </div>
          <div style={{ borderTop: divider, margin: '6px 0' }} />
        </div>
      )}
      {/* Body: 1. Line items (products & prices) */}
      <div
        onClick={() => onSectionClick && onSectionClick('body_items')}
        style={sectionStyle('body_items')}
      >
        <div style={{ marginBottom: '8px' }}>
          {SAMPLE_LINE_ITEMS.map((item, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <div style={{
                fontWeight: settings.item_name_bold ?? settings.bold_item_names ? 700 : 400,
                fontStyle: settings.item_name_italic ? 'italic' : 'normal',
                fontFamily: settings.item_name_font || 'monospace',
                fontSize: `${settings.item_name_font_size || fs}px`,
                textAlign: textAlign(settings.item_name_align || 'left')
              }}>{item.name} {item.qty > 1 ? `x${item.qty}` : ''}</div>
              {(settings.show_item_descriptions && item.desc) && <div style={{
                fontSize: `${settings.item_desc_font_size || fs - 2}px`,
                opacity: 0.9,
                fontWeight: settings.item_desc_bold ? 700 : 400,
                fontStyle: settings.item_desc_italic ? 'italic' : 'normal',
                fontFamily: settings.item_desc_font || 'monospace',
                textAlign: textAlign(settings.item_desc_align || 'left')
              }}>{item.desc}</div>}
              {settings.show_item_skus && <div style={{
                fontSize: `${settings.item_sku_font_size || fs - 2}px`,
                fontWeight: settings.item_sku_bold ? 700 : 400,
                fontStyle: settings.item_sku_italic ? 'italic' : 'normal',
                fontFamily: settings.item_sku_font || 'monospace',
                textAlign: textAlign(settings.item_sku_align || 'left')
              }}>{item.sku}</div>}
              <div style={{
                textAlign: textAlign(settings.item_price_align || 'right'),
                fontWeight: settings.item_price_bold ? 700 : 400,
                fontStyle: settings.item_price_italic ? 'italic' : 'normal',
                fontFamily: settings.item_price_font || 'monospace',
                fontSize: `${settings.item_price_font_size || fs}px`
              }}>${(item.price * item.qty).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: divider, margin: '6px 0' }} />
      {/* Body: 2. Totals & payment */}
      <div
        onClick={() => onSectionClick && onSectionClick('body_totals')}
        style={sectionStyle('body_totals')}
      >
        <div style={{
          textAlign: textAlign(settings.subtotal_align || 'right'),
          marginBottom: '2px',
          fontWeight: settings.subtotal_bold ? 700 : 400,
          fontStyle: settings.subtotal_italic ? 'italic' : 'normal',
          fontFamily: settings.subtotal_font || 'monospace',
          fontSize: `${settings.subtotal_font_size || fs}px`
        }}>Subtotal ${sub.toFixed(2)}</div>
        {showTax && settings.tax_line_display === 'breakdown' && <div style={{
          textAlign: textAlign(settings.tax_align || 'right'),
          marginBottom: '2px',
          fontWeight: settings.tax_bold ? 700 : 400,
          fontStyle: settings.tax_italic ? 'italic' : 'normal',
          fontFamily: settings.tax_font || 'monospace',
          fontSize: `${settings.tax_font_size || fs}px`
        }}>Tax (8%) ${tax.toFixed(2)}</div>}
        {showTax && settings.tax_line_display === 'single_line' && <div style={{
          textAlign: textAlign(settings.tax_align || 'right'),
          marginBottom: '2px',
          fontWeight: settings.tax_bold ? 700 : 400,
          fontStyle: settings.tax_italic ? 'italic' : 'normal',
          fontFamily: settings.tax_font || 'monospace',
          fontSize: `${settings.tax_font_size || fs}px`
        }}>Tax ${tax.toFixed(2)}</div>}
        {settings.show_tip !== false && <div style={{
          textAlign: textAlign(settings.tip_align || 'right'),
          marginBottom: '2px',
          fontWeight: settings.tip_bold ? 700 : 400,
          fontStyle: settings.tip_italic ? 'italic' : 'normal',
          fontFamily: settings.tip_font || 'monospace',
          fontSize: `${settings.tip_font_size ?? fs}px`
        }}>Tip $2.00</div>}
        <div style={{
          fontWeight: settings.total_bold ?? true ? 700 : 400,
          textAlign: textAlign(settings.total_align || 'right'),
          marginTop: '4px',
          fontStyle: settings.total_italic ? 'italic' : 'normal',
          fontFamily: settings.total_font || 'monospace',
          fontSize: `${settings.total_font_size || fs + 2}px`
        }}>Total ${total.toFixed(2)}</div>
        {settings.show_payment_method && (
          <>
            <div style={{
              textAlign: textAlign(settings.payment_method_align || 'center'),
              marginTop: '6px',
              fontSize: `${settings.payment_method_font_size || fs - 1}px`,
              fontWeight: settings.payment_method_bold ? 700 : 400,
              fontStyle: settings.payment_method_italic ? 'italic' : 'normal',
              fontFamily: settings.payment_method_font || 'monospace'
            }}>{settings.preview_payment_type === 'not_paid_pickup' ? 'Not paid - Pay at pickup' : settings.preview_payment_type === 'not_paid_delivery' ? 'Not paid - Pay at delivery' : settings.preview_payment_type === 'cash' ? 'Paid with Cash' : settings.preview_payment_type === 'store_credit' ? 'Paid with Store Credit' : settings.preview_payment_type === 'check' ? 'Paid by Check' : settings.preview_payment_type === 'mobile' ? 'Paid by Mobile' : 'Paid by Card'}</div>
            {settings.preview_payment_type === 'cash' && settings.show_cash_amount_given && (
              <div style={{
                textAlign: textAlign(settings.cash_amount_given_align || 'center'),
                marginTop: '2px',
                fontSize: `${settings.cash_amount_given_font_size || fs - 1}px`,
                fontWeight: settings.cash_amount_given_bold ? 700 : 400,
                fontStyle: settings.cash_amount_given_italic ? 'italic' : 'normal',
                fontFamily: settings.cash_amount_given_font || 'monospace'
              }}>Amount given: $50.00</div>
            )}
            {settings.preview_payment_type === 'cash' && settings.show_cash_change && (
              <div style={{
                textAlign: textAlign(settings.cash_change_align || 'center'),
                marginTop: '2px',
                fontSize: `${settings.cash_change_font_size || fs - 1}px`,
                fontWeight: settings.cash_change_bold ? 700 : 400,
                fontStyle: settings.cash_change_italic ? 'italic' : 'normal',
                fontFamily: settings.cash_change_font || 'monospace'
              }}>Change: $12.34</div>
            )}
          </>
        )}
      </div>
      <div style={{ borderTop: divider, margin: '8px 0' }} />
      {/* Body: 3. Date & barcode */}
      <div
        onClick={() => onSectionClick && onSectionClick('body_barcode')}
        style={sectionStyle('body_barcode')}
      >
        {(() => {
          const mode = settings.date_display_mode || 'both'
          const d = new Date()
          let dateTimeText = ''
          if (mode === 'date_only') dateTimeText = d.toLocaleDateString()
          else if (mode === 'time_only') dateTimeText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          else dateTimeText = d.toLocaleString()
          if (dateTimeText) {
            return (
              <div style={{
                fontSize: `${settings.date_line_font_size || fs - 2}px`,
                textAlign: textAlign(settings.date_line_align || 'center'),
                fontWeight: settings.date_line_bold ? 700 : 400,
                fontStyle: settings.date_line_italic ? 'italic' : 'normal',
                fontFamily: settings.date_line_font || 'monospace'
              }}>{dateTimeText}</div>
            )
          }
          return null
        })()}
        {settings.show_barcode !== false && (
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <div
              style={{ display: 'inline-block' }}
              dangerouslySetInnerHTML={{ __html: generateBarcodeSVG('ORD-10042', 160, 35, false) }}
            />
            {settings.show_order_number_below_barcode !== false && (
              <div style={{
                marginTop: '4px',
                fontSize: `${settings.barcode_number_font_size || fs - 2}px`,
                fontWeight: settings.barcode_number_bold ? 700 : 400,
                fontStyle: settings.barcode_number_italic ? 'italic' : 'normal',
                fontFamily: settings.barcode_number_font || 'monospace',
                textAlign: textAlign(settings.barcode_number_align || 'center')
              }}>ORD-10042</div>
            )}
          </div>
        )}
      </div>
      <div style={{ borderTop: divider, margin: '8px 0' }} />
      <div
        onClick={() => onSectionClick && onSectionClick('footer')}
        style={sectionStyle('footer')}
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {settings.footer_message && (
            <div style={{
              marginBottom: '4px',
              fontSize: `${settings.footer_message_font_size || fs - 1}px`,
              fontWeight: settings.footer_message_bold ? 700 : 400,
              fontStyle: settings.footer_message_italic ? 'italic' : 'normal',
              fontFamily: settings.footer_message_font || 'monospace',
              textAlign: textAlign(settings.footer_message_align || 'center')
            }}>{settings.footer_message}</div>
          )}
          {settings.return_policy && (
            <div style={{
              marginBottom: '4px',
              fontSize: `${settings.return_policy_font_size || fs - 1}px`,
              fontWeight: settings.return_policy_bold ? 700 : 400,
              fontStyle: settings.return_policy_italic ? 'italic' : 'normal',
              fontFamily: settings.return_policy_font || 'monospace',
              textAlign: textAlign(settings.return_policy_align || 'center')
            }}>{settings.return_policy}</div>
          )}
          {settings.store_website && (
            <div style={{
              marginBottom: '4px',
              fontSize: `${settings.store_website_font_size || fs - 1}px`,
              fontWeight: settings.store_website_bold ? 700 : 400,
              fontStyle: settings.store_website_italic ? 'italic' : 'normal',
              fontFamily: settings.store_website_font || 'monospace',
              textAlign: textAlign(settings.store_website_align || 'center')
            }}>{settings.store_website}</div>
          )}
          {settings.store_email && (
            <div style={{
              marginBottom: '4px',
              fontSize: `${settings.store_email_font_size || fs - 1}px`,
              fontWeight: settings.store_email_bold ? 700 : 400,
              fontStyle: settings.store_email_italic ? 'italic' : 'normal',
              fontFamily: settings.store_email_font || 'monospace',
              textAlign: textAlign(settings.store_email_align || 'center')
            }}>{settings.store_email}</div>
          )}
        </div>
        {settings.show_signature && (
          <div style={{ marginTop: '12px', paddingTop: '8px' }}>
            {settings.show_signature_title !== false && (
              <div style={{
                fontSize: `${settings.signature_title_font_size || fs - 2}px`,
                marginBottom: '4px',
                fontWeight: settings.signature_title_bold ? 700 : 400,
                fontStyle: settings.signature_title_italic ? 'italic' : 'normal',
                fontFamily: settings.signature_title_font || 'monospace',
                textAlign: textAlign(settings.signature_title_align || 'left')
              }}>Signature:</div>
            )}
            <div style={{
              borderBottom: divider === 'none' ? '1px solid #000' : divider,
              height: '30px',
              position: 'relative'
            }}>
              <svg width="100" height="28" style={{ position: 'absolute', bottom: '2px', left: '10px' }} viewBox="0 0 100 28">
                <path
                  d="M5 20 Q10 5 20 15 T35 12 Q45 8 50 18 T65 14 Q75 10 85 16 L95 14"
                  stroke="#333"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  style={{ opacity: 0.7 }}
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SETTINGS_TAB_IDS = ['location', 'pos', 'cash', 'notifications', 'rewards', 'integration', 'admin']

const NO_PERMISSION_MSG = "You don't have permission"
const EMPLOYEE_ALLOWED_SETTINGS_TABS = ['cash', 'location'] // Employee can only open Cash Register and Store Information (location read-only)

const NOTIFICATION_OPTIONS = [
  { id: 'recent_new_order', label: 'New order (integrations)', description: 'Popup when a new DoorDash, Uber Eats, or Shopify order arrives.', toastType: 'success', sampleMessage: 'Order #1234 from DoorDash' }
]

const NOTIFICATION_SECTIONS = [
  { id: 'orders', title: 'Orders' }
]

const NOTIFICATION_OPTIONS_BY_SECTION = {
  orders: ['recent_new_order']
}

const NOTIFICATION_OPTIONS_MAP = NOTIFICATION_OPTIONS.reduce((acc, opt) => ({ ...acc, [opt.id]: opt }), {})

const NEW_ORDER_TOAST_OPTIONS_KEY = 'pos_new_order_toast_options'
const DEFAULT_NEW_ORDER_TOAST_OPTIONS = {
  play_sound: true,
  sound_type: 'default', // 'default' | 'chime' | 'alert' | 'soft' | 'none'
  volume: 0.5, // 0-1
  sound_until_dismiss: false, // repeat sound until user dismisses
  auto_dismiss_sec: 0, // 0 = only when clicked, 4 = auto after 4 sec
  click_action: 'go_to_order' // 'go_to_order' | 'print_receipt' | 'dismiss_only'
}

function SquareMigrationCard({ isDarkMode, themeColorRgb, showToast, compactPrimaryButtonStyle, inputBaseStyle, getInputFocusHandlers, FormField, FormLabel, searchParams }) {
  const [squareStatus, setSquareStatus] = useState({ connected: false, merchant_id: null, merchant_name: null, oauth_configured: false })
  const [squareAccessToken, setSquareAccessToken] = useState('')
  const [squareSandbox, setSquareSandbox] = useState(false)
  const [showManualToken, setShowManualToken] = useState(false)
  const [migrateOptions, setMigrateOptions] = useState({
    inventory: true,
    employees: true,
    order_history: true,
    payments: true,
    transactions: true,
    statistics: true
  })
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [migrateLoading, setMigrateLoading] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [migrateResult, setMigrateResult] = useState(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  const loadSquareStatus = async () => {
    try {
      const res = await fetch('/api/migrations/square/status')
      const data = await res.json()
      setSquareStatus({
        connected: !!data.connected,
        merchant_id: data.merchant_id || null,
        merchant_name: data.merchant_name || null,
        oauth_configured: !!data.oauth_configured
      })
    } catch (_) {
      setSquareStatus(prev => ({ ...prev, oauth_configured: false }))
    }
  }

  useEffect(() => {
    loadSquareStatus()
  }, [])

  useEffect(() => {
    const square = searchParams?.get('square')
    const msg = searchParams?.get('msg')
    if (square === 'connected') {
      showToast('Square connected successfully', 'success')
      loadSquareStatus()
    } else if (square === 'error' && msg) {
      showToast(decodeURIComponent(msg), 'error')
    }
  }, [searchParams])

  const toggleOption = (key) => {
    setMigrateOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const connectWithSquare = async () => {
    setConnectLoading(true)
    try {
      const res = await fetch('/api/migrations/square/oauth/url?sandbox=' + squareSandbox)
      const data = await res.json()
      if (data.success && data.url) {
        window.location.href = data.url
        return
      }
      showToast(data.message || 'Could not get Square login URL', 'error')
    } catch (e) {
      showToast(e.message || 'Network error', 'error')
    } finally {
      setConnectLoading(false)
    }
  }

  const disconnectSquare = async () => {
    setDisconnectLoading(true)
    try {
      const res = await fetch('/api/migrations/square/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (data.success) {
        showToast('Square disconnected', 'success')
        setSquareStatus(prev => ({ ...prev, connected: false, merchant_id: null, merchant_name: null }))
      } else {
        showToast(data.message || 'Disconnect failed', 'error')
      }
    } catch (e) {
      showToast(e.message || 'Network error', 'error')
    } finally {
      setDisconnectLoading(false)
    }
  }

  const verifySquare = async () => {
    if (!squareAccessToken.trim()) {
      showToast('Enter your Square access token', 'error')
      return
    }
    setVerifyLoading(true)
    setVerifyStatus(null)
    try {
      const res = await fetch('/api/migrations/square/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: squareAccessToken.trim(), sandbox: squareSandbox })
      })
      const data = await res.json()
      if (data.success) {
        setVerifyStatus({ success: true, message: data.message || 'Connected successfully' })
        showToast(data.message || 'Square connected', 'success')
      } else {
        setVerifyStatus({ success: false, message: data.message || 'Connection failed' })
        showToast(data.message || 'Verification failed', 'error')
      }
    } catch (e) {
      const msg = e.message || 'Network error'
      setVerifyStatus({ success: false, message: msg })
      showToast(msg, 'error')
    } finally {
      setVerifyLoading(false)
    }
  }

  const runMigration = async () => {
    const hasToken = squareStatus.connected || squareAccessToken.trim()
    if (!hasToken) {
      showToast('Connect with Square first or enter an access token', 'error')
      return
    }
    const any = Object.values(migrateOptions).some(Boolean)
    if (!any) {
      showToast('Select at least one data type to migrate', 'error')
      return
    }
    setMigrateLoading(true)
    setMigrateResult(null)
    try {
      const body = {
        sandbox: squareSandbox,
        migrate: migrateOptions
      }
      if (squareAccessToken.trim()) body.access_token = squareAccessToken.trim()
      const res = await fetch('/api/migrations/square/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        setMigrateResult(data)
        showToast('Migration completed', 'success')
      } else {
        setMigrateResult({ error: data.message })
        showToast(data.message || 'Migration failed', 'error')
      }
    } catch (e) {
      const msg = e.message || 'Network error'
      setMigrateResult({ error: msg })
      showToast(msg, 'error')
    } finally {
      setMigrateLoading(false)
    }
  }

  const runFileImport = async () => {
    if (!uploadFile) {
      showToast('Select a CSV or Excel file first', 'error')
      return
    }
    setUploadLoading(true)
    setUploadResult(null)
    try {
      const form = new FormData()
      form.append('items_file', uploadFile)
      const res = await fetch('/api/migrations/square/upload', { method: 'POST', body: form })
      const data = await res.json()
      setUploadResult(data)
      if (data.success) {
        showToast(data.message || `Imported ${data.imported ?? 0} items`, 'success')
        setUploadFile(null)
      } else {
        showToast(data.message || 'Import failed', 'error')
      }
    } catch (e) {
      showToast(e.message || 'Upload failed', 'error')
      setUploadResult({ success: false, message: e.message })
    } finally {
      setUploadLoading(false)
    }
  }

  const integrationInputGlassStyle = {
    background: isDarkMode ? 'rgba(50, 50, 50, 0.35)' : 'rgba(255, 255, 255, 0.35)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.14)',
    boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255, 255, 255, 0.04)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.4)'
  }
  const squareInputRgb = '0, 106, 255'
  const canRunMigration = squareStatus.connected || squareAccessToken.trim()

  return (
    <div className="integration-card-glass integration-card-square-bg" style={{ padding: '20px', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontWeight: 600, fontSize: '16px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
        <img src="/square.svg" alt="" style={{ height: '24px', width: 'auto', maxWidth: '72px', objectFit: 'contain' }} />
        Square
      </div>
      <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '16px' }}>
        Migrate data from Square: connect your Square account (one click) or import from a Square export file. We recommend importing inventory first, then employees, then orders and payments.
      </p>

      {/* Connect with Square (OAuth) */}
      {squareStatus.oauth_configured && (
        <div style={{ marginBottom: '16px' }}>
          {squareStatus.connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', color: isDarkMode ? '#86efac' : '#166534' }}>
                Connected as {squareStatus.merchant_name || squareStatus.merchant_id || 'Square'}
              </span>
              <button
                type="button"
                onClick={disconnectSquare}
                disabled={disconnectLoading}
                style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid ' + (isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'), borderRadius: '8px', background: 'transparent', color: isDarkMode ? 'var(--text-primary)' : '#333' }}
              >
                {disconnectLoading ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input type="checkbox" id="square-sandbox" checked={squareSandbox} onChange={(e) => setSquareSandbox(e.target.checked)} />
              <FormLabel isDarkMode={isDarkMode} htmlFor="square-sandbox" style={{ margin: 0 }}>Use Sandbox</FormLabel>
              <button
                type="button"
                onClick={connectWithSquare}
                disabled={connectLoading}
                style={{ ...compactPrimaryButtonStyle(themeColorRgb, connectLoading), padding: '8px 16px' }}
              >
                {connectLoading ? 'Redirecting…' : 'Connect with Square'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual token (optional) */}
      <div style={{ marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setShowManualToken(!showManualToken)}
          style={{ fontSize: '13px', background: 'none', border: 'none', color: isDarkMode ? 'var(--text-secondary)' : '#666', cursor: 'pointer', padding: 0 }}
        >
          {showManualToken ? '− Hide manual token' : '+ Use access token instead'}
        </button>
        {showManualToken && (
          <div style={{ marginTop: '10px' }}>
            <FormField isDarkMode={isDarkMode} label="Access token">
              <input
                type="password"
                value={squareAccessToken}
                onChange={(e) => setSquareAccessToken(e.target.value)}
                placeholder="Square API access token (Developer Dashboard)"
                style={{ ...inputBaseStyle(isDarkMode, squareInputRgb), ...integrationInputGlassStyle, width: '100%' }}
                {...getInputFocusHandlers(squareInputRgb, isDarkMode)}
              />
            </FormField>
            <button type="button" onClick={verifySquare} disabled={verifyLoading || !squareAccessToken.trim()} style={{ ...compactPrimaryButtonStyle(themeColorRgb, verifyLoading), padding: '6px 12px', marginTop: '8px' }}>
              {verifyLoading ? 'Verifying…' : 'Verify token'}
            </button>
            {verifyStatus && <span style={{ marginLeft: '8px', fontSize: '13px', color: verifyStatus.success ? (isDarkMode ? '#86efac' : '#166534') : (isDarkMode ? '#fca5a5' : '#b91c1c') }}>{verifyStatus.message}</span>}
          </div>
        )}
      </div>

      {/* Data to migrate */}
      <FormLabel isDarkMode={isDarkMode} style={{ display: 'block', marginBottom: '10px' }}>Data to migrate (via API)</FormLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {[
          { key: 'inventory', label: 'Inventory' },
          { key: 'employees', label: 'Employees' },
          { key: 'order_history', label: 'Order history' },
          { key: 'payments', label: 'Payments' },
          { key: 'transactions', label: 'Transactions' },
          { key: 'statistics', label: 'Statistics' }
        ].map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>
            <input type="checkbox" checked={!!migrateOptions[key]} onChange={() => toggleOption(key)} />
            {label}
          </label>
        ))}
      </div>
      <button type="button" onClick={runMigration} disabled={migrateLoading || !canRunMigration} style={{ ...compactPrimaryButtonStyle(themeColorRgb, migrateLoading), padding: '10px 20px' }}>
        {migrateLoading ? 'Migrating…' : 'Start migration'}
      </button>
      {migrateResult && !migrateResult.error && (migrateResult.inventory !== undefined || migrateResult.employees !== undefined) && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', fontSize: '14px', color: isDarkMode ? '#86efac' : '#166534' }}>
          Migrated: Inventory {migrateResult.inventory ?? 0} · Employees {migrateResult.employees ?? 0} · Orders {migrateResult.orders ?? 0} · Payments {migrateResult.payments ?? 0}
        </div>
      )}
      {migrateResult?.error && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', fontSize: '14px', color: isDarkMode ? '#fca5a5' : '#b91c1c' }}>{migrateResult.error}</div>
      )}

      {/* Import from file */}
      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)' }}>
        <FormLabel isDarkMode={isDarkMode} style={{ display: 'block', marginBottom: '8px' }}>Or import from Square export file</FormLabel>
        <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '10px' }}>
          Export your Item Library from Square (Items → Actions → Export Library), then upload the CSV or Excel file here.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => { setUploadFile(e.target.files?.[0] || null); setUploadResult(null) }}
            style={{ fontSize: '13px' }}
          />
          <button type="button" onClick={runFileImport} disabled={uploadLoading || !uploadFile} style={{ ...compactPrimaryButtonStyle(themeColorRgb, uploadLoading), padding: '8px 16px' }}>
            {uploadLoading ? 'Importing…' : 'Upload and import'}
          </button>
        </div>
        {uploadResult && (
          <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', fontSize: '13px', backgroundColor: uploadResult.success ? (isDarkMode ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)') : (isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'), color: uploadResult.success ? (isDarkMode ? '#86efac' : '#166534') : (isDarkMode ? '#fca5a5' : '#b91c1c') }}>
            {uploadResult.message}
            {uploadResult.errors?.length > 0 && <div style={{ marginTop: '6px', fontSize: '12px' }}>{uploadResult.errors.slice(0, 5).join('; ')}{uploadResult.errors.length > 5 ? '…' : ''}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { themeMode, themeColor } = useTheme()
  const { hasPermission, employee } = usePermissions()
  const { show: showToast } = useToast()
  const hasAdminAccess = hasPermission('manage_permissions') || hasPermission('add_employee') || employee?.position?.toLowerCase() === 'admin'
  const [receiptSettings, setReceiptSettings] = useState(() => ({ ...DEFAULT_RECEIPT_TEMPLATE }))
  const [activeTab, setActiveTab] = useState('location') // 'location', 'pos', 'cash', 'notifications', 'rewards', or 'admin'

  // Open tab from URL ?tab=cash (e.g. from POS "Open Register" toast)
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && SETTINGS_TAB_IDS.includes(tab)) {
      const allowed = hasAdminAccess || EMPLOYEE_ALLOWED_SETTINGS_TABS.includes(tab)
      setActiveTab(allowed ? tab : 'location')
    }
  }, [searchParams, hasAdminAccess])
  const DEFAULT_DISCOUNT_PRESETS = [
    { id: 'student', label: 'Student', percent: 10 },
    { id: 'employee', label: 'Employee', percent: 15 },
    { id: 'senior', label: 'Senior', percent: 10 },
    { id: 'military', label: 'Military', percent: 10 }
  ]
  const [posSettings, setPosSettings] = useState({
    num_registers: 1,
    register_type: 'one_screen',
    return_transaction_fee_take_loss: false,
    return_tip_refund: false,
    require_signature_for_return: false,
    transaction_fee_mode: 'additional',
    transaction_fee_charge_cash: false,
    discount_presets: [...DEFAULT_DISCOUNT_PRESETS]
  })
  const [deliveryPayOnDeliveryCashOnly, setDeliveryPayOnDeliveryCashOnly] = useState(false)
  const [allowDelivery, setAllowDelivery] = useState(true)
  const [allowPickup, setAllowPickup] = useState(true)
  const [allowPayAtPickup, setAllowPayAtPickup] = useState(false)
  const [deliveryFeeEnabled, setDeliveryFeeEnabled] = useState(false)
  const [allowScheduledPickup, setAllowScheduledPickup] = useState(false)
  const [allowScheduledDelivery, setAllowScheduledDelivery] = useState(false)
  const [activeReceiptSection, setActiveReceiptSection] = useState(null) // 'header', 'body_items', 'body_totals', 'body_barcode', 'footer', 'styling', null
  const [receiptEditModalOpen, setReceiptEditModalOpen] = useState(false)
  const [receiptEditorView, setReceiptEditorView] = useState('print') // 'print' | 'email'
  const [receiptEditorEmailPreset, setReceiptEditorEmailPreset] = useState('premium') // 'premium' | 'restaurantPromotion'
  const [receiptUndoStack, setReceiptUndoStack] = useState([])
  const [receiptRedoStack, setReceiptRedoStack] = useState([])
  const setReceiptSettingsWithUndo = (updater) => {
    setReceiptSettings(prev => {
      setReceiptUndoStack(u => [...u, JSON.parse(JSON.stringify(prev))])
      setReceiptRedoStack([])
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }
  const handleReceiptUndo = () => {
    if (receiptUndoStack.length === 0) return
    const toRestore = receiptUndoStack[receiptUndoStack.length - 1]
    setReceiptSettings(prev => {
      setReceiptRedoStack(r => [...r, JSON.parse(JSON.stringify(prev))])
      return JSON.parse(JSON.stringify(toRestore))
    })
    setReceiptUndoStack(u => u.slice(0, -1))
  }
  const handleReceiptRedo = () => {
    if (receiptRedoStack.length === 0) return
    const toRestore = receiptRedoStack[receiptRedoStack.length - 1]
    setReceiptSettings(prev => {
      setReceiptUndoStack(u => [...u, JSON.parse(JSON.stringify(prev))])
      return JSON.parse(JSON.stringify(toRestore))
    })
    setReceiptRedoStack(r => r.slice(0, -1))
  }
  const [receiptTemplateDropdownOpen, setReceiptTemplateDropdownOpen] = useState(false)
  const [receiptShowNewTemplateInput, setReceiptShowNewTemplateInput] = useState(false)
  const [receiptNewTemplateName, setReceiptNewTemplateName] = useState('')
  const receiptTemplateDropdownRef = useRef(null)
  const receiptNewTemplateInputRef = useRef(null)

  // Integrations (Shopify, DoorDash, Uber Eats)
  const [integrations, setIntegrations] = useState({
    shopify: { enabled: false, config: { api_key: '', store_url: '', price_multiplier: 1 } },
    doordash: { enabled: false, config: { api_key: '', price_multiplier: 1 } },
    uber_eats: { enabled: false, config: { api_key: '', price_multiplier: 1 } }
  })
  const [integrationsLoading, setIntegrationsLoading] = useState(false)
  const [integrationsSaving, setIntegrationsSaving] = useState(null) // 'shopify' | 'doordash' | 'uber_eats' | null
  const [shopifySyncLoading, setShopifySyncLoading] = useState(false)
  const [shopifyProductsSyncLoading, setShopifyProductsSyncLoading] = useState(false)
  const [shopifySyncDropdownOpen, setShopifySyncDropdownOpen] = useState(false)
  const shopifySyncDropdownRef = useRef(null)
  const [doordashSyncLoading, setDoordashSyncLoading] = useState(false)
  const [doordashPushMenuLoading, setDoordashPushMenuLoading] = useState(false)
  const [doordashPushStoreHoursLoading, setDoordashPushStoreHoursLoading] = useState(false)
  const [doordashGetMenuLoading, setDoordashGetMenuLoading] = useState(false)
  const [doordashStoreDetailsLoading, setDoordashStoreDetailsLoading] = useState(false)
  const [doordashMenuDetailsLoading, setDoordashMenuDetailsLoading] = useState(false)
  const [doordashMigrationsLoading, setDoordashMigrationsLoading] = useState(false)
  const [doordashItemHoursModalOpen, setDoordashItemHoursModalOpen] = useState(false)
  const [doordashItemHoursProducts, setDoordashItemHoursProducts] = useState([])
  const [doordashItemHoursSaving, setDoordashItemHoursSaving] = useState(false)
  const [doordashSyncDropdownOpen, setDoordashSyncDropdownOpen] = useState(false)
  const doordashSyncDropdownRef = useRef(null)
  const [doordashStoreStatusLoading, setDoordashStoreStatusLoading] = useState(false)
  const [doordashDeactivateModalOpen, setDoordashDeactivateModalOpen] = useState(false)
  const [doordashDeactivateReason, setDoordashDeactivateReason] = useState('store_pos_connectivity_issues')
  const [doordashDeactivateNotes, setDoordashDeactivateNotes] = useState('')
  const [doordashDeactivateEndTime, setDoordashDeactivateEndTime] = useState('')
  const [doordashLatestDeactivation, setDoordashLatestDeactivation] = useState(null)
  const defaultDoordashSetupHours = () => ({
    monday: { open: '09:00', close: '17:00', closed: false },
    tuesday: { open: '09:00', close: '17:00', closed: false },
    wednesday: { open: '09:00', close: '17:00', closed: false },
    thursday: { open: '09:00', close: '17:00', closed: false },
    friday: { open: '09:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '17:00', closed: false },
    sunday: { open: '09:00', close: '17:00', closed: false }
  })
  const [doordashSetupModalOpen, setDoordashSetupModalOpen] = useState(false)
  const [doordashSetupHours, setDoordashSetupHours] = useState(defaultDoordashSetupHours)
  const [doordashAddAllItemsLoading, setDoordashAddAllItemsLoading] = useState(false)
  const [doordashSyncMenuItems, setDoordashSyncMenuItems] = useState([])
  const [doordashSyncMappings, setDoordashSyncMappings] = useState({})
  const [doordashSyncMenuLoading, setDoordashSyncMenuLoading] = useState(false)
  const [doordashSyncSaveLoading, setDoordashSyncSaveLoading] = useState(false)
  const [doordashSyncInventoryProducts, setDoordashSyncInventoryProducts] = useState([])
  const [doordashEditModalOpen, setDoordashEditModalOpen] = useState(false)
  useEffect(() => {
    if (!doordashSetupModalOpen) return
    const cfg = integrations?.doordash?.config?.doordash_hours
    const storeHours = storeLocationSettings?.store_hours
    const def = defaultDoordashSetupHours()
    if (cfg && typeof cfg === 'object') {
      setDoordashSetupHours({ ...def, ...cfg })
    } else if (storeHours && typeof storeHours === 'object') {
      setDoordashSetupHours({ ...def, ...storeHours })
    } else {
      setDoordashSetupHours(def)
    }
  }, [doordashSetupModalOpen])
  useEffect(() => {
    if (activeTab !== 'integration') return
    setIntegrationsLoading(true)
    cachedFetch('/api/integrations')
      .then(res => res.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data)) {
          const next = {
            shopify: { enabled: false, config: { api_key: '', store_url: '', price_multiplier: 1 } },
            doordash: { enabled: false, config: { api_key: '', price_multiplier: 1 } },
            uber_eats: { enabled: false, config: { api_key: '', price_multiplier: 1 } }
          }
          result.data.forEach((row) => {
            const p = (row.provider || '').toLowerCase()
            if (p === 'shopify' || p === 'doordash' || p === 'uber_eats') {
              const c = row.config && typeof row.config === 'object' ? row.config : {}
              const base = {
                api_key: c.api_key || '',
                store_url: c.store_url || '',
                price_multiplier: typeof c.price_multiplier === 'number' ? c.price_multiplier : 1,
                webhook_secret: c.webhook_secret || '',
                last_synced_at: c.last_synced_at,
                last_synced_order_id: c.last_synced_order_id,
                last_synced_product_id: c.last_synced_product_id,
                products_synced_at: c.products_synced_at
              }
              next[p] = {
                enabled: !!row.enabled,
                config: p === 'doordash' || p === 'uber_eats' ? { ...c, ...base } : { ...base }
              }
            }
          })
          setIntegrations(next)
        }
      })
      .catch(() => { })
      .finally(() => setIntegrationsLoading(false))
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'integration') return
    fetch('/api/integrations/doordash/latest-store-deactivation')
      .then(res => res.json())
      .then((data) => {
        if (data && (data.reason != null || data.end_time != null || data.notes != null)) {
          setDoordashLatestDeactivation(data)
        } else {
          setDoordashLatestDeactivation(null)
        }
      })
      .catch(() => setDoordashLatestDeactivation(null))
  }, [activeTab])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (shopifySyncDropdownRef.current && !shopifySyncDropdownRef.current.contains(e.target)) {
        setShopifySyncDropdownOpen(false)
      }
      if (doordashSyncDropdownRef.current && !doordashSyncDropdownRef.current.contains(e.target)) {
        setDoordashSyncDropdownOpen(false)
      }
    }
    if (shopifySyncDropdownOpen || doordashSyncDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [shopifySyncDropdownOpen, doordashSyncDropdownOpen])

  const saveIntegration = async (provider) => {
    setIntegrationsSaving(provider)
    const state = integrations[provider]
    const configToSend = { ...(state.config || {}) }
    if (provider === 'shopify' && configToSend.webhook_secret === '') delete configToSend.webhook_secret
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          enabled: state.enabled,
          config: configToSend
        })
      })
      const data = await res.json()
      if (data.success) {
        const integrationLogos = { doordash: { src: '/doordash-logo.svg', alt: 'DoorDash' }, uber_eats: { src: '/uber-eats-logo.svg', alt: 'Uber Eats' }, shopify: { src: '/shopify-logo.svg', alt: 'Shopify' } }
        const icon = integrationLogos[provider]
        showToast(icon ? `${icon.alt} saved` : 'Integration saved', 'success', icon ? { icon } : undefined)
        if (provider === 'shopify' && data.config) {
          setIntegrations(prev => ({
            ...prev,
            shopify: {
              ...prev.shopify,
              config: { ...(prev.shopify?.config || {}), ...data.config }
            }
          }))
        }
        if (provider === 'doordash') {
          try {
            const statusRes = await fetch('/api/integrations/doordash/store-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(
                state.enabled
                  ? { is_active: true }
                  : { is_active: false, reason: 'store_pos_connectivity_issues', notes: 'Deactivated from POS' }
              )
            })
            const statusData = await statusRes.json()
            if (statusData.success) {
              showToast(state.enabled ? 'Store activated on DoorDash' : 'Store deactivated on DoorDash', 'success')
            }
          } catch (_) { /* non-blocking */ }
          if (state.enabled) setDoordashSetupModalOpen(true)
        }
      } else {
        showToast(data.message || 'Failed to save', 'error')
      }
    } catch (e) {
      showToast('Failed to save integration', 'error')
    } finally {
      setIntegrationsSaving(null)
    }
  }

  const syncShopifyNow = async () => {
    setShopifySyncLoading(true)
    try {
      const res = await fetch('/api/integrations/shopify/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || `Synced ${data.created ?? 0} order(s)`, 'success')
        if (data.last_synced_order_id != null) {
          setIntegrations(prev => ({
            ...prev,
            shopify: {
              ...prev.shopify,
              config: {
                ...(prev.shopify?.config || {}),
                last_synced_order_id: data.last_synced_order_id,
                last_synced_at: new Date().toISOString()
              }
            }
          }))
        }
      } else {
        showToast(data.message || 'Sync failed', 'error')
      }
    } catch (e) {
      showToast('Sync failed', 'error')
    } finally {
      setShopifySyncLoading(false)
    }
  }

  const syncDoordashNow = async () => {
    setDoordashSyncLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || 'DoorDash sync complete', 'success')
      } else {
        showToast(data.message || 'Sync failed', 'error')
      }
    } catch (e) {
      showToast('Sync failed', 'error')
    } finally {
      setDoordashSyncLoading(false)
    }
  }

  const pushDoordashMenuNow = async () => {
    setDoordashPushMenuLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/push-menu', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(data.message === 'Created' ? 'Menu pushed to DoorDash (create). You’ll get a status webhook when done.' : 'Menu pushed to DoorDash (update).', 'success')
      } else {
        showToast(data.message || 'Push menu failed', 'error')
      }
    } catch (e) {
      showToast('Push menu failed', 'error')
    } finally {
      setDoordashPushMenuLoading(false)
    }
  }

  const pushDoordashStoreHours = async () => {
    setDoordashPushStoreHoursLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/push-store-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_hours: storeLocationSettings?.store_hours || null })
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || 'Store hours pushed to DoorDash.', 'success')
      } else {
        showToast(data.message || 'Push store hours failed', 'error')
      }
    } catch (e) {
      showToast('Push store hours failed', 'error')
    } finally {
      setDoordashPushStoreHoursLoading(false)
    }
  }

  const getDoordashMenuNow = async () => {
    setDoordashGetMenuLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/store-menu')
      const data = await res.json()
      if (res.ok) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'doordash-store-menu.json'
        a.click()
        URL.revokeObjectURL(a.href)
        showToast('DoorDash menu downloaded', 'success')
      } else {
        showToast(data.message || 'Get menu failed', 'error')
      }
    } catch (e) {
      showToast('Get menu failed', 'error')
    } finally {
      setDoordashGetMenuLoading(false)
    }
  }

  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const getDoordashStoreDetailsNow = async () => {
    setDoordashStoreDetailsLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/store-details')
      const data = await res.json()
      if (res.ok) {
        downloadJson(data, 'doordash-store-details.json')
        showToast('Store details downloaded', 'success')
      } else {
        showToast(data.message || 'Get store details failed', 'error')
      }
    } catch (e) {
      showToast('Get store details failed', 'error')
    } finally {
      setDoordashStoreDetailsLoading(false)
    }
  }

  const getDoordashMenuDetailsNow = async () => {
    setDoordashMenuDetailsLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/menu-details')
      const data = await res.json()
      if (res.ok) {
        downloadJson(data, 'doordash-menu-details.json')
        showToast('Menu details downloaded', 'success')
      } else {
        showToast(data.message || 'Get menu details failed', 'error')
      }
    } catch (e) {
      showToast('Get menu details failed', 'error')
    } finally {
      setDoordashMenuDetailsLoading(false)
    }
  }

  const doordashDeactivateReasons = [
    { value: 'store_pos_connectivity_issues', label: 'Store / POS connectivity issues' },
    { value: 'store_self_disabled_in_their_POS_portal', label: 'Store self-disabled in POS' },
    { value: 'operational_issues', label: 'Operational issues' },
    { value: 'payment_issue', label: 'Payment issue' },
    { value: 'delete_store', label: 'Delete store' },
    { value: 'out_of_business', label: 'Out of business' }
  ]

  const doordashReactivateStore = async () => {
    setDoordashStoreStatusLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/store-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || 'Store reactivated', 'success')
      } else {
        showToast(data.message || 'Reactivate failed', 'error')
      }
    } catch (e) {
      showToast('Reactivate failed', 'error')
    } finally {
      setDoordashStoreStatusLoading(false)
    }
  }

  const doordashDeactivateStoreSubmit = async () => {
    const notes = (doordashDeactivateNotes || '').trim()
    if (!notes) {
      showToast('Notes are required for deactivation', 'error')
      return
    }
    setDoordashStoreStatusLoading(true)
    try {
      const body = {
        is_active: false,
        reason: doordashDeactivateReason,
        notes
      }
      if (doordashDeactivateEndTime && doordashDeactivateEndTime.trim()) {
        body.end_time = doordashDeactivateEndTime.trim()
      }
      const res = await fetch('/api/integrations/doordash/store-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || 'Store deactivation sent', 'success')
        setDoordashDeactivateModalOpen(false)
        setDoordashDeactivateNotes('')
        setDoordashDeactivateEndTime('')
      } else {
        showToast(data.message || 'Deactivate failed', 'error')
      }
    } catch (e) {
      showToast('Deactivate failed', 'error')
    } finally {
      setDoordashStoreStatusLoading(false)
    }
  }

  const runDoordashMigrations = async () => {
    setDoordashMigrationsLoading(true)
    try {
      const res = await fetch('/api/integrations/doordash/run-migrations', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(data.message + (data.run?.length ? ` (${data.run.join(', ')})` : ''), 'success')
      } else {
        showToast(data.message || 'Migrations failed', 'error')
      }
    } catch (e) {
      showToast('Migrations failed', 'error')
    } finally {
      setDoordashMigrationsLoading(false)
    }
  }

  const openDoordashItemHoursModal = async () => {
    setDoordashItemHoursModalOpen(true)
    try {
      const res = await cachedFetch('/api/inventory?item_type=product')
      const j = await res.json()
      const rows = (j.data != null ? j.data : Array.isArray(j) ? j : []).map((p) => ({
        ...p,
        item_special_hours_edit: Array.isArray(p.item_special_hours) ? JSON.stringify(p.item_special_hours, null, 2) : (p.item_special_hours ? JSON.stringify(p.item_special_hours, null, 2) : '')
      }))
      setDoordashItemHoursProducts(rows)
    } catch (e) {
      showToast('Failed to load inventory', 'error')
      setDoordashItemHoursProducts([])
    }
  }

  const saveDoordashItemHours = async () => {
    setDoordashItemHoursSaving(true)
    const token = localStorage.getItem('sessionToken') || ''
    let ok = 0
    let err = 0
    for (const p of doordashItemHoursProducts) {
      let parsed = null
      const raw = (p.item_special_hours_edit || '').trim()
      if (raw) {
        try {
          parsed = JSON.parse(raw)
          if (!Array.isArray(parsed)) parsed = null
        } catch (_) {
          err++
          continue
        }
      }
      const orig = p.item_special_hours
      const origStr = orig == null || (Array.isArray(orig) && orig.length === 0) ? '' : JSON.stringify(orig)
      const newStr = parsed == null || (Array.isArray(parsed) && parsed.length === 0) ? '' : JSON.stringify(parsed)
      if (origStr === newStr) continue
      try {
        const res = await fetch(`/api/inventory/${p.product_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          body: JSON.stringify({ item_special_hours: parsed, session_token: token })
        })
        if (res.ok) ok++
        else err++
      } catch (_) {
        err++
      }
    }
    setDoordashItemHoursSaving(false)
    if (err > 0) showToast(`Saved ${ok} product(s); ${err} failed.`, 'error')
    else showToast(ok > 0 ? `Saved item-level hours for ${ok} product(s).` : 'No changes to save.', 'success')
    if (ok > 0) setDoordashItemHoursModalOpen(false)
  }

  const setDoordashItemHoursEdit = (productId, value) => {
    setDoordashItemHoursProducts((prev) => prev.map((p) => (p.product_id === productId ? { ...p, item_special_hours_edit: value } : p)))
  }

  const syncShopifyProductsNow = async () => {
    setShopifyProductsSyncLoading(true)
    try {
      const res = await fetch('/api/integrations/shopify/sync-products', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || `Synced ${data.created ?? 0} created, ${data.updated ?? 0} updated`, 'success')
        if (data.last_synced_product_id != null) {
          setIntegrations(prev => ({
            ...prev,
            shopify: {
              ...prev.shopify,
              config: {
                ...(prev.shopify?.config || {}),
                last_synced_product_id: data.last_synced_product_id,
                products_synced_at: new Date().toISOString()
              }
            }
          }))
        }
      } else {
        showToast(data.message || 'Product sync failed', 'error')
      }
    } catch (e) {
      showToast('Product sync failed', 'error')
    } finally {
      setShopifyProductsSyncLoading(false)
    }
  }

  const connectShopifyWithOAuth = async () => {
    const storeUrl = (integrations.shopify?.config?.store_url || '').trim() || ''
    let shop = storeUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.myshopify\.com.*/, '')
    if (!shop) {
      showToast('Enter your Shopify store URL first (e.g. mystore.myshopify.com)', 'error')
      return
    }
    if (!shop.includes('.myshopify.com')) shop = shop + '.myshopify.com'
    // Open window immediately (before any await) to avoid popup blocker
    const w = typeof window !== 'undefined' && window.__TAURI__ ? null : window.open('about:blank', '_blank')
    try {
      const fromTauri = typeof window !== 'undefined' && !!window.__TAURI__
      const res = await fetch(`/api/integrations/shopify/connect-url?shop=${encodeURIComponent(shop)}${fromTauri ? '&from=tauri' : ''}`)
      const data = await res.json()
      if (data.success && data.url) {
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const { open } = await import('@tauri-apps/plugin-shell')
          await open(data.url)
          showToast('Shopify authorization opened in your browser. Approve there, then return here.', 'success')
        } else if (w && !w.closed) {
          w.location.href = data.url
          showToast('Shopify authorization opened in a new tab. Approve there, then return here.', 'success')
        } else {
          window.open(data.url, '_blank')
          showToast('Shopify authorization opened in a new tab. Approve there, then return here.', 'success')
        }
      } else {
        if (w && !w.closed) w.close()
        showToast(data.message || 'Failed to get Shopify connect URL', 'error')
      }
    } catch (e) {
      if (w && !w.closed) w.close()
      showToast('Failed to open Shopify connect', 'error')
    }
  }

  useEffect(() => {
    const shopify = searchParams.get('shopify')
    const msg = searchParams.get('msg')
    if (shopify === 'connected') {
      showToast('Shopify connected successfully', 'success')
      searchParams.delete('shopify')
      searchParams.delete('msg')
      setSearchParams(searchParams, { replace: true })
      setIntegrationsLoading(true)
      cachedFetch('/api/integrations').then(res => res.json()).then((result) => {
        if (result.success && Array.isArray(result.data)) {
          const next = { ...integrations }
          result.data.forEach((row) => {
            const p = (row.provider || '').toLowerCase()
            if (p === 'shopify') {
              const c = row.config && typeof row.config === 'object' ? row.config : {}
              next.shopify = { enabled: !!row.enabled, config: { api_key: c.api_key || '', store_url: c.store_url || '', price_multiplier: typeof c.price_multiplier === 'number' ? c.price_multiplier : 1, webhook_secret: c.webhook_secret || '', last_synced_at: c.last_synced_at, last_synced_order_id: c.last_synced_order_id, last_synced_product_id: c.last_synced_product_id, products_synced_at: c.products_synced_at } }
            }
          })
          setIntegrations(next)
        }
      }).finally(() => setIntegrationsLoading(false))
    } else if (shopify === 'error') {
      showToast(msg || 'Shopify connection failed', 'error')
      searchParams.delete('shopify')
      searchParams.delete('msg')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams.get('shopify'), searchParams.get('msg')])

  useEffect(() => {
    if (receiptEditModalOpen) {
      setReceiptUndoStack([])
      setReceiptRedoStack([])
      loadReceiptTemplates()
      setActiveReceiptSection('header')
    } else {
      setReceiptEditorView('print')
      setReceiptEditorEmailPreset('premium')
    }
  }, [receiptEditModalOpen])
  useEffect(() => {
    if (receiptShowNewTemplateInput && receiptNewTemplateInputRef.current) {
      receiptNewTemplateInputRef.current.focus()
    }
  }, [receiptShowNewTemplateInput])
  useEffect(() => {
    if (!receiptTemplateDropdownOpen) {
      setReceiptShowNewTemplateInput(false)
      setReceiptNewTemplateName('')
    }
  }, [receiptTemplateDropdownOpen])
  useEffect(() => {
    if (!receiptTemplateDropdownOpen) return
    const handleClickOutside = (e) => {
      if (receiptTemplateDropdownRef.current && !receiptTemplateDropdownRef.current.contains(e.target)) {
        setReceiptTemplateDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [receiptTemplateDropdownOpen])
  const [savedTemplates, setSavedTemplates] = useState([])
  const [storeLocationSettings, setStoreLocationSettings] = useState({
    store_name: 'Store',
    store_type: '',
    store_logo: '',
    store_phone: '',
    store_email: '',
    store_website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zip: '',
    latitude: null,
    longitude: null,
    allowed_radius_meters: 100.0,
    require_location: true,
    store_hours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '17:00', closed: false },
      sunday: { open: '09:00', close: '17:00', closed: false }
    }
  })
  const storeLocationLoadedRef = useRef(false)
  const storeLocationSaveTimeoutRef = useRef(null)
  const previousActiveTabRef = useRef('location')
  const [displaySettings, setDisplaySettings] = useState({
    tip_enabled: false,
    tip_after_payment: false,
    tip_suggestions: [15, 18, 20],
    require_signature: 'not_required',
    tip_custom_in_checkout: false,
    tip_allocation: 'logged_in_employee',
    tip_refund_from: 'store'
  })
  const CHECKOUT_BUTTON_STYLES = [
    { value: 'default', label: 'Default (solid)' },
    { value: 'push', label: 'Push (3D shadow)' },
    { value: 'pill', label: 'Pill (rounded gradient)' },
    { value: 'border-bottom', label: 'Border bottom' },
    { value: 'soft-push', label: 'Soft push (3D)' },
    { value: 'inset', label: 'Inset (recessed)' },
    { value: 'bevel', label: 'Bevel (classic 3D)' },
    { value: 'gradient', label: 'Gradient (glossy)' },
    { value: 'gold', label: 'Gold (amber)' }
  ]
  // Checkout display dimensions (matches customer display: 800px wide, 600px tall typical tablet)
  const CHECKOUT_PREVIEW_WIDTH = 800
  const CHECKOUT_PREVIEW_HEIGHT = 600
  const CHECKOUT_PREVIEW_CONTAINER_WIDTH = 420
  const [checkoutPreviewScale, setCheckoutPreviewScale] = useState(() => CHECKOUT_PREVIEW_CONTAINER_WIDTH / CHECKOUT_PREVIEW_WIDTH)
  const checkoutPreviewContainerRef = useRef(null)

  const [checkoutUiSettings, setCheckoutUiSettings] = useState(() => getDefaultCheckoutUi())
  const getCheckoutTextStyle = (s, type) => {
    const t = type === 'title' ? 'title' : type === 'button' ? 'button' : 'body'
    const font = s[`${t}_font`] ?? s.fontFamily ?? 'system-ui'
    const size = s[`${t}_font_size`] != null ? s[`${t}_font_size`] : (t === 'title' ? 36 : t === 'button' ? 36 : 24)
    const bold = s[`${t}_bold`] ?? (t === 'button' ? true : false)
    const fw = s.fontWeight ?? '600'
    return {
      fontFamily: font,
      fontSize: `${Number(size)}px`,
      fontWeight: bold ? '700' : (t === 'button' ? fw : '400'),
      fontStyle: s[`${t}_italic`] ? 'italic' : 'normal',
      textAlign: (s[`${t}_align`] || (t === 'title' ? 'center' : 'left'))
    }
  }
  const renderCheckoutPreviewButton = (label, styleId, buttonColor, textStyle, fullWidth = false) => {
    const wrapStyle = { flex: fullWidth ? 'none' : 1, width: fullWidth ? '100%' : undefined, minWidth: 0 }
    const defaultStyle = { flex: fullWidth ? 'none' : 1, width: fullWidth ? '100%' : undefined, height: '100px', padding: '16px', paddingTop: '8px', backgroundColor: buttonColor, color: '#fff', border: 0, borderRadius: '8px', cursor: 'default', boxShadow: 'inset 0 -8px rgb(0 0 0/0.4), 0 2px 4px rgb(0 0 0/0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...textStyle }
    if (!styleId || styleId === 'default') {
      return <button type="button" style={defaultStyle}>{label}</button>
    }
    if (styleId === 'push') {
      return (
        <div className="checkout-btn-wrap" style={wrapStyle}>
          <button type="button" className="checkout-btn--push" style={{ ['--checkout-btn-color']: buttonColor, ...textStyle }}>
            <span className="checkout-btn__shadow" aria-hidden />
            <span className="checkout-btn__edge" aria-hidden />
            <span className="checkout-btn__front">{label}</span>
          </button>
        </div>
      )
    }
    const className = `checkout-btn--${styleId}`
    return (
      <div className={fullWidth ? 'checkout-btn-wrap checkout-btn-wrap--full' : 'checkout-btn-wrap'} style={wrapStyle}>
        <button type="button" className={className} style={{ ['--checkout-btn-color']: buttonColor, ...textStyle }}>
          {styleId === 'soft-push' ? <span className="checkout-btn__text">{label}</span> : label}
        </button>
      </div>
    )
  }
  const [checkoutUiTab, setCheckoutUiTab] = useState('review_order') // 'review_order' | 'cash_confirmation' | 'receipt'
  const [checkoutUiEditModalOpen, setCheckoutUiEditModalOpen] = useState(false)
  const [checkoutUiUndoStack, setCheckoutUiUndoStack] = useState([])
  const [checkoutUiRedoStack, setCheckoutUiRedoStack] = useState([])
  const setCheckoutUiSettingsWithUndo = (updater) => {
    setCheckoutUiSettings(prev => {
      setCheckoutUiUndoStack(u => [...u, JSON.parse(JSON.stringify(prev))])
      setCheckoutUiRedoStack([])
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }
  const handleCheckoutUiUndo = () => {
    if (checkoutUiUndoStack.length === 0) return
    const toRestore = checkoutUiUndoStack[checkoutUiUndoStack.length - 1]
    setCheckoutUiSettings(prev => {
      setCheckoutUiRedoStack(r => [...r, JSON.parse(JSON.stringify(prev))])
      return JSON.parse(JSON.stringify(toRestore))
    })
    setCheckoutUiUndoStack(u => u.slice(0, -1))
  }
  const handleCheckoutUiRedo = () => {
    if (checkoutUiRedoStack.length === 0) return
    const toRestore = checkoutUiRedoStack[checkoutUiRedoStack.length - 1]
    setCheckoutUiSettings(prev => {
      setCheckoutUiUndoStack(u => [...u, JSON.parse(JSON.stringify(prev))])
      return JSON.parse(JSON.stringify(toRestore))
    })
    setCheckoutUiRedoStack(r => r.slice(0, -1))
  }
  useEffect(() => {
    if (checkoutUiEditModalOpen) {
      setCheckoutUiUndoStack([])
      setCheckoutUiRedoStack([])
    }
  }, [checkoutUiEditModalOpen])
  useLayoutEffect(() => {
    if (!checkoutUiEditModalOpen && checkoutPreviewContainerRef.current) {
      const el = checkoutPreviewContainerRef.current
      const updateScale = () => {
        if (el && el.offsetWidth > 0) {
          setCheckoutPreviewScale(el.offsetWidth / CHECKOUT_PREVIEW_WIDTH)
        }
      }
      updateScale()
      const ro = new ResizeObserver(updateScale)
      ro.observe(el)
      const io = new IntersectionObserver(
        () => updateScale(),
        { threshold: 0, rootMargin: '0px' }
      )
      io.observe(el)
      return () => {
        ro.disconnect()
        io.disconnect()
      }
    }
  }, [checkoutUiEditModalOpen, checkoutUiTab])
  const [rewardsSettings, setRewardsSettings] = useState({
    enabled: false,
    require_email: false,
    require_phone: false,
    require_both: false,
    reward_type: 'points',
    points_enabled: true,
    percentage_enabled: false,
    fixed_enabled: false,
    points_per_dollar: 1.0,
    points_redemption_value: 0.01,
    percentage_discount: 0.0,
    fixed_discount: 0.0,
    minimum_spend: 0.0,
    minimum_spend_points: 0.0,
    minimum_spend_percentage: 0.0,
    minimum_spend_fixed: 0.0
  })
  const [rewardsCampaigns, setRewardsCampaigns] = useState(() => {
    try {
      const s = localStorage.getItem('rewards_campaigns')
      return s ? JSON.parse(s) : []
    } catch { return [] }
  })
  const [notificationSettings, setNotificationSettings] = useState(() => {
    try {
      const s = localStorage.getItem('pos_notification_settings')
      if (s) {
        const parsed = JSON.parse(s)
        return NOTIFICATION_OPTIONS.reduce((acc, opt) => ({ ...acc, [opt.id]: parsed[opt.id] !== false }), {})
      }
    } catch (_) { }
    return NOTIFICATION_OPTIONS.reduce((acc, opt) => ({ ...acc, [opt.id]: true }), {})
  })
  const persistNotificationSettings = (next) => {
    setNotificationSettings(next)
    try {
      localStorage.setItem('pos_notification_settings', JSON.stringify(next))
    } catch (_) { }
  }
  const [newOrderToastOptions, setNewOrderToastOptions] = useState(() => {
    try {
      const s = localStorage.getItem(NEW_ORDER_TOAST_OPTIONS_KEY)
      if (s) {
        const parsed = JSON.parse(s)
        return { ...DEFAULT_NEW_ORDER_TOAST_OPTIONS, ...parsed }
      }
    } catch (_) { }
    return { ...DEFAULT_NEW_ORDER_TOAST_OPTIONS }
  })
  const persistNewOrderToastOptions = (next) => {
    setNewOrderToastOptions(next)
    try {
      localStorage.setItem(NEW_ORDER_TOAST_OPTIONS_KEY, JSON.stringify(next))
    } catch (_) { }
  }
  const [notificationChannelSettings, setNotificationChannelSettings] = useState({
    store_id: 1,
    email_provider: 'gmail',
    sms_provider: 'aws_sns',
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    business_name: '',
    store_phone_number: '',
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_region: 'us-east-1',
    notification_preferences: {
      orders: { email: false, sms: false },
      reports: { email: false, sms: false },
      scheduling: { email: true, sms: true },
      clockins: { email: false, sms: false },
      receipts: { email: true, sms: false }
    }
  })
  const [notificationChannelSaving, setNotificationChannelSaving] = useState(false)
  const [clockinNotifSettings, setClockinNotifSettings] = useState({
    notify_admin_on_clockin: false,
    notify_admin_on_clockout: false,
    admin_email_ids: [],
    notify_employee_self: false,
    late_alert_enabled: false,
    late_alert_threshold_min: 10,
    late_alert_to_employee: false,
    late_alert_to_admin: true,
    late_alert_delay_min: 15,
    overtime_alert_enabled: false,
    overtime_threshold_hours: 8.0,
  })
  const [clockinNotifSaving, setClockinNotifSaving] = useState(false)
  const [registerNotifSettings, setRegisterNotifSettings] = useState({
    notify_admin_on_open: false,
    notify_admin_on_close: false,
    notify_admin_on_drop: false,
    notify_admin_on_withdraw: false,
    notify_employee_self: false,
    admin_email_ids: [],
  })
  const [registerNotifSaving, setRegisterNotifSaving] = useState(false)
  const [scheduleNotifSettings, setScheduleNotifSettings] = useState({
    employee_schedule_view: 'shifts_only',
    notify_on_edit: true,
    admin_email_ids: [],
  })
  const [scheduleNotifSaving, setScheduleNotifSaving] = useState(false)
  const [employeesWithEmail, setEmployeesWithEmail] = useState([]) // { employee_id, name, email, role }[]

  const [orderEmailPrefs, setOrderEmailPrefs] = useState({ email_enabled: false, source_filter: ['all'], recipient_employee_ids: [] })
  const [showTestEmailInput, setShowTestEmailInput] = useState(false)
  const [testEmailInput, setTestEmailInput] = useState('')
  const [testEmailSending, setTestEmailSending] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState([])
  const [emailTemplateModalOpen, setEmailTemplateModalOpen] = useState(false)
  const [emailTemplateAdding, setEmailTemplateAdding] = useState(false)
  const [emailTemplateResetting, setEmailTemplateResetting] = useState(false)
  const [emailTemplateEditing, setEmailTemplateEditing] = useState(null)
  const [emailTemplateForm, setEmailTemplateForm] = useState({ name: '', category: 'receipt', subject_template: '', body_html_template: '', body_text_template: '' })
  const [emailTemplateEditMode, setEmailTemplateEditMode] = useState('visual') // 'visual' | 'html'
  const [activeEmailReceiptSection, setActiveEmailReceiptSection] = useState('header')
  const [emailReceiptDesign, setEmailReceiptDesign] = useState(() => ({ ...DEFAULT_RECEIPT_TEMPLATE, headerBg: '#1e293b', headerTextColor: '#ffffff', footerBg: '#f8fafc', footerTextColor: '#64748b' }))
  const [emailTemplateCategory, setEmailTemplateCategory] = useState('receipt')
  const [emailTemplateDropdownOpen, setEmailTemplateDropdownOpen] = useState(false)
  const [emailOrderDesign, setEmailOrderDesign] = useState({ store_name: '', store_tagline: '', store_address: '', store_phone: '', store_email: '', footer_message: '' })
  const [activeEmailOrderSection, setActiveEmailOrderSection] = useState('header')
  const [emailTemplateShowNewInput, setEmailTemplateShowNewInput] = useState(false)
  const [emailTemplateNewName, setEmailTemplateNewName] = useState('')
  const [emailTemplateCreatePreset, setEmailTemplateCreatePreset] = useState(null)
  const [emailReceiptPreset, setEmailReceiptPreset] = useState(null) // 'premium' | 'restaurantPromotion' when on built-in preset (like receipt print Modern/Classic)
  const [emailOrderPreset, setEmailOrderPreset] = useState('appNotification') // 'appNotification' | 'classic' – default for order alerts
  const [emailTemplateUndoStack, setEmailTemplateUndoStack] = useState([])
  const [emailTemplateRedoStack, setEmailTemplateRedoStack] = useState([])
  const [showOrderTestEmailInput, setShowOrderTestEmailInput] = useState(false)
  const [orderTestEmailInput, setOrderTestEmailInput] = useState('')
  const [orderTestEmailSending, setOrderTestEmailSending] = useState(false)
  const emailTemplateDropdownRef = useRef(null)
  const emailTemplateNewInputRef = useRef(null)
  const emailTemplateRestoringRef = useRef(false)
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false)
  const [showProductPickerModal, setShowProductPickerModal] = useState(false)
  const [showBarcodeInPicker, setShowBarcodeInPicker] = useState(false)
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'promo_discount',
    discount_value: '',
    product_id: null,
    buy_qty: 1,
    get_qty: 1,
    audience: 'everyone',
    start_date: '',
    end_date: '',
    minimum_purchase: '',
    product_ids: [],
    product_exclude_ids: [],
    category_ids: [],
    category_exclude_ids: []
  })
  const defaultNewCampaign = () => ({
    name: '',
    type: 'promo_discount',
    discount_value: '',
    product_id: null,
    buy_qty: 1,
    get_qty: 1,
    audience: 'everyone',
    start_date: '',
    end_date: '',
    minimum_purchase: '',
    product_ids: [],
    product_exclude_ids: [],
    category_ids: [],
    category_exclude_ids: []
  })
  const [pickerProducts, setPickerProducts] = useState([])
  const [pickerCategories, setPickerCategories] = useState([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerIncludeIds, setPickerIncludeIds] = useState([])
  const [pickerExcludeIds, setPickerExcludeIds] = useState([])
  const [pickerLimitCategoryIds, setPickerLimitCategoryIds] = useState([])
  const [pickerExcludeCategoryIds, setPickerExcludeCategoryIds] = useState([])
  const [pickerLoading, setPickerLoading] = useState(false)
  useEffect(() => {
    if (!showProductPickerModal) return
    setPickerIncludeIds([...(newCampaign.product_ids || [])])
    setPickerExcludeIds([...(newCampaign.product_exclude_ids || [])])
    setPickerLimitCategoryIds([...(newCampaign.category_ids || [])])
    setPickerExcludeCategoryIds([...(newCampaign.category_exclude_ids || [])])
    setPickerSearch('')
    setPickerLoading(true)
    Promise.all([
      fetch('/api/inventory?item_type=product&limit=2000').then(r => r.json()),
      fetch('/api/categories').then(r => r.json())
    ]).then(([invRes, catRes]) => {
      setPickerProducts(invRes.data || [])
      setPickerCategories(catRes.data || [])
      setPickerLoading(false)
    }).catch(() => setPickerLoading(false))
  }, [showProductPickerModal])
  const [registers, setRegisters] = useState(() => {
    // Load from localStorage or default to one register
    const saved = localStorage.getItem('cash_registers')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return [{ id: 1, name: 'Register 1' }]
      }
    }
    return [{ id: 1, name: 'Register 1' }]
  })
  const [cashSettings, setCashSettings] = useState({
    register_id: 1,
    cash_mode: 'total',
    total_amount: 200.00,
    denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    }
  })
  const [dailyCount, setDailyCount] = useState({
    register_id: 1,
    count_date: new Date().toISOString().split('T')[0],
    count_type: 'drop',
    total_amount: 0,
    denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    },
    adjustment_type: 'none', // 'none', 'add', 'take_out'
    adjustment_mode: 'total', // 'total' or 'denominations'
    adjustment_amount: 0,
    adjustment_denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    },
    notes: ''
  })
  const [dailyCounts, setDailyCounts] = useState([])
  const [registerSessions, setRegisterSessions] = useState([])
  const [registerTransactions, setRegisterTransactions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showTakeOutModal, setShowTakeOutModal] = useState(false)
  const [showCountDropModal, setShowCountDropModal] = useState(false)
  const [registerToDelete, setRegisterToDelete] = useState(null) // { id, name } when dropdown confirm open
  const [registerMenuOpenId, setRegisterMenuOpenId] = useState(null) // which register's ⋮ menu is open
  const [registerEditingId, setRegisterEditingId] = useState(null) // which register name is in edit mode
  const [registerRefreshSpinning, setRegisterRefreshSpinning] = useState(false)
  const [expandedRegisterEventId, setExpandedRegisterEventId] = useState(null) // event id for expanded row details
  const [openRegisterForm, setOpenRegisterForm] = useState({
    register_id: 1,
    cash_mode: 'total',
    total_amount: 0,
    denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    },
    adjustment_type: 'none', // 'none', 'add', 'take_out'
    adjustment_mode: 'total', // 'total' or 'denominations'
    adjustment_amount: 0,
    adjustment_denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    },
    expected_amount: 0,
    notes: ''
  })
  const [closeRegisterForm, setCloseRegisterForm] = useState({
    cash_mode: 'total',
    total_amount: 0,
    denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    },
    adjustment_type: 'none', // 'none', 'add', 'take_out'
    adjustment_mode: 'total', // 'total' or 'denominations'
    adjustment_amount: 0,
    adjustment_denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    },
    notes: ''
  })
  const [lastClosedSession, setLastClosedSession] = useState(null)
  const [takeOutForm, setTakeOutForm] = useState({
    amount: 0,
    reason: '',
    notes: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' }
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [hoveringSettings, setHoveringSettings] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const settingsHeaderRef = useRef(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isInitialMount, setIsInitialMount] = useState(true)
  const sidebarRef = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    // Disable initial animation by setting flag after component is mounted
    const timer = setTimeout(() => {
      setIsInitialMount(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }

  const themeColorRgb = hexToRgb(themeColor)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const loadEstablishmentSettings = async () => {
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await cachedFetch('/api/accounting/settings', { headers: token ? { 'X-Session-Token': token } : {} })
      if (!res.ok) {
        if (res.status === 403) return
        return
      }
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        if ('delivery_pay_on_delivery_cash_only' in d) setDeliveryPayOnDeliveryCashOnly(!!d.delivery_pay_on_delivery_cash_only)
        if ('allow_delivery' in d) setAllowDelivery(!!d.allow_delivery)
        if ('allow_pickup' in d) setAllowPickup(!!d.allow_pickup)
        if ('allow_pay_at_pickup' in d) setAllowPayAtPickup(!!d.allow_pay_at_pickup)
        if ('delivery_fee_enabled' in d) setDeliveryFeeEnabled(!!d.delivery_fee_enabled)
        if ('allow_scheduled_pickup' in d) setAllowScheduledPickup(!!d.allow_scheduled_pickup)
        if ('allow_scheduled_delivery' in d) setAllowScheduledDelivery(!!d.allow_scheduled_delivery)
      }
    } catch (e) {
      console.warn('Could not load establishment settings:', e)
    }
  }
  const saveOrderDeliverySetting = async (key, value) => {
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch('/api/accounting/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Session-Token': token } : {}) },
        body: JSON.stringify({ [key]: value })
      })
      const json = await res.json()
      if (json.success) {
        setMessage({ type: 'success', text: 'Setting saved.' })
        return true
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to save' })
        return false
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save setting' })
      return false
    }
  }
  const saveDeliveryPayOnDeliveryCashOnly = async (value) => {
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch('/api/accounting/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Session-Token': token } : {}) },
        body: JSON.stringify({ delivery_pay_on_delivery_cash_only: value })
      })
      const json = await res.json()
      if (json.success) {
        setDeliveryPayOnDeliveryCashOnly(!!value)
        setMessage({ type: 'success', text: 'Delivery payment setting saved.' })
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to save' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save delivery setting' })
    }
  }

  const SETTINGS_BOOTSTRAP_KEY = 'pos_settings_bootstrap'
  const {
    data: bootstrapData,
    isLoading: bootstrapLoading,
    isSuccess: bootstrapSuccess,
    isError: bootstrapError
  } = useQuery({
    queryKey: ['settings-bootstrap'],
    queryFn: async () => {
      const sessionToken = localStorage.getItem('sessionToken')
      const res = await cachedFetch('/api/settings-bootstrap', { headers: { 'X-Session-Token': sessionToken || '' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load settings')
      try {
        localStorage.setItem(SETTINGS_BOOTSTRAP_KEY, JSON.stringify(data))
      } catch (_) { }
      return data
    },
    initialData: () => {
      try {
        const raw = localStorage.getItem(SETTINGS_BOOTSTRAP_KEY)
        return raw ? JSON.parse(raw) : undefined
      } catch {
        return undefined
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: 1
  })

  useEffect(() => {
    if (!bootstrapSuccess || !bootstrapData?.success) return
    const data = bootstrapData
    if (data.receipt_settings) {
      const s = data.receipt_settings
      const templateStyles = (s.template_styles && typeof s.template_styles === 'object') ? s.template_styles : {}
      const preset = s.template_preset ?? templateStyles.template_preset ?? 'custom'
      const hasSavedStyles = Object.keys(templateStyles).length > 5
      const baseStyles = (preset && RECEIPT_PRESETS[preset] && !hasSavedStyles) ? { ...RECEIPT_PRESETS[preset] } : { ...DEFAULT_RECEIPT_TEMPLATE, ...templateStyles }
      setReceiptSettings({
        ...baseStyles,
        receipt_type: s.receipt_type || 'traditional',
        template_preset: preset,
        store_name: s.store_name ?? 'Store',
        store_address: s.store_address ?? '',
        store_city: s.store_city ?? '',
        store_state: s.store_state ?? '',
        store_zip: s.store_zip ?? '',
        store_phone: s.store_phone ?? '',
        store_email: s.store_email ?? '',
        store_website: s.store_website ?? '',
        footer_message: s.footer_message ?? 'Thank you for your business!',
        return_policy: s.return_policy ?? '',
        show_tax_breakdown: s.show_tax_breakdown === 1,
        show_payment_method: s.show_payment_method === 1,
        show_signature: s.show_signature === 1,
        show_tip: s.show_tip !== 0
      })
    }
    if (data.receipt_templates && Array.isArray(data.receipt_templates)) setSavedTemplates(data.receipt_templates)
    if (data.store_location_settings) {
      const defaultStoreHours = { monday: { open: '09:00', close: '17:00', closed: false }, tuesday: { open: '09:00', close: '17:00', closed: false }, wednesday: { open: '09:00', close: '17:00', closed: false }, thursday: { open: '09:00', close: '17:00', closed: false }, friday: { open: '09:00', close: '17:00', closed: false }, saturday: { open: '09:00', close: '17:00', closed: false }, sunday: { open: '09:00', close: '17:00', closed: false } }
      const d = data.store_location_settings
      setStoreLocationSettings({
        store_name: 'Store', store_type: '', store_logo: '', store_phone: '', store_email: '', store_website: '', address: '', city: '', state: '', country: '', zip: '', latitude: null, longitude: null, allowed_radius_meters: 100.0, require_location: true, store_hours: defaultStoreHours,
        ...d,
        require_location: d.require_location === 1 || d.require_location === true,
        store_hours: d.store_hours ? { ...defaultStoreHours, ...d.store_hours } : defaultStoreHours
      })
      storeLocationLoadedRef.current = true
      setReceiptSettings(prev => ({
        ...prev,
        store_name: d.store_name ?? prev.store_name,
        store_address: d.address ?? prev.store_address,
        store_city: d.city ?? prev.store_city,
        store_state: d.state ?? prev.store_state,
        store_zip: d.zip ?? prev.store_zip,
        store_phone: d.store_phone ?? prev.store_phone,
        store_email: d.store_email ?? prev.store_email,
        store_website: d.store_website ?? prev.store_website
      }))
    }
    if (data.display_settings) {
      const d = data.display_settings
      setDisplaySettings(prev => ({
        ...prev,
        tip_enabled: d.tip_enabled === 1 || d.tip_enabled === true,
        tip_after_payment: d.tip_after_payment === 1 || d.tip_after_payment === true,
        tip_suggestions: (d.tip_suggestions || [15, 18, 20]).slice(0, 3),
        require_signature: d.signature_required === 1 ? 'required' : 'not_required',
        tip_custom_in_checkout: d.tip_custom_in_checkout === 1 || d.tip_custom_in_checkout === true,
        tip_allocation: d.tip_allocation === 'split_all' ? 'split_all' : 'logged_in_employee',
        tip_refund_from: d.tip_refund_from === 'employee' ? 'employee' : 'store'
      }))
      if (d.checkout_ui) setCheckoutUiSettings(mergeCheckoutUiFromApi(d.checkout_ui))
    }
    if (data.rewards_settings) {
      const s = data.rewards_settings
      setRewardsSettings({
        enabled: s.enabled === 1 || s.enabled === true,
        require_email: s.require_email === 1 || s.require_email === true,
        require_phone: s.require_phone === 1 || s.require_phone === true,
        require_both: s.require_both === 1 || s.require_both === true,
        reward_type: s.reward_type || 'points',
        points_enabled: s.points_enabled === 1 || s.points_enabled === true,
        percentage_enabled: s.percentage_enabled === 1 || s.percentage_enabled === true,
        fixed_enabled: s.fixed_enabled === 1 || s.fixed_enabled === true,
        points_per_dollar: s.points_per_dollar ?? 1.0,
        points_redemption_value: s.points_redemption_value ?? 0.01,
        percentage_discount: s.percentage_discount ?? 0.0,
        fixed_discount: s.fixed_discount ?? 0.0,
        minimum_spend: s.minimum_spend ?? 0.0,
        minimum_spend_points: s.minimum_spend_points ?? s.minimum_spend ?? 0.0,
        minimum_spend_percentage: s.minimum_spend_percentage ?? s.minimum_spend ?? 0.0,
        minimum_spend_fixed: s.minimum_spend_fixed ?? s.minimum_spend ?? 0.0
      })
    }
    if (data.pos_settings) {
      const mode = data.pos_settings.transaction_fee_mode || 'additional'
      const presets = Array.isArray(data.pos_settings.discount_presets) && data.pos_settings.discount_presets.length > 0
        ? data.pos_settings.discount_presets
        : DEFAULT_DISCOUNT_PRESETS
      setPosSettings({
        num_registers: data.pos_settings.num_registers || 1,
        register_type: data.pos_settings.register_type || 'one_screen',
        return_transaction_fee_take_loss: !!data.pos_settings.return_transaction_fee_take_loss,
        return_tip_refund: !!data.pos_settings.return_tip_refund,
        require_signature_for_return: !!data.pos_settings.require_signature_for_return,
        transaction_fee_mode: ['additional', 'included', 'none'].includes(mode) ? mode : 'additional',
        transaction_fee_charge_cash: !!data.pos_settings.transaction_fee_charge_cash,
        discount_presets: presets
      })
    }
    if (data.cash_settings) {
      const c = Array.isArray(data.cash_settings) ? data.cash_settings[0] : data.cash_settings
      if (c) setCashSettings({
        register_id: c.register_id || 1,
        cash_mode: c.cash_mode || 'total',
        total_amount: c.total_amount || 200.00,
        denominations: c.denominations || { '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0, '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0 }
      })
    }
    if (data.daily_count != null) setDailyCounts(data.daily_count)
    if (data.accounting_settings) {
      const d = data.accounting_settings
      if ('delivery_pay_on_delivery_cash_only' in d) setDeliveryPayOnDeliveryCashOnly(!!d.delivery_pay_on_delivery_cash_only)
      if ('allow_delivery' in d) setAllowDelivery(!!d.allow_delivery)
      if ('allow_pickup' in d) setAllowPickup(!!d.allow_pickup)
      if ('allow_pay_at_pickup' in d) setAllowPayAtPickup(!!d.allow_pay_at_pickup)
      if ('delivery_fee_enabled' in d) setDeliveryFeeEnabled(!!d.delivery_fee_enabled)
      if ('allow_scheduled_pickup' in d) setAllowScheduledPickup(!!d.allow_scheduled_pickup)
      if ('allow_scheduled_delivery' in d) setAllowScheduledDelivery(!!d.allow_scheduled_delivery)
    }
  }, [bootstrapSuccess, bootstrapData])

  useEffect(() => {
    if (!bootstrapError) return
    setLoading(true)
    Promise.allSettled([
      loadReceiptSettings(),
      loadReceiptTemplates(),
      loadStoreLocationSettings(),
      loadDisplaySettings(),
      loadRewardsSettings(),
      loadPosSettings(),
      loadEstablishmentSettings(),
      loadCashSettings(),
      loadDailyCounts()
    ]).finally(() => setLoading(false))
  }, [bootstrapError])

  useEffect(() => {
    setLoading(bootstrapLoading)
  }, [bootstrapLoading])

  useEffect(() => {
    if (activeTab === 'cash') {
      loadRegisterSessions()
      loadRegisterEvents()
    }
  }, [activeTab, cashSettings.register_id])

  useEffect(() => {
    if (activeTab === 'notifications') {
      cachedFetch('/api/notification-settings?store_id=1', { headers: { 'X-Session-Token': localStorage.getItem('sessionToken') || '' } })

        .then((r) => r.json())
        .then((data) => {
          if (data && data.success !== false) {
            setNotificationChannelSettings((prev) => ({
              ...prev,
              store_id: data.store_id ?? 1,
              email_provider: data.email_provider ?? 'gmail',
              sms_provider: data.sms_provider ?? 'email',
              smtp_server: data.smtp_server ?? 'smtp.gmail.com',
              smtp_port: data.smtp_port ?? 587,
              smtp_user: data.smtp_user ?? '',
              smtp_password: data.smtp_password ?? '',
              business_name: data.business_name ?? '',
              store_phone_number: data.store_phone_number ?? '',
              aws_access_key_id: data.aws_access_key_id ?? '',
              aws_secret_access_key: data.aws_secret_access_key ?? '',
              aws_region: data.aws_region ?? 'us-east-1',
              notification_preferences: {
                ...prev.notification_preferences,
                ...(data.notification_preferences || {})
              }
            }))
            // Sync orderEmailPrefs from loaded notification_preferences
            const op = (data?.notification_preferences?.orders) || {}

            setOrderEmailPrefs({
              email_enabled: op.email_enabled ?? op.email ?? false,
              source_filter: Array.isArray(op.source_filter) ? op.source_filter : (op.source_filter ? [op.source_filter] : ['all']),
              recipient_employee_ids: Array.isArray(op.recipient_employee_ids) ? op.recipient_employee_ids : []
            })
            // Fetch employees with email for recipient picker
            cachedFetch('/api/employees/with-email', { headers: { 'X-Session-Token': localStorage.getItem('sessionToken') || '' } })
              .then(r => r.json()).then(d => { if (Array.isArray(d)) setEmployeesWithEmail(d) }).catch(() => { })
          }
        })
        .catch(() => { })
      // Also load clockin notification settings
      cachedFetch('/api/clockin-notification-settings?store_id=1', { headers: { 'X-Session-Token': localStorage.getItem('sessionToken') || '' } })
        .then(r => r.json())
        .then(d => { if (d && d.success && d.data) setClockinNotifSettings(prev => ({ ...prev, ...d.data })) })
        .catch(() => { })
      // Load schedule notification settings
      cachedFetch('/api/schedule-notification-settings?store_id=1', { headers: { 'X-Session-Token': localStorage.getItem('sessionToken') || '' } })
        .then(r => r.json())
        .then(d => { if (d && d.success && d.data) setScheduleNotifSettings(prev => ({ ...prev, ...d.data })) })
        .catch(() => { })
      // Load register notification settings
      cachedFetch('/api/register-notification-settings?store_id=1', { headers: { 'X-Session-Token': localStorage.getItem('sessionToken') || '' } })
        .then(r => r.json())
        .then(d => { if (d && d.success && d.data) setRegisterNotifSettings(prev => ({ ...prev, ...d.data })) })
        .catch(() => { })
      const token = localStorage.getItem('sessionToken') || ''
      cachedFetch(`/api/email-templates?store_id=1&session_token=${encodeURIComponent(token)}`, { headers: { 'X-Session-Token': token } })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.templates) setEmailTemplates(data.templates)
        })
        .catch(() => { })
    }
  }, [activeTab])

  // Refetch email templates when modal opens; seed receipt presets if fewer than 2
  useEffect(() => {
    if (!emailTemplateModalOpen) return
    setEmailTemplateUndoStack([])
    setEmailTemplateRedoStack([])
    const token = localStorage.getItem('sessionToken') || ''
    const refetch = () => cachedFetch(`/api/email-templates?store_id=1&session_token=${encodeURIComponent(token)}`, { headers: { 'X-Session-Token': token } }).then((r) => r.json()).then((d) => { if (d?.templates) setEmailTemplates(d.templates) }).catch(() => { })
    cachedFetch(`/api/email-templates?store_id=1&session_token=${encodeURIComponent(token)}`, { headers: { 'X-Session-Token': token } })
      .then((r) => r.json())
      .then((d) => {
        const templates = d?.templates || []
        const receiptCount = templates.filter((t) => t.category === 'receipt').length
        if (receiptCount < 2) {
          cachedFetch('/api/email-templates/seed-receipt-presets', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Token': token }, body: JSON.stringify({ store_id: 1 }) }).then(() => refetch()).catch(() => refetch())
        } else {
          setEmailTemplates(templates)
        }
      })
      .catch(() => { })
  }, [emailTemplateModalOpen])

  const pushEmailTemplateUndo = () => {
    if (emailTemplateRestoringRef.current) return
    setEmailTemplateUndoStack((u) => [...u, { rd: JSON.parse(JSON.stringify(emailReceiptDesign)), od: JSON.parse(JSON.stringify(emailOrderDesign)), f: JSON.parse(JSON.stringify(emailTemplateForm)) }])
    setEmailTemplateRedoStack([])
  }
  const handleEmailTemplateUndo = () => {
    if (emailTemplateUndoStack.length === 0) return
    const toRestore = emailTemplateUndoStack[emailTemplateUndoStack.length - 1]
    emailTemplateRestoringRef.current = true
    setEmailTemplateRedoStack((r) => [...r, { rd: JSON.parse(JSON.stringify(emailReceiptDesign)), od: JSON.parse(JSON.stringify(emailOrderDesign)), f: JSON.parse(JSON.stringify(emailTemplateForm)) }])
    setEmailReceiptDesign(toRestore.rd)
    setEmailOrderDesign(toRestore.od)
    setEmailTemplateForm(toRestore.f)
    setEmailTemplateUndoStack((u) => u.slice(0, -1))
    setTimeout(() => { emailTemplateRestoringRef.current = false }, 0)
  }
  const handleEmailTemplateRedo = () => {
    if (emailTemplateRedoStack.length === 0) return
    const toRestore = emailTemplateRedoStack[emailTemplateRedoStack.length - 1]
    emailTemplateRestoringRef.current = true
    setEmailTemplateUndoStack((u) => [...u, { rd: JSON.parse(JSON.stringify(emailReceiptDesign)), od: JSON.parse(JSON.stringify(emailOrderDesign)), f: JSON.parse(JSON.stringify(emailTemplateForm)) }])
    setEmailReceiptDesign(toRestore.rd)
    setEmailOrderDesign(toRestore.od)
    setEmailTemplateForm(toRestore.f)
    setEmailTemplateRedoStack((r) => r.slice(0, -1))
    setTimeout(() => { emailTemplateRestoringRef.current = false }, 0)
  }

  // Auto-select first template when modal opens or category has templates but none selected. For order with no templates, default to App Notification preset.
  useEffect(() => {
    if (!emailTemplateModalOpen || emailTemplateEditing !== null) return
    const templates = emailTemplates.filter((t) => t.category === emailTemplateCategory)
    const first = templates.find((t) => t.is_default) || templates[0]
    if (emailTemplateCategory === 'order' && !first) {
      const p = { name: 'Order Alert (App Notification)', subj: 'New order #{{order_number}}', html: LA_MAISON_ORDER_APP_NOTIFICATION_HTML, txt: 'New order #{{order_number}}\nTotal: ${{total}}\n{{store_name}}\n{{store_tagline}}\n{{store_address}}\n{{store_phone}}' }
      setEmailOrderPreset('appNotification')
      setEmailTemplateForm({ name: p.name, category: 'order', subject_template: p.subj, body_html_template: p.html, body_text_template: p.txt })
      setEmailTemplateEditMode('visual')
      setActiveEmailOrderSection('header')
      setEmailOrderDesign({ store_name: receiptSettings.store_name || storeLocationSettings.store_name || '', store_tagline: receiptSettings.store_tagline || '', store_address: receiptSettings.store_address || storeLocationSettings.address || '', store_phone: receiptSettings.store_phone || storeLocationSettings.store_phone || '', store_email: receiptSettings.store_email || storeLocationSettings.store_email || '', footer_message: receiptSettings.footer_message || '' })
      return
    }
    if (!first) return
    setEmailTemplateEditing(first.id)
    setEmailTemplateForm({ name: first.name, category: first.category, subject_template: first.subject_template || '', body_html_template: first.body_html_template || '', body_text_template: first.body_text_template || '' })
    if (first.category === 'receipt') {
      setEmailTemplateEditMode('visual')
      setActiveEmailReceiptSection('header')
      const savedDesign = first.variables?.receiptDesign
      setEmailReceiptDesign(savedDesign ? { ...DEFAULT_RECEIPT_TEMPLATE, ...receiptSettings, ...savedDesign, headerBg: savedDesign.headerBg || '#1e293b', headerTextColor: savedDesign.headerTextColor || '#ffffff', footerBg: savedDesign.footerBg || '#f8fafc', footerTextColor: savedDesign.footerTextColor || '#64748b' } : { ...DEFAULT_RECEIPT_TEMPLATE, ...receiptSettings, headerBg: '#1e293b', headerTextColor: '#ffffff', footerBg: '#f8fafc', footerTextColor: '#64748b' })
    } else if (['order', 'schedule', 'clockin', 'report'].includes(first.category)) {
      setEmailTemplateEditMode('visual')
      setActiveEmailOrderSection('header')
      const saved = first.variables?.orderDesign
      const base = { store_name: receiptSettings.store_name || storeLocationSettings.store_name || '', store_tagline: receiptSettings.store_tagline || '', store_address: receiptSettings.store_address || storeLocationSettings.address || '', store_phone: receiptSettings.store_phone || storeLocationSettings.store_phone || '', store_email: receiptSettings.store_email || storeLocationSettings.store_email || '', footer_message: receiptSettings.footer_message || '' }
      setEmailOrderDesign(saved ? { ...base, ...saved } : base)
    } else {
      setEmailTemplateEditMode('html')
    }
  }, [emailTemplateModalOpen, emailTemplateCategory, emailTemplateEditing, emailTemplates, receiptSettings, storeLocationSettings])

  useEffect(() => {
    if (emailTemplateShowNewInput && emailTemplateNewInputRef.current) {
      emailTemplateNewInputRef.current.focus()
    }
  }, [emailTemplateShowNewInput])

  useEffect(() => {
    if (!emailTemplateDropdownOpen) {
      setEmailTemplateShowNewInput(false)
      setEmailTemplateNewName('')
      setEmailTemplateCreatePreset(null)
    }
  }, [emailTemplateDropdownOpen])

  useEffect(() => {
    if (!emailTemplateDropdownOpen) return
    const handleClick = (e) => {
      if (emailTemplateDropdownRef.current && !emailTemplateDropdownRef.current.contains(e.target)) {
        setEmailTemplateDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [emailTemplateDropdownOpen])

  // Refetch register data when user returns to this tab (e.g. after processing a cash sale on POS)
  useEffect(() => {
    if (activeTab !== 'cash') return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadRegisterSessions()
        loadRegisterEvents()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [activeTab])

  // Ensure selected register_id exists in registers list
  useEffect(() => {
    if (registers.length > 0 && !registers.find(r => r.id === cashSettings.register_id)) {
      setCashSettings({ ...cashSettings, register_id: registers[0].id })
    }
  }, [registers])

  // Close delete-register dropdown on click outside
  useEffect(() => {
    if (!registerToDelete) return
    const handleClick = (e) => {
      if (e.target.closest('[data-register-delete-area]')) return
      setRegisterToDelete(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [registerToDelete])

  // Close register menu (ellipsis dropdown) on click outside
  useEffect(() => {
    if (registerMenuOpenId == null) return
    const handleClick = (e) => {
      if (e.target.closest('[data-register-menu-area]')) return
      setRegisterMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [registerMenuOpenId])

  const loadReceiptSettings = async () => {
    try {
      const response = await cachedFetch('/api/receipt-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        const s = data.settings
        const templateStyles = s.template_styles && typeof s.template_styles === 'object' ? s.template_styles : {}
        const preset = s.template_preset ?? templateStyles.template_preset ?? 'custom'
        // If template_styles is empty but preset is modern/classic/minimal, apply preset styling so preview matches dropdown
        const hasSavedStyles = Object.keys(templateStyles).length > 5
        const baseStyles = (preset && RECEIPT_PRESETS[preset] && !hasSavedStyles)
          ? { ...RECEIPT_PRESETS[preset] }
          : { ...DEFAULT_RECEIPT_TEMPLATE, ...templateStyles }
        setReceiptSettings({
          ...baseStyles,
          receipt_type: s.receipt_type || 'traditional',
          template_preset: preset,
          store_name: s.store_name ?? 'Store',
          store_address: s.store_address ?? '',
          store_city: s.store_city ?? '',
          store_state: s.store_state ?? '',
          store_zip: s.store_zip ?? '',
          store_phone: s.store_phone ?? '',
          store_email: s.store_email ?? '',
          store_website: s.store_website ?? '',
          footer_message: s.footer_message ?? 'Thank you for your business!',
          return_policy: s.return_policy ?? '',
          show_tax_breakdown: s.show_tax_breakdown === 1,
          show_payment_method: s.show_payment_method === 1,
          show_signature: s.show_signature === 1
        })
      }
    } catch (error) {
      console.error('Error loading receipt settings:', error)
    }
  }

  const loadReceiptTemplates = async () => {
    try {
      const response = await cachedFetch('/api/receipt-templates')
      const data = await response.json()
      if (data.success && data.templates) {
        setSavedTemplates(data.templates)
      }
    } catch (error) {
      console.error('Error loading receipt templates:', error)
    }
  }

  const clearReceiptTemplates = async () => {
    if (!window.confirm('Clear all saved receipt templates? This cannot be undone.')) return
    try {
      const response = await fetch('/api/receipt-templates/clear', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        await loadReceiptTemplates()
        setReceiptSettings(prev => ({ ...prev, template_preset: prev.template_preset?.startsWith('template_') ? 'modern' : prev.template_preset }))
        setMessage({ type: 'success', text: `Cleared ${data.deleted || 0} template(s).` })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to clear templates' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Failed to clear templates' })
    }
  }

  const createReceiptTemplate = async () => {
    const name = window.prompt('Name your template')
    if (!name || !name.trim()) return
    try {
      const response = await fetch('/api/receipt-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), settings: receiptSettings })
      })
      const data = await response.json()
      if (data.success && data.template) {
        await loadReceiptTemplates()
        setReceiptSettings(prev => ({ ...prev, template_preset: `template_${data.template.id}` }))
        setMessage({ type: 'success', text: `Template "${data.template.name}" saved.` })
        setTimeout(() => setMessage(null), 2500)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save template' })
      }
    } catch (error) {
      console.error('Error saving template:', error)
      setMessage({ type: 'error', text: 'Failed to save template' })
    }
  }

  const resetReceiptToDefault = () => {
    setReceiptSettings({ ...DEFAULT_RECEIPT_TEMPLATE })
    setMessage({ type: 'success', text: 'Receipt template reset to default.' })
    setTimeout(() => setMessage(null), 2500)
  }

  const saveReceiptSettingsOnly = async (settings) => {
    try {
      const res = await fetch('/api/receipt-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          receipt_type: settings.receipt_type || 'traditional',
          return_policy: settings.return_policy || '',
          show_tax_breakdown: settings.show_tax_breakdown ? 1 : 0,
          show_payment_method: settings.show_payment_method ? 1 : 0,
          show_signature: settings.show_signature ? 1 : 0,
          show_tip: settings.show_tip !== false ? 1 : 0
        })
      })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Receipt template saved.' })
        setTimeout(() => setMessage(null), 2000)
      }
    } catch (e) {
      console.error('Error saving receipt settings:', e)
    }
  }

  const printTestReceipt = async () => {
    try {
      const response = await fetch('/api/receipt/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: receiptSettings })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        setMessage?.({ type: 'error', text: err.message || 'Failed to generate receipt' })
        return
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'receipt_test.pdf'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)
      setMessage?.({ type: 'success', text: 'Receipt downloaded.' })
      setTimeout(() => setMessage?.(null), 2000)
    } catch (e) {
      setMessage?.({ type: 'error', text: e.message || 'Failed to generate receipt' })
    }
  }

  const applyTemplatePreset = async (preset) => {
    const base = RECEIPT_PRESETS[preset] || DEFAULT_RECEIPT_TEMPLATE
    const next = { ...base, template_preset: preset, store_name: receiptSettings.store_name, store_address: receiptSettings.store_address, store_phone: receiptSettings.store_phone, footer_message: receiptSettings.footer_message, return_policy: receiptSettings.return_policy, store_email: receiptSettings.store_email, store_website: receiptSettings.store_website }
    setReceiptSettings(next)
    await saveReceiptSettingsOnly(next)
  }

  const loadStoreLocationSettings = async () => {
    try {
      const response = await cachedFetch('/api/store-location-settings')
      if (!response.ok) {
        console.warn('Store location settings not available:', response.status)
        return
      }
      const data = await response.json()
      if (data.success && data.settings) {
        const defaultStoreHours = {
          monday: { open: '09:00', close: '17:00', closed: false },
          tuesday: { open: '09:00', close: '17:00', closed: false },
          wednesday: { open: '09:00', close: '17:00', closed: false },
          thursday: { open: '09:00', close: '17:00', closed: false },
          friday: { open: '09:00', close: '17:00', closed: false },
          saturday: { open: '09:00', close: '17:00', closed: false },
          sunday: { open: '09:00', close: '17:00', closed: false }
        }
        setStoreLocationSettings({
          store_name: 'Store',
          store_type: '',
          store_logo: '',
          store_phone: '',
          store_email: '',
          store_website: '',
          address: '',
          city: '',
          state: '',
          country: '',
          zip: '',
          latitude: null,
          longitude: null,
          allowed_radius_meters: 100.0,
          require_location: true,
          store_hours: defaultStoreHours,
          ...data.settings,
          require_location: data.settings.require_location === 1 || data.settings.require_location === true,
          store_hours: data.settings.store_hours ? { ...defaultStoreHours, ...data.settings.store_hours } : defaultStoreHours
        })
        storeLocationLoadedRef.current = true
        // Keep receipt state in sync with store info so Receipt Template shows it
        setReceiptSettings(prev => ({
          ...prev,
          store_name: data.settings.store_name ?? prev.store_name,
          store_address: data.settings.address ?? prev.store_address,
          store_city: data.settings.city ?? prev.store_city,
          store_state: data.settings.state ?? prev.store_state,
          store_zip: data.settings.zip ?? prev.store_zip,
          store_phone: data.settings.store_phone ?? prev.store_phone,
          store_email: data.settings.store_email ?? prev.store_email,
          store_website: data.settings.store_website ?? prev.store_website
        }))
      }
    } catch (error) {
      console.error('Error loading store location settings:', error)
    }
  }

  const loadDisplaySettings = async () => {
    try {
      const response = await cachedFetch('/api/customer-display/settings')
      const data = await response.json()
      if (data.success) {
        setDisplaySettings(prev => ({
          ...prev,
          tip_enabled: data.data.tip_enabled === 1 || data.data.tip_enabled === true,
          tip_after_payment: data.data.tip_after_payment === 1 || data.data.tip_after_payment === true,
          tip_suggestions: (data.data.tip_suggestions || [15, 18, 20]).slice(0, 3),
          require_signature: data.data.signature_required === 1 ? 'required' : 'not_required',
          tip_custom_in_checkout: data.data.tip_custom_in_checkout === 1 || data.data.tip_custom_in_checkout === true,
          tip_allocation: data.data.tip_allocation === 'split_all' ? 'split_all' : 'logged_in_employee',
          tip_refund_from: data.data.tip_refund_from === 'employee' ? 'employee' : 'store'
        }))
        setCheckoutUiSettings(mergeCheckoutUiFromApi(data.data.checkout_ui))
      }
    } catch (error) {
      console.error('Error loading display settings:', error)
    }
  }

  const loadRewardsSettings = async () => {
    try {
      const response = await cachedFetch('/api/customer-rewards-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        const s = data.settings
        setRewardsSettings({
          enabled: s.enabled === 1 || s.enabled === true,
          require_email: s.require_email === 1 || s.require_email === true,
          require_phone: s.require_phone === 1 || s.require_phone === true,
          require_both: s.require_both === 1 || s.require_both === true,
          reward_type: s.reward_type || 'points',
          points_enabled: s.points_enabled === 1 || s.points_enabled === true,
          percentage_enabled: s.percentage_enabled === 1 || s.percentage_enabled === true,
          fixed_enabled: s.fixed_enabled === 1 || s.fixed_enabled === true,
          points_per_dollar: s.points_per_dollar ?? 1.0,
          points_redemption_value: s.points_redemption_value ?? 0.01,
          percentage_discount: s.percentage_discount ?? 0.0,
          fixed_discount: s.fixed_discount ?? 0.0,
          minimum_spend: s.minimum_spend ?? 0.0,
          minimum_spend_points: s.minimum_spend_points ?? s.minimum_spend ?? 0.0,
          minimum_spend_percentage: s.minimum_spend_percentage ?? s.minimum_spend ?? 0.0,
          minimum_spend_fixed: s.minimum_spend_fixed ?? s.minimum_spend ?? 0.0
        })
      }
    } catch (error) {
      console.error('Error loading rewards settings:', error)
    }
  }

  const loadPosSettings = async () => {
    try {
      const response = await cachedFetch('/api/pos-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        const mode = data.settings.transaction_fee_mode || 'additional'
        const presets = Array.isArray(data.settings.discount_presets) && data.settings.discount_presets.length > 0
          ? data.settings.discount_presets
          : DEFAULT_DISCOUNT_PRESETS
        setPosSettings({
          num_registers: data.settings.num_registers || 1,
          register_type: data.settings.register_type || 'one_screen',
          return_transaction_fee_take_loss: !!data.settings.return_transaction_fee_take_loss,
          return_tip_refund: !!data.settings.return_tip_refund,
          require_signature_for_return: !!data.settings.require_signature_for_return,
          transaction_fee_mode: ['additional', 'included', 'none'].includes(mode) ? mode : 'additional',
          transaction_fee_charge_cash: !!data.settings.transaction_fee_charge_cash,
          discount_presets: presets
        })
      }
    } catch (error) {
      console.error('Error loading POS settings:', error)
    }
  }

  const loadCashSettings = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await cachedFetch(`/api/register/cash-settings?register_id=${cashSettings.register_id}&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data) {
        if (Array.isArray(data.data) && data.data.length > 0) {
          setCashSettings({
            register_id: data.data[0].register_id || 1,
            cash_mode: data.data[0].cash_mode || 'total',
            total_amount: data.data[0].total_amount || 200.00,
            denominations: data.data[0].denominations || {
              '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
            }
          })
        } else if (!Array.isArray(data.data)) {
          setCashSettings({
            register_id: data.data.register_id || 1,
            cash_mode: data.data.cash_mode || 'total',
            total_amount: data.data.total_amount || 200.00,
            denominations: data.data.denominations || {
              '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
            }
          })
        }
      }
    } catch (error) {
      console.error('Error loading cash settings:', error)
    }
  }

  const saveCashSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const payload = {
        session_token: sessionToken,
        register_id: cashSettings.register_id,
        cash_mode: cashSettings.cash_mode,
        total_amount: cashSettings.cash_mode === 'total' ? parseFloat(cashSettings.total_amount) : null,
        denominations: cashSettings.cash_mode === 'denominations' ? cashSettings.denominations : null
      }

      const response = await fetch('/api/register/cash-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Cash settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
        loadCashSettings()
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save cash settings' })
      }
    } catch (error) {
      console.error('Error saving cash settings:', error)
      setMessage({ type: 'error', text: 'Failed to save cash settings' })
    } finally {
      setSaving(false)
    }
  }

  const loadDailyCounts = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const today = new Date().toISOString().split('T')[0]
      const response = await cachedFetch(`/api/register/daily-count?count_date=${today}&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data) {
        setDailyCounts(data.data)
      }
    } catch (error) {
      console.error('Error loading daily counts:', error)
    }
  }

  const handleCountDrop = async () => {
    setSaving(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      // Calculate drop amount from denominations if in denominations mode
      let dropAmount = parseFloat(dailyCount.total_amount) || 0
      if (dailyCount.denominations) {
        const calculated = Object.entries(dailyCount.denominations).reduce((sum, [denom, count]) => {
          return sum + (parseFloat(denom) * parseInt(count || 0))
        }, 0)
        if (calculated > 0) {
          dropAmount = calculated
        }
      }

      // Calculate adjustment amount
      let adjustmentAmount = 0
      if (dailyCount.adjustment_type === 'add') {
        adjustmentAmount = dailyCount.adjustment_mode === 'total'
          ? parseFloat(dailyCount.adjustment_amount) || 0
          : calculateTotalFromDenominations(dailyCount.adjustment_denominations)
      } else if (dailyCount.adjustment_type === 'take_out') {
        adjustmentAmount = -(dailyCount.adjustment_mode === 'total'
          ? parseFloat(dailyCount.adjustment_amount) || 0
          : calculateTotalFromDenominations(dailyCount.adjustment_denominations))
      }

      // Final drop amount = drop amount + adjustment
      const finalDropAmount = dropAmount + adjustmentAmount

      const payload = {
        session_token: sessionToken,
        register_id: dailyCount.register_id,
        count_date: dailyCount.count_date,
        count_type: 'drop',
        total_amount: finalDropAmount,
        denominations: dailyCount.denominations,
        notes: dailyCount.notes
      }

      const response = await fetch('/api/register/daily-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        setToast({ message: 'Cash drop saved successfully!', type: 'success' })
        setShowCountDropModal(false)
        // Reset form
        setDailyCount({
          register_id: cashSettings.register_id,
          count_date: new Date().toISOString().split('T')[0],
          count_type: 'drop',
          total_amount: 0,
          denominations: {
            '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
            '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
          },
          adjustment_type: 'none',
          adjustment_mode: 'total',
          adjustment_amount: 0,
          adjustment_denominations: {
            '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
            '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
          },
          notes: ''
        })
        // Reload events to update the table
        await loadRegisterEvents()
      } else {
        setToast({ message: data.message || 'Failed to save cash drop', type: 'error' })
      }
    } catch (error) {
      console.error('Error saving cash drop:', error)
      setToast({ message: 'Failed to save cash drop', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const calculateTotalFromDenominations = (denoms) => {
    return Object.entries(denoms).reduce((sum, [denom, count]) => {
      return sum + (parseFloat(denom) * parseInt(count || 0))
    }, 0)
  }

  const loadRegisterSessions = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/register/session?register_id=${cashSettings.register_id}&status=open&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data) {
        const sessions = Array.isArray(data.data) ? data.data : [data.data]
        setRegisterSessions(sessions)
        if (sessions.length > 0) {
          setCurrentSession(sessions[0])
        } else {
          setCurrentSession(null)
        }
      }

      // Load last closed session to show expected amount when opening
      const closedResponse = await fetch(`/api/register/session?register_id=${cashSettings.register_id}&status=closed&session_token=${sessionToken}`)
      const closedData = await closedResponse.json()
      if (closedData.success && closedData.data) {
        const closedSessions = Array.isArray(closedData.data) ? closedData.data : [closedData.data]
        if (closedSessions.length > 0) {
          // Get the most recent closed session
          const lastClosed = closedSessions.sort((a, b) =>
            new Date(b.closed_at || 0) - new Date(a.closed_at || 0)
          )[0]
          setLastClosedSession(lastClosed)
        } else {
          setLastClosedSession(null)
        }
      }

      // Always load events regardless of session status
      await loadRegisterEvents()
    } catch (error) {
      console.error('Error loading register sessions:', error)
    }
  }

  const loadRegisterEvents = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await cachedFetch(`/api/register/events?register_id=${cashSettings.register_id}&limit=100&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data) {
        // Map events to transaction format for the table
        const events = data.data.map(event => ({
          transaction_id: event.event_id,
          transaction_type: event.event_type,
          amount: parseFloat(event.amount) || 0,
          timestamp: event.timestamp,
          employee_id: event.employee_id,
          employee_name: event.employee_name,
          notes: event.notes || ''
        }))

        setRegisterTransactions(events.sort((a, b) =>
          new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        ))
      }
    } catch (error) {
      console.error('Error loading register events:', error)
    }
  }

  const handleOpenRegister = async () => {
    setSaving(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      // Calculate expected amount from last closed session
      const expectedAmount = parseFloat(lastClosedSession?.ending_cash) || 0

      // Calculate adjustment amount
      let adjustmentAmount = 0
      if (openRegisterForm.adjustment_type === 'add') {
        adjustmentAmount = openRegisterForm.adjustment_mode === 'total'
          ? parseFloat(openRegisterForm.adjustment_amount) || 0
          : calculateTotalFromDenominations(openRegisterForm.adjustment_denominations)
      } else if (openRegisterForm.adjustment_type === 'take_out') {
        adjustmentAmount = -(openRegisterForm.adjustment_mode === 'total'
          ? parseFloat(openRegisterForm.adjustment_amount) || 0
          : calculateTotalFromDenominations(openRegisterForm.adjustment_denominations))
      }

      // Starting cash = expected + adjustment
      const startingCash = expectedAmount + adjustmentAmount

      const payload = {
        session_token: sessionToken,
        register_id: openRegisterForm.register_id,
        starting_cash: startingCash,
        notes: openRegisterForm.notes
      }

      const response = await fetch('/api/register/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        setToast({ message: data.message || 'Register opened successfully!', type: 'success' })
        setShowOpenModal(false)
        setOpenRegisterForm({
          register_id: cashSettings.register_id,
          cash_mode: 'total',
          total_amount: 0,
          denominations: {
            '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
            '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
          },
          adjustment_type: 'none',
          adjustment_mode: 'total',
          adjustment_amount: 0,
          adjustment_denominations: {
            '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
            '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
          },
          expected_amount: 0,
          notes: ''
        })
        // Reload sessions and events to update the table
        await loadRegisterSessions()
      } else {
        setToast({ message: data.message || 'Failed to open register', type: 'error' })
      }
    } catch (error) {
      console.error('Error opening register:', error)
      setToast({ message: 'Failed to open register', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleCloseRegister = async () => {
    if (!currentSession) return

    setSaving(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')

      // Calculate expected cash
      const expectedCash = calculateExpectedCash()

      // Calculate actual counted cash
      const actualCash = closeRegisterForm.cash_mode === 'total'
        ? parseFloat(closeRegisterForm.total_amount) || 0
        : calculateTotalFromDenominations(closeRegisterForm.denominations)

      // Calculate adjustment amount
      let adjustmentAmount = 0
      if (closeRegisterForm.adjustment_type === 'add') {
        adjustmentAmount = closeRegisterForm.adjustment_mode === 'total'
          ? parseFloat(closeRegisterForm.adjustment_amount) || 0
          : calculateTotalFromDenominations(closeRegisterForm.adjustment_denominations)
      } else if (closeRegisterForm.adjustment_type === 'take_out') {
        adjustmentAmount = -(closeRegisterForm.adjustment_mode === 'total'
          ? parseFloat(closeRegisterForm.adjustment_amount) || 0
          : calculateTotalFromDenominations(closeRegisterForm.adjustment_denominations))
      }

      // Ending cash = actual counted + adjustment
      const endingCash = actualCash + adjustmentAmount

      const payload = {
        session_token: sessionToken,
        session_id: currentSession.register_session_id || currentSession.session_id,
        ending_cash: endingCash,
        notes: closeRegisterForm.notes
      }

      const response = await fetch('/api/register/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        setToast({ message: data.message || 'Register closed successfully!', type: 'success' })
        setShowCloseModal(false)
        setCloseRegisterForm({
          cash_mode: 'total',
          total_amount: 0,
          denominations: {
            '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
            '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
          },
          adjustment_type: 'none',
          adjustment_mode: 'total',
          adjustment_amount: 0,
          adjustment_denominations: {
            '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
            '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
          },
          notes: ''
        })
        // Reload sessions and events to update the table with close row
        await loadRegisterSessions()
      } else {
        setToast({ message: data.message || 'Failed to close register', type: 'error' })
      }
    } catch (error) {
      console.error('Error closing register:', error)
      setToast({ message: 'Failed to close register', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTakeOutMoney = async () => {
    setSaving(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const payload = {
        session_token: sessionToken,
        session_id: currentSession ? (currentSession.register_session_id || currentSession.session_id) : null,
        transaction_type: 'cash_out',
        amount: parseFloat(takeOutForm.amount) || 0,
        reason: takeOutForm.reason,
        notes: takeOutForm.notes
      }

      const response = await fetch('/api/register/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        setToast({ message: 'Money taken out successfully!', type: 'success' })
        setShowTakeOutModal(false)
        setTakeOutForm({
          amount: 0,
          reason: '',
          notes: ''
        })
        // Reload events to update the table
        await loadRegisterEvents()
      } else {
        setToast({ message: data.message || 'Failed to take out money', type: 'error' })
      }
    } catch (error) {
      console.error('Error taking out money:', error)
      setToast({ message: 'Failed to take out money', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const calculateExpectedCash = () => {
    if (!currentSession) return 0
    // Use backend-computed expected_cash when available (includes cash sales + cash_in - cash_out)
    if (currentSession.expected_cash != null && currentSession.expected_cash !== undefined) {
      return parseFloat(currentSession.expected_cash) || 0
    }
    let expected = parseFloat(currentSession?.starting_cash) || 0
    registerTransactions.forEach(t => {
      if (t.transaction_type === 'cash_in') {
        expected += parseFloat(t.amount || 0)
      } else if (t.transaction_type === 'cash_out' || t.transaction_type === 'take_out' || t.transaction_type === 'drop') {
        expected -= parseFloat(t.amount || 0)
      }
    })
    return expected
  }

  const saveRewardsSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/customer-rewards-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify({
          session_token: sessionToken,
          enabled: 1,
          require_email: rewardsSettings.require_email ? 1 : 0,
          require_phone: rewardsSettings.require_phone ? 1 : 0,
          require_both: rewardsSettings.require_both ? 1 : 0,
          reward_type: rewardsSettings.reward_type || 'points',
          points_per_dollar: parseFloat(rewardsSettings.points_per_dollar) || 1.0,
          points_redemption_value: parseFloat(rewardsSettings.points_redemption_value) ?? 0.01,
          percentage_discount: parseFloat(rewardsSettings.percentage_discount) || 0.0,
          fixed_discount: parseFloat(rewardsSettings.fixed_discount) || 0.0,
          minimum_spend: parseFloat(rewardsSettings.minimum_spend) || 0.0,
          minimum_spend_points: parseFloat(rewardsSettings.minimum_spend_points) || 0.0,
          minimum_spend_percentage: parseFloat(rewardsSettings.minimum_spend_percentage) || 0.0,
          minimum_spend_fixed: parseFloat(rewardsSettings.minimum_spend_fixed) || 0.0
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Customer rewards settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save rewards settings' })
      }
    } catch (error) {
      console.error('Error saving rewards settings:', error)
      setMessage({ type: 'error', text: 'Failed to save rewards settings' })
    } finally {
      setSaving(false)
    }
  }

  const savePosSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      // Save POS settings
      const posResponse = await fetch('/api/pos-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          num_registers: parseInt(posSettings.num_registers) || 1,
          register_type: posSettings.register_type || 'one_screen',
          return_transaction_fee_take_loss: !!posSettings.return_transaction_fee_take_loss,
          return_tip_refund: !!posSettings.return_tip_refund,
          require_signature_for_return: !!posSettings.require_signature_for_return,
          transaction_fee_mode: posSettings.transaction_fee_mode || 'additional',
          transaction_fee_charge_cash: !!posSettings.transaction_fee_charge_cash,
          discount_presets: Array.isArray(posSettings.discount_presets) ? posSettings.discount_presets : []
        })
      })

      const posData = await posResponse.json()

      // Save display settings (checkout UI only; tips/signature are managed in Accounting → Settings)
      const sessionToken = localStorage.getItem('sessionToken')
      const displayResponse = await fetch('/api/customer-display/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          checkout_ui: checkoutUiSettings
        })
      })

      const displayData = await displayResponse.json()

      // Save receipt settings
      const receiptResponse = await fetch('/api/receipt-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...receiptSettings,
          receipt_type: receiptSettings.receipt_type || 'traditional',
          return_policy: receiptSettings.return_policy || '',
          show_tax_breakdown: receiptSettings.show_tax_breakdown ? 1 : 0,
          show_payment_method: receiptSettings.show_payment_method ? 1 : 0,
          show_signature: receiptSettings.show_signature ? 1 : 0,
          show_tip: receiptSettings.show_tip !== false ? 1 : 0  // integer for DB
        })
      })

      const receiptData = await receiptResponse.json()

      if (posData.success && displayData.success && receiptData.success) {
        setMessage({ type: 'success', text: 'POS settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: posData.message || displayData.message || receiptData.message || 'Failed to save POS settings' })
      }
    } catch (error) {
      console.error('Error saving POS settings:', error)
      setMessage({ type: 'error', text: 'Failed to save POS settings' })
    } finally {
      setSaving(false)
    }
  }

  const saveDisplaySettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/customer-display/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          tip_enabled: displaySettings.tip_enabled ? 1 : 0,
          tip_after_payment: displaySettings.tip_after_payment ? 1 : 0,
          tip_suggestions: displaySettings.tip_suggestions,
          signature_required: displaySettings.require_signature === 'required' ? 1 : 0,
          tip_custom_in_checkout: displaySettings.tip_custom_in_checkout,
          tip_allocation: displaySettings.tip_allocation,
          tip_refund_from: displaySettings.tip_refund_from
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Display settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save display settings' })
      }
    } catch (error) {
      console.error('Error saving display settings:', error)
      setMessage({ type: 'error', text: 'Failed to save display settings' })
    } finally {
      setSaving(false)
    }
  }

  const saveStoreLocationSettings = async (isAutoSave = false) => {
    if (!isAutoSave) {
      setSaving(true)
      setMessage(null)
    }
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/store-location-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        body: JSON.stringify({
          session_token: token,
          ...storeLocationSettings,
          require_location: storeLocationSettings.require_location ? 1 : 0
        })
      })

      const data = await response.json()
      if (data.success) {
        setReceiptSettings(prev => ({
          ...prev,
          store_name: storeLocationSettings.store_name ?? prev.store_name,
          store_address: storeLocationSettings.address ?? prev.store_address,
          store_city: storeLocationSettings.city ?? prev.store_city,
          store_state: storeLocationSettings.state ?? prev.store_state,
          store_zip: storeLocationSettings.zip ?? prev.store_zip,
          store_phone: storeLocationSettings.store_phone ?? prev.store_phone,
          store_email: storeLocationSettings.store_email ?? prev.store_email,
          store_website: storeLocationSettings.store_website ?? prev.store_website
        }))
        if (!isAutoSave) {
          setMessage({ type: 'success', text: 'Store location settings saved successfully!' })
          setTimeout(() => setMessage(null), 3000)
        }
      } else {
        if (!isAutoSave) setMessage({ type: 'error', text: data.message || 'Failed to save store location settings' })
      }
    } catch (error) {
      console.error('Error saving store location settings:', error)
      if (!isAutoSave) setMessage({ type: 'error', text: 'Failed to save store location settings' })
    } finally {
      if (!isAutoSave) setSaving(false)
    }
  }

  // Sync store info into receipt state so receipt form and preview show store data
  const syncStoreInfoToReceipt = () => {
    setReceiptSettings(prev => ({
      ...prev,
      store_name: storeLocationSettings.store_name ?? prev.store_name,
      store_address: storeLocationSettings.address ?? prev.store_address,
      store_city: storeLocationSettings.city ?? prev.store_city,
      store_state: storeLocationSettings.state ?? prev.store_state,
      store_zip: storeLocationSettings.zip ?? prev.store_zip,
      store_phone: storeLocationSettings.store_phone ?? prev.store_phone,
      store_email: storeLocationSettings.store_email ?? prev.store_email,
      store_website: storeLocationSettings.store_website ?? prev.store_website
    }))
  }

  useEffect(() => {
    if (!storeLocationLoadedRef.current) return
    if (storeLocationSaveTimeoutRef.current) clearTimeout(storeLocationSaveTimeoutRef.current)
    storeLocationSaveTimeoutRef.current = setTimeout(() => {
      storeLocationSaveTimeoutRef.current = null
      saveStoreLocationSettings(true)
    }, 1000)
    return () => {
      if (storeLocationSaveTimeoutRef.current) clearTimeout(storeLocationSaveTimeoutRef.current)
    }
  }, [storeLocationSettings])

  // When leaving Store Information tab: save immediately so backend and receipt_settings update
  // When entering POS tab: sync store info into receipt state so form and receipt show it
  useEffect(() => {
    const prevTab = previousActiveTabRef.current
    if (prevTab === 'location' && activeTab !== 'location') {
      saveStoreLocationSettings(true)
    }
    if (activeTab === 'pos') {
      syncStoreInfoToReceipt()
    }
    previousActiveTabRef.current = activeTab
  }, [activeTab])

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords

          // Try to get address from coordinates (reverse geocoding)
          let address = null
          try {
            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
            )
            const geoData = await geoResponse.json()
            if (geoData && geoData.display_name) {
              address = geoData.display_name
            }
          } catch (err) {
            console.warn('Could not get address from coordinates:', err)
          }

          resolve({ latitude, longitude, address })
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  const handleSetCurrentLocation = async () => {
    try {
      setMessage({ type: 'info', text: 'Getting your current location...' })
      const location = await getCurrentLocation()
      setStoreLocationSettings({
        ...storeLocationSettings,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || storeLocationSettings.address
      })
      setMessage({ type: 'success', text: 'Location set successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to get location: ${error.message}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }


  // Nav and page shell always visible; only main content area shows loading state
  const settingsSections = [
    { id: 'location', label: 'Store Information', icon: MapPin },
    { id: 'pos', label: 'POS Settings', icon: ShoppingCart },
    { id: 'cash', label: 'Cash Register', icon: DollarSign },
    { id: 'notifications', label: 'Notifications', icon: MessageSquare },
    { id: 'rewards', label: 'Customer Rewards', icon: Gift },
    { id: 'integration', label: 'Integrations', icon: Plug },
    ...(hasAdminAccess ? [{ id: 'admin', label: 'Admin', icon: Shield }] : [])
  ]

  return (
    <div style={{
      display: 'flex',
      minHeight: (activeTab === 'cash' || activeTab === 'admin') ? 0 : '100vh',
      height: (activeTab === 'cash' || activeTab === 'admin') ? '100%' : undefined,
      width: '100%',
      ...((activeTab === 'cash' || activeTab === 'admin') ? { overflow: 'hidden' } : {})
    }}>
      {/* Sidebar Navigation - 1/4 of page */}
      <div
        ref={sidebarRef}
        style={{
          position: 'fixed',
          left: 0,
          top: '56px',
          zIndex: 100,
          width: isInitialMount ? '25%' : (sidebarMinimized ? '60px' : '25%'),
          height: 'calc(100vh - 56px)',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          padding: isInitialMount ? '32px 10px 48px 10px' : (sidebarMinimized ? '32px 10px 48px 10px' : '32px 10px 48px 10px'),
          borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`,
          transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: isInitialMount ? 'none' : 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          paddingTop: '0',
          paddingBottom: '0',
          alignItems: 'stretch'
        }}>
          {/* Settings Header */}
          <div
            ref={settingsHeaderRef}
            style={{ position: 'relative' }}
            onMouseEnter={(e) => {
              setHoveringSettings(true)
              setShowTooltip(true)
              if (settingsHeaderRef.current) {
                const rect = settingsHeaderRef.current.getBoundingClientRect()
                if (sidebarMinimized) {
                  setTooltipPosition({
                    top: rect.top + rect.height / 2,
                    left: rect.right + 8
                  })
                } else {
                  setTooltipPosition({
                    top: rect.bottom + 4,
                    left: rect.left
                  })
                }
              }
            }}
            onMouseLeave={() => {
              setHoveringSettings(false)
              setShowTooltip(false)
            }}
          >
            <button
              onClick={() => setSidebarMinimized(!sidebarMinimized)}
              style={{
                width: isInitialMount ? '100%' : (sidebarMinimized ? '40px' : '100%'),
                height: '40px',
                padding: '0',
                margin: '0',
                border: 'none',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isInitialMount ? 'flex-start' : (sidebarMinimized ? 'center' : 'flex-start'),
                transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                left: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                transition: 'none'
              }}>
                {sidebarMinimized ? (
                  <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                ) : (
                  hoveringSettings ? (
                    <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                  ) : (
                    <SettingsIcon size={20} style={{ width: '20px', height: '20px' }} />
                  )
                )}
              </div>
              {!sidebarMinimized && (
                <span style={{
                  marginLeft: '48px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  whiteSpace: 'nowrap',
                  opacity: sidebarMinimized ? 0 : 1,
                  transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  pointerEvents: 'none'
                }}>
                  Settings
                </span>
              )}
            </button>
          </div>
          {showTooltip && (
            <div
              style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform: sidebarMinimized ? 'translateY(-50%)' : 'none',
                padding: '4px 8px',
                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)',
                color: 'white',
                fontSize: '12px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                zIndex: 10000,
                pointerEvents: 'none'
              }}
            >
              {sidebarMinimized ? 'Open sidebar' : 'Close sidebar'}
            </div>
          )}
          {settingsSections.map((section) => {
            const Icon = section.icon
            const isActive = activeTab === section.id
            const employeeCanAccessTab = EMPLOYEE_ALLOWED_SETTINGS_TABS.includes(section.id)
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (!hasAdminAccess && !employeeCanAccessTab) {
                    showToast(NO_PERMISSION_MSG, 'error')
                    return
                  }
                  setActiveTab(section.id)
                }}
                style={{
                  width: isInitialMount ? '100%' : (sidebarMinimized ? '40px' : '100%'),
                  height: '40px',
                  padding: '0',
                  margin: '0',
                  border: 'none',
                  backgroundColor: isActive
                    ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
                  borderRadius: isActive ? '6px' : '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isInitialMount ? 'flex-start' : (sidebarMinimized ? 'center' : 'flex-start'),
                  transition: isInitialMount ? 'backgroundColor 0.2s ease, borderRadius 0.2s ease' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1), backgroundColor 0.2s ease, borderRadius 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  color: isActive
                    ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
                    : (isDarkMode ? 'var(--text-secondary, #ccc)' : '#666')
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  transition: 'none'
                }}>
                  <Icon size={20} style={{ width: '20px', height: '20px' }} />
                </div>
                {!sidebarMinimized && (
                  <span style={{
                    marginLeft: '48px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 'normal',
                    whiteSpace: 'nowrap',
                    opacity: sidebarMinimized ? 0 : 1,
                    transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none'
                  }}>
                    {section.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>


      {/* Main Content Area - 3/4 of page */}
      <div
        ref={contentRef}
        style={{
          marginLeft: isInitialMount ? '25%' : (sidebarMinimized ? '60px' : '25%'),
          width: isInitialMount ? '75%' : (sidebarMinimized ? 'calc(100% - 60px)' : '75%'),
          flex: 1,
          padding: '48px 64px 64px 64px',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          maxWidth: isInitialMount ? '1200px' : (sidebarMinimized ? 'none' : '1200px'),
          transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          ...((activeTab === 'cash' || activeTab === 'admin') ? { height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {})
        }}
      >
        {message && (
          <div style={{
            padding: '16px 20px',
            marginBottom: '12px',
            borderRadius: '10px',
            backgroundColor: message.type === 'success'
              ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9')
              : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#ffebee'),
            color: message.type === 'success' ? '#4caf50' : '#f44336',
            border: `1px solid ${message.type === 'success' ? '#4caf50' : '#f44336'}`,
            boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {message.text}
          </div>
        )}

        {/* Content – skeleton when loading so nav and shell are visible immediately */}
        <div style={(activeTab === 'cash' || activeTab === 'admin') ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} aria-busy="true" aria-label="Loading settings">
              <div style={{ height: '28px', width: '200px', borderRadius: '6px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e8e8e8' }} />
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} style={{ height: '48px', borderRadius: '6px', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f0f0f0', width: i % 2 === 0 ? '100%' : `${85 - (i % 3) * 5}%` }} />
              ))}
            </div>
          ) : (
            <>
              {/* Save Button - Hidden for location, cash, and pos tabs (pos has its own at bottom) */}
              {activeTab !== 'location' && activeTab !== 'cash' && activeTab !== 'pos' && activeTab !== 'rewards' && activeTab !== 'notifications' && activeTab !== 'integration' && activeTab !== 'admin' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    className="button-26 button-26--header"
                    role="button"
                    onClick={null}
                    disabled={saving}
                    style={{
                      opacity: saving ? 0.6 : 1,
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div className="button-26__content">
                      <span className="button-26__text text">
                        {saving ? 'Saving...' : 'Save'}
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Store Information Settings Tab */}
              {activeTab === 'location' && (
                <div style={{ maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
                  <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px' }}>
                    Store Information
                  </FormTitle>
                  {!hasAdminAccess && (
                    <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(255,193,7,0.15)' : 'rgba(255,193,7,0.2)', color: isDarkMode ? '#ffc107' : '#b38600', fontSize: '14px' }}>
                      View only — you don't have permission to edit.
                    </div>
                  )}
                  <fieldset disabled={!hasAdminAccess} style={{ border: 'none', margin: 0, padding: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Store Name, Type, and Logo */}
                      <FormField style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <input
                            type="text"
                            placeholder="Enter store name"
                            value={storeLocationSettings.store_name ?? ''}
                            onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, store_name: e.target.value })}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                          <CustomDropdown
                            value={storeLocationSettings.store_type ?? ''}
                            onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, store_type: e.target.value })}
                            options={[
                              { value: 'retail', label: 'Retail Store' },
                              { value: 'restaurant', label: 'Restaurant' },
                              { value: 'cafe', label: 'Cafe' },
                              { value: 'grocery', label: 'Grocery Store' },
                              { value: 'pharmacy', label: 'Pharmacy' },
                              { value: 'convenience', label: 'Convenience Store' },
                              { value: 'other', label: 'Other' }
                            ]}
                            placeholder="Select store type"
                            isDarkMode={isDarkMode}
                            themeColorRgb={themeColorRgb}
                            compactTrigger
                          />
                          <div style={{ width: '100%' }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onloadend = () => {
                                    setStoreLocationSettings({ ...storeLocationSettings, store_logo: reader.result })
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }}
                              style={{ display: 'none' }}
                              id="logo-upload"
                            />
                            <label
                              htmlFor="logo-upload"
                              style={{
                                ...compactCancelButtonStyle(isDarkMode, false),
                                width: '100%',
                                height: '32px',
                                minHeight: '32px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              Upload logo
                            </label>
                          </div>
                          {storeLocationSettings.store_logo && (
                            <div style={{ marginTop: '8px' }}>
                              <img
                                src={storeLocationSettings.store_logo}
                                alt="Store logo preview"
                                style={{
                                  maxWidth: '200px',
                                  maxHeight: '100px',
                                  borderRadius: '8px',
                                  border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </FormField>

                      {/* Store Address */}
                      <FormField style={{ marginBottom: '8px' }}>
                        <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 600 }}>
                          Store Address
                        </FormTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <input
                            type="text"
                            placeholder="Street Address"
                            value={storeLocationSettings.address ?? ''}
                            onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, address: e.target.value })}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                            <input
                              type="text"
                              placeholder="City"
                              value={storeLocationSettings.city ?? ''}
                              onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, city: e.target.value })}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                            <input
                              type="text"
                              placeholder="State"
                              value={storeLocationSettings.state ?? ''}
                              onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, state: e.target.value })}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                            <input
                              type="text"
                              placeholder="ZIP Code"
                              value={storeLocationSettings.zip ?? ''}
                              onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, zip: e.target.value })}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Country"
                            value={storeLocationSettings.country ?? ''}
                            onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, country: e.target.value })}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </div>
                      </FormField>

                      {/* Contact Information */}
                      <FormField style={{ marginBottom: '8px' }}>
                        <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 600 }}>
                          Contact Information
                        </FormTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <input
                            type="tel"
                            placeholder="Phone Number"
                            value={storeLocationSettings.store_phone ?? ''}
                            onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, store_phone: e.target.value })}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                          <input
                            type="email"
                            placeholder="Email Address"
                            value={storeLocationSettings.store_email ?? ''}
                            onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, store_email: e.target.value })}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                          <input
                            type="url"
                            placeholder="Website URL"
                            value={storeLocationSettings.store_website ?? ''}
                            onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, store_website: e.target.value })}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </div>
                      </FormField>

                      {/* Store Hours */}
                      <FormField style={{ marginBottom: '8px' }}>
                        <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '16px', fontSize: '15px', fontWeight: 600 }}>
                          Store Hours
                        </FormTitle>
                        {(() => {
                          const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                          const dayLabels = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' }
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {dayOrder.map((hoursKey) => {
                                const dayHours = storeLocationSettings.store_hours[hoursKey]
                                const isOpen = !dayHours?.closed
                                return (
                                  <div
                                    key={hoursKey}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '12px',
                                      flexWrap: 'wrap'
                                    }}
                                  >
                                    <span style={{ width: '90px', flexShrink: 0, fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                      {dayLabels[hoursKey]}
                                    </span>
                                    {isOpen ? (
                                      <>
                                        <input
                                          type="time"
                                          value={dayHours?.open || '09:00'}
                                          onChange={(e) => {
                                            const newHours = { ...storeLocationSettings.store_hours }
                                            newHours[hoursKey] = { ...newHours[hoursKey], open: e.target.value }
                                            setStoreLocationSettings({ ...storeLocationSettings, store_hours: newHours })
                                          }}
                                          style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box' }}
                                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                        />
                                        <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>–</span>
                                        <input
                                          type="time"
                                          value={dayHours?.close || '17:00'}
                                          onChange={(e) => {
                                            const newHours = { ...storeLocationSettings.store_hours }
                                            newHours[hoursKey] = { ...newHours[hoursKey], close: e.target.value }
                                            setStoreLocationSettings({ ...storeLocationSettings, store_hours: newHours })
                                          }}
                                          style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box' }}
                                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <div style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', cursor: 'default' }}>
                                          Closed
                                        </div>
                                        <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>–</span>
                                        <div style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', cursor: 'default' }}>
                                          Closed
                                        </div>
                                      </>
                                    )}
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                                      <div className="checkbox-wrapper-2">
                                        <input
                                          type="checkbox"
                                          className="sc-gJwTLC ikxBAC"
                                          checked={isOpen || false}
                                          onChange={(e) => {
                                            const newHours = { ...storeLocationSettings.store_hours }
                                            newHours[hoursKey] = { ...newHours[hoursKey], closed: !e.target.checked }
                                            setStoreLocationSettings({ ...storeLocationSettings, store_hours: newHours })
                                          }}
                                        />
                                      </div>
                                    </label>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </FormField>

                      {/* Save Button + Add to DoorDash hours */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '16px',
                        flexWrap: 'wrap'
                      }}>
                        {integrations?.doordash?.enabled && (
                          <button
                            type="button"
                            className="button-50 button-50--doordash"
                            role="button"
                            onClick={pushDoordashStoreHours}
                            disabled={doordashPushStoreHoursLoading}
                            style={{
                              opacity: doordashPushStoreHoursLoading ? 0.6 : 1,
                              cursor: doordashPushStoreHoursLoading ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <span className="button-50__Content">
                              {doordashPushStoreHoursLoading ? 'Pushing…' : 'Add to DoorDash hours'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="button-26 button-26--header"
                          role="button"
                          onClick={saveStoreLocationSettings}
                          disabled={saving}
                          style={{
                            opacity: saving ? 0.6 : 1,
                            cursor: saving ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <div className="button-26__content">
                            <span className="button-26__text text">
                              {saving ? 'Saving Store Information...' : 'Save Store Information'}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </fieldset>
                </div>
              )}

              {/* Customer Rewards Settings Tab */}
              {activeTab === 'rewards' && (
                <div style={{ maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                  <style>{`
            .checkbox-wrapper-2 .ikxBAC {
              appearance: none;
              background-color: #dfe1e4;
              border-radius: 72px;
              border-style: none;
              flex-shrink: 0;
              height: 20px;
              margin: 0;
              position: relative;
              width: 30px;
            }

            .checkbox-wrapper-2 .ikxBAC::before {
              bottom: -6px;
              content: "";
              left: -6px;
              position: absolute;
              right: -6px;
              top: -6px;
            }

            .checkbox-wrapper-2 .ikxBAC,
            .checkbox-wrapper-2 .ikxBAC::after {
              transition: all 100ms ease-out;
            }

            .checkbox-wrapper-2 .ikxBAC::after {
              background-color: #fff;
              border-radius: 50%;
              content: "";
              height: 14px;
              left: 3px;
              position: absolute;
              top: 3px;
              width: 14px;
            }

            .checkbox-wrapper-2 input[type=checkbox] {
              cursor: default;
            }

            .checkbox-wrapper-2 .ikxBAC:hover {
              background-color: #c9cbcd;
              transition-duration: 0s;
            }

            .checkbox-wrapper-2 .ikxBAC:checked {
              background-color: var(--theme-color, #6ba3f0);
            }

            .checkbox-wrapper-2 .ikxBAC:checked::after {
              background-color: #fff;
              left: 13px;
            }

            .checkbox-wrapper-2 :focus:not(.focus-visible) {
              outline: 0;
            }

            .checkbox-wrapper-2 .ikxBAC:checked:hover {
              filter: brightness(0.9);
            }
          `}</style>
                  <h2 style={{
                    marginBottom: '8px',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Customer Rewards Program
                  </h2>
                  <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '20px', marginTop: 0 }}>
                    Let customers earn and redeem rewards. Choose what info you need at checkout, then enable one or more reward types: points, percentage off, or a fixed discount.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Customer Info Requirements */}
                    <div>
                      <h3 style={{
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Customer Information Requirements
                      </h3>
                      <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '12px', marginTop: 0 }}>
                        When rewards are enabled, you can require email and/or phone so you can track who earns and redeems.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          cursor: 'pointer'
                        }}>
                          <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <input
                              type="checkbox"
                              className="sc-gJwTLC ikxBAC"
                              checked={rewardsSettings.require_email}
                              onChange={(e) => setRewardsSettings({
                                ...rewardsSettings,
                                require_email: e.target.checked,
                                require_both: e.target.checked && rewardsSettings.require_phone
                              })}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Require email</span>
                            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customer must enter an email to earn or use rewards.</div>
                          </div>
                        </label>
                        <label style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          cursor: 'pointer'
                        }}>
                          <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <input
                              type="checkbox"
                              className="sc-gJwTLC ikxBAC"
                              checked={rewardsSettings.require_phone}
                              onChange={(e) => setRewardsSettings({
                                ...rewardsSettings,
                                require_phone: e.target.checked,
                                require_both: rewardsSettings.require_email && e.target.checked
                              })}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Require phone number</span>
                            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customer must enter a phone number to earn or use rewards.</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Points */}
                    <div style={{ marginBottom: '16px', opacity: rewardsSettings.points_enabled ? 1 : 0.7 }}>
                      <h3 style={{
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Points (earn points per dollar spent)
                      </h3>
                      <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '12px', marginTop: 0 }}>
                        Customers earn points on each purchase and can redeem them for a discount later.
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
                        <div className="checkbox-wrapper-2">
                          <input
                            type="checkbox"
                            className="sc-gJwTLC ikxBAC"
                            checked={rewardsSettings.points_enabled}
                            onChange={(e) => setRewardsSettings({ ...rewardsSettings, points_enabled: e.target.checked, reward_type: e.target.checked ? 'points' : rewardsSettings.reward_type })}
                          />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Enable points</span>
                      </label>
                      <div style={{ pointerEvents: rewardsSettings.points_enabled ? 'auto' : 'none' }}>
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Points per Dollar Spent</FormLabel>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={rewardsSettings.points_per_dollar ?? ''}
                          onChange={(e) => setRewardsSettings({ ...rewardsSettings, points_per_dollar: parseFloat(e.target.value) || 1.0 })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          disabled={!rewardsSettings.points_enabled}
                        />
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px', marginTop: '12px' }}>Value per point ($)</FormLabel>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max="1"
                          placeholder="0.01"
                          value={rewardsSettings.points_redemption_value ?? ''}
                          onChange={(e) => setRewardsSettings({ ...rewardsSettings, points_redemption_value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          disabled={!rewardsSettings.points_enabled}
                        />
                        <p style={{ marginTop: '4px', marginBottom: 0, fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                          e.g. 0.01 = 1¢ per point (100 points = $1)
                        </p>
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px', marginTop: '12px' }}>Minimum spend to earn ($)</FormLabel>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rewardsSettings.minimum_spend_points ?? ''}
                          onChange={(e) => setRewardsSettings({ ...rewardsSettings, minimum_spend_points: parseFloat(e.target.value) || 0.0 })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          disabled={!rewardsSettings.points_enabled}
                        />
                      </div>
                    </div>

                    {/* Percentage discount */}
                    <div style={{ marginBottom: '16px', opacity: rewardsSettings.percentage_enabled ? 1 : 0.7 }}>
                      <h3 style={{
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Percentage discount
                      </h3>
                      <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '12px', marginTop: 0 }}>
                        Give enrolled customers a percent off their order (e.g. 10% off).
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
                        <div className="checkbox-wrapper-2">
                          <input
                            type="checkbox"
                            className="sc-gJwTLC ikxBAC"
                            checked={rewardsSettings.percentage_enabled}
                            onChange={(e) => setRewardsSettings({ ...rewardsSettings, percentage_enabled: e.target.checked, reward_type: e.target.checked ? 'percentage' : rewardsSettings.reward_type })}
                          />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Enable percentage discount</span>
                      </label>
                      <div style={{ pointerEvents: rewardsSettings.percentage_enabled ? 'auto' : 'none' }}>
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Percentage Discount (%)</FormLabel>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={rewardsSettings.percentage_discount ?? ''}
                          onChange={(e) => setRewardsSettings({ ...rewardsSettings, percentage_discount: parseFloat(e.target.value) || 0.0 })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          disabled={!rewardsSettings.percentage_enabled}
                        />
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px', marginTop: '12px' }}>Minimum spend to earn ($)</FormLabel>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rewardsSettings.minimum_spend_percentage ?? ''}
                          onChange={(e) => setRewardsSettings({ ...rewardsSettings, minimum_spend_percentage: parseFloat(e.target.value) || 0.0 })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          disabled={!rewardsSettings.percentage_enabled}
                        />
                      </div>
                    </div>

                    {/* Fixed discount */}
                    <div style={{ marginBottom: '16px', opacity: rewardsSettings.fixed_enabled ? 1 : 0.7 }}>
                      <h3 style={{
                        marginBottom: '4px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Fixed discount amount
                      </h3>
                      <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '12px', marginTop: 0 }}>
                        Give enrolled customers a set dollar amount off (e.g. $5 off).
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
                        <div className="checkbox-wrapper-2">
                          <input
                            type="checkbox"
                            className="sc-gJwTLC ikxBAC"
                            checked={rewardsSettings.fixed_enabled}
                            onChange={(e) => setRewardsSettings({ ...rewardsSettings, fixed_enabled: e.target.checked, reward_type: e.target.checked ? 'fixed' : rewardsSettings.reward_type })}
                          />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Enable fixed discount</span>
                      </label>
                      <div style={{ pointerEvents: rewardsSettings.fixed_enabled ? 'auto' : 'none' }}>
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Fixed Discount Amount ($)</FormLabel>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rewardsSettings.fixed_discount ?? ''}
                          onChange={(e) => setRewardsSettings({ ...rewardsSettings, fixed_discount: parseFloat(e.target.value) || 0.0 })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          disabled={!rewardsSettings.fixed_enabled}
                        />
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px', marginTop: '12px' }}>Minimum spend to earn ($)</FormLabel>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rewardsSettings.minimum_spend_fixed ?? ''}
                          onChange={(e) => setRewardsSettings({ ...rewardsSettings, minimum_spend_fixed: parseFloat(e.target.value) || 0.0 })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          disabled={!rewardsSettings.fixed_enabled}
                        />
                      </div>
                    </div>

                    {/* Rewards campaigns / Promotions */}
                    <div style={{ marginTop: '24px' }}>
                      <h3 style={{
                        marginBottom: '12px',
                        fontSize: '15px',
                        fontWeight: 600,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Rewards campaigns & promotions
                      </h3>
                      <p style={{
                        marginBottom: '12px',
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                      }}>
                        Create promo discounts, product discounts, or buy-one-get-one offers.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCampaign(defaultNewCampaign())
                          setShowCreateCampaignModal(true)
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          backgroundColor: `rgba(${themeColorRgb}, 0.15)`,
                          color: `rgb(${themeColorRgb})`,
                          border: `1px solid rgba(${themeColorRgb}, 0.4)`,
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={18} />
                        Create campaign
                      </button>
                      {rewardsCampaigns.length > 0 && (
                        <ul style={{ marginTop: '16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {rewardsCampaigns.map((c, i) => (
                            <li
                              key={c.id ?? i}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f0f0f0',
                                borderRadius: '8px',
                                border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>{c.name || 'Unnamed campaign'}</span>
                                <span style={{ marginLeft: '10px', fontSize: '13px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                                  {c.type === 'promo_discount' && 'Promo discount'}
                                  {c.type === 'product_discount' && 'Product discount'}
                                  {c.type === 'bogo' && 'Buy one get one'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setRewardsCampaigns(prev => {
                                    const next = prev.filter((_, idx) => idx !== i)
                                    localStorage.setItem('rewards_campaigns', JSON.stringify(next))
                                    return next
                                  })
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isDarkMode ? '#999' : '#666' }}
                                aria-label="Delete campaign"
                              >
                                <Trash2 size={18} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button
                        type="button"
                        className="button-26 button-26--header"
                        role="button"
                        onClick={saveRewardsSettings}
                        disabled={saving}
                        style={{
                          opacity: saving ? 0.6 : 1,
                          cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <div className="button-26__content">
                          <span className="button-26__text text">
                            {saving ? 'Saving...' : 'Save Rewards Settings'}
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Create campaign modal */}
                    {showCreateCampaignModal && (
                      <div
                        style={{
                          position: 'fixed',
                          inset: 0,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10000,
                          overflow: 'auto',
                          padding: '24px'
                        }}
                        onClick={() => setShowCreateCampaignModal(false)}
                      >
                        <div
                          style={{
                            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '480px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                            border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                              Create rewards campaign
                            </h3>
                            <button type="button" onClick={() => setShowCreateCampaignModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                              <X size={20} style={{ color: isDarkMode ? '#999' : '#666' }} />
                            </button>
                          </div>
                          <FormField style={{ marginBottom: '14px' }}>
                            <FormLabel isDarkMode={isDarkMode}>Campaign name</FormLabel>
                            <input
                              type="text"
                              placeholder="e.g. Summer Sale"
                              value={newCampaign.name}
                              onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </FormField>
                          <FormField style={{ marginBottom: '14px' }}>
                            <FormLabel isDarkMode={isDarkMode}>Audience</FormLabel>
                            <select
                              value={newCampaign.audience ?? 'everyone'}
                              onChange={(e) => setNewCampaign(prev => ({ ...prev, audience: e.target.value }))}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            >
                              <option value="everyone">Everyone</option>
                              <option value="enrolled_only">Enrolled customers only</option>
                            </select>
                          </FormField>
                          <FormField style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                              <div style={{ flex: 1 }}>
                                <FormLabel isDarkMode={isDarkMode}>Start date (optional)</FormLabel>
                                <input
                                  type="date"
                                  value={newCampaign.start_date ?? ''}
                                  onChange={(e) => setNewCampaign(prev => ({ ...prev, start_date: e.target.value }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <FormLabel isDarkMode={isDarkMode}>End date (optional)</FormLabel>
                                <input
                                  type="date"
                                  value={newCampaign.end_date ?? ''}
                                  onChange={(e) => setNewCampaign(prev => ({ ...prev, end_date: e.target.value }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </div>
                            </div>
                          </FormField>
                          <FormField style={{ marginBottom: '14px' }}>
                            <FormLabel isDarkMode={isDarkMode}>Promotion type</FormLabel>
                            <select
                              value={newCampaign.type ?? ''}
                              onChange={(e) => setNewCampaign(prev => ({ ...prev, type: e.target.value }))}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            >
                              <option value="promo_discount">Promo discount (% or $ off order)</option>
                              <option value="product_discount">Product discount (discount on specific products)</option>
                              <option value="bogo">Buy one get one (BOGO)</option>
                            </select>
                          </FormField>
                          <FormField style={{ marginBottom: '14px' }}>
                            <FormLabel isDarkMode={isDarkMode}>Minimum purchase ($) — optional</FormLabel>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={newCampaign.minimum_purchase ?? ''}
                              onChange={(e) => setNewCampaign(prev => ({ ...prev, minimum_purchase: e.target.value }))}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </FormField>
                          {newCampaign.type === 'promo_discount' && (
                            <FormField style={{ marginBottom: '14px' }}>
                              <FormLabel isDarkMode={isDarkMode}>Discount value (% or $)</FormLabel>
                              <input
                                type="text"
                                placeholder="e.g. 10 or 10% or 5.00"
                                value={newCampaign.discount_value ?? ''}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, discount_value: e.target.value }))}
                                style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                              />
                            </FormField>
                          )}
                          {(newCampaign.type === 'product_discount' || newCampaign.type === 'bogo') && (
                            <FormField style={{ marginBottom: '14px' }}>
                              <FormLabel isDarkMode={isDarkMode}>Products & categories</FormLabel>
                              <button
                                type="button"
                                onClick={() => setShowProductPickerModal(true)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                                  background: isDarkMode ? 'var(--bg-secondary)' : '#f8f8f8',
                                  color: isDarkMode ? 'var(--text-primary)' : '#333',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  fontWeight: 500
                                }}
                              >
                                <Package size={18} />
                                {[].concat(newCampaign.product_ids || [], newCampaign.category_ids || [], newCampaign.product_exclude_ids || [], newCampaign.category_exclude_ids || []).length > 0
                                  ? `Edit selection (${(newCampaign.product_ids || []).length + (newCampaign.product_exclude_ids || []).length} products, ${(newCampaign.category_ids || []).length + (newCampaign.category_exclude_ids || []).length} categories)`
                                  : 'Select products & categories'}
                              </button>
                              {newCampaign.type === 'product_discount' && (
                                <>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginTop: '8px' }}>Discount value (% or $)</FormLabel>
                                  <input
                                    type="text"
                                    placeholder="e.g. 15% or 2.00"
                                    value={newCampaign.discount_value ?? ''}
                                    onChange={(e) => setNewCampaign(prev => ({ ...prev, discount_value: e.target.value }))}
                                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                  />
                                </>
                              )}
                            </FormField>
                          )}
                          {newCampaign.type === 'bogo' && (
                            <>
                              <FormField style={{ marginBottom: '14px' }}>
                                <FormLabel isDarkMode={isDarkMode}>Buy quantity</FormLabel>
                                <input
                                  type="number"
                                  min={1}
                                  value={newCampaign.buy_qty ?? ''}
                                  onChange={(e) => setNewCampaign(prev => ({ ...prev, buy_qty: parseInt(e.target.value, 10) || 1 }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                              <FormField style={{ marginBottom: '14px' }}>
                                <FormLabel isDarkMode={isDarkMode}>Get quantity (free or discounted)</FormLabel>
                                <input
                                  type="number"
                                  min={1}
                                  value={newCampaign.get_qty ?? ''}
                                  onChange={(e) => setNewCampaign(prev => ({ ...prev, get_qty: parseInt(e.target.value, 10) || 1 }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                            </>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button
                              type="button"
                              onClick={() => setShowCreateCampaignModal(false)}
                              style={compactCancelButtonStyle(isDarkMode, false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const campaign = {
                                  id: Date.now(),
                                  name: newCampaign.name || 'Unnamed campaign',
                                  type: newCampaign.type,
                                  discount_value: newCampaign.discount_value,
                                  product_id: newCampaign.product_id,
                                  buy_qty: newCampaign.buy_qty,
                                  get_qty: newCampaign.get_qty,
                                  audience: newCampaign.audience || 'everyone',
                                  start_date: newCampaign.start_date || null,
                                  end_date: newCampaign.end_date || null,
                                  minimum_purchase: newCampaign.minimum_purchase ? parseFloat(newCampaign.minimum_purchase) : null,
                                  product_ids: newCampaign.product_ids || [],
                                  product_exclude_ids: newCampaign.product_exclude_ids || [],
                                  category_ids: newCampaign.category_ids || [],
                                  category_exclude_ids: newCampaign.category_exclude_ids || []
                                }
                                setRewardsCampaigns(prev => {
                                  const next = [...prev, campaign]
                                  localStorage.setItem('rewards_campaigns', JSON.stringify(next))
                                  return next
                                })
                                setShowCreateCampaignModal(false)
                                setNewCampaign(defaultNewCampaign())
                              }}
                              style={compactPrimaryButtonStyle(themeColorRgb, false)}
                            >
                              Create campaign
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Product & category picker modal (for product_discount / BOGO) */}
                    {showProductPickerModal && (
                      <div
                        style={{
                          position: 'fixed',
                          inset: 0,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10001,
                          padding: '24px',
                          overflow: 'auto'
                        }}
                        onClick={() => setShowProductPickerModal(false)}
                      >
                        <div
                          style={{
                            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '560px',
                            width: '100%',
                            maxHeight: '85vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                            border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                              Select products & categories
                            </h3>
                            <button type="button" onClick={() => setShowProductPickerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                              <X size={20} style={{ color: isDarkMode ? '#999' : '#666' }} />
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexShrink: 0 }}>
                            <input
                              type="text"
                              placeholder="Search by name, SKU, or barcode"
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && pickerSearch.trim()) {
                                  const p = pickerProducts.find(x =>
                                    (x.barcode || '').toString().trim() === pickerSearch.trim() ||
                                    (x.sku || '').toString().trim() === pickerSearch.trim()
                                  )
                                  if (p && p.product_id) {
                                    setPickerIncludeIds(prev => prev.includes(p.product_id) ? prev : [...prev, p.product_id])
                                    setPickerExcludeIds(prev => prev.filter(x => x !== p.product_id))
                                    setPickerSearch('')
                                  }
                                }
                              }}
                              style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), flex: 1 }}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                            <button
                              type="button"
                              onClick={() => setShowBarcodeInPicker(true)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                                background: isDarkMode ? 'var(--bg-secondary)' : '#f5f5f5',
                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                fontWeight: 500
                              }}
                            >
                              <ScanBarcode size={18} /> Scan
                            </button>
                          </div>
                          {showBarcodeInPicker && (
                            <div style={{ marginBottom: '12px', flexShrink: 0 }}>
                              <BarcodeScanner
                                onScan={(barcode) => {
                                  const p = pickerProducts.find(x => (x.barcode || '').toString() === (barcode || '').toString())
                                  if (p && p.product_id) {
                                    setPickerIncludeIds(prev => prev.includes(p.product_id) ? prev : [...prev, p.product_id])
                                    setPickerExcludeIds(prev => prev.filter(x => x !== p.product_id))
                                  }
                                  // Keep scanner open for multiple scans; user closes when done
                                }}
                                onClose={() => setShowBarcodeInPicker(false)}
                                themeColor={themeColor}
                              />
                            </div>
                          )}
                          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {pickerLoading ? (
                              <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>Loading products…</div>
                            ) : (
                              <>
                                <div>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Include products (optional — leave empty for all)</FormLabel>
                                  <div style={{ maxHeight: '140px', overflow: 'auto', border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`, borderRadius: '8px', padding: '8px' }}>
                                    {(pickerSearch.trim() ? pickerProducts.filter(p => {
                                      const q = pickerSearch.toLowerCase()
                                      return (p.product_name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').toString().toLowerCase().includes(q)
                                    }) : pickerProducts).slice(0, 100).map(p => (
                                      <label key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}>
                                        <input
                                          type="checkbox"
                                          checked={pickerIncludeIds.includes(p.product_id)}
                                          onChange={() => {
                                            setPickerIncludeIds(prev => prev.includes(p.product_id) ? prev.filter(x => x !== p.product_id) : [...prev, p.product_id])
                                            setPickerExcludeIds(prev => prev.filter(x => x !== p.product_id))
                                          }}
                                        />
                                        <span style={{ color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{p.product_name || p.sku}</span>
                                        {p.sku && <span style={{ color: isDarkMode ? '#888' : '#666', fontSize: '12px' }}>({p.sku})</span>}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Exclude products (optional)</FormLabel>
                                  <div style={{ maxHeight: '100px', overflow: 'auto', border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`, borderRadius: '8px', padding: '8px' }}>
                                    {(pickerSearch.trim() ? pickerProducts.filter(p => {
                                      const q = pickerSearch.toLowerCase()
                                      return (p.product_name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').toString().toLowerCase().includes(q)
                                    }) : pickerProducts).slice(0, 100).map(p => (
                                      <label key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}>
                                        <input
                                          type="checkbox"
                                          checked={pickerExcludeIds.includes(p.product_id)}
                                          onChange={() => {
                                            setPickerExcludeIds(prev => prev.includes(p.product_id) ? prev.filter(x => x !== p.product_id) : [...prev, p.product_id])
                                            setPickerIncludeIds(prev => prev.filter(x => x !== p.product_id))
                                          }}
                                        />
                                        <span style={{ color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{p.product_name || p.sku}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Limit to categories (optional)</FormLabel>
                                  <div style={{ maxHeight: '100px', overflow: 'auto', border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`, borderRadius: '8px', padding: '8px' }}>
                                    {pickerCategories.map(c => (
                                      <label key={c.category_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}>
                                        <input
                                          type="checkbox"
                                          checked={pickerLimitCategoryIds.includes(c.category_id)}
                                          onChange={() => {
                                            setPickerLimitCategoryIds(prev => prev.includes(c.category_id) ? prev.filter(x => x !== c.category_id) : [...prev, c.category_id])
                                            setPickerExcludeCategoryIds(prev => prev.filter(x => x !== c.category_id))
                                          }}
                                        />
                                        <span style={{ color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{c.category_name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Exclude categories (optional)</FormLabel>
                                  <div style={{ maxHeight: '100px', overflow: 'auto', border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`, borderRadius: '8px', padding: '8px' }}>
                                    {pickerCategories.map(c => (
                                      <label key={c.category_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}>
                                        <input
                                          type="checkbox"
                                          checked={pickerExcludeCategoryIds.includes(c.category_id)}
                                          onChange={() => setPickerExcludeCategoryIds(prev => prev.includes(c.category_id) ? prev.filter(x => x !== c.category_id) : [...prev, c.category_id])}
                                        />
                                        <span style={{ color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{c.category_name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => setShowProductPickerModal(false)}
                              style={{
                                padding: '10px 18px',
                                borderRadius: '8px',
                                border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                                background: 'transparent',
                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewCampaign(prev => ({
                                  ...prev,
                                  product_ids: pickerIncludeIds,
                                  product_exclude_ids: pickerExcludeIds,
                                  category_ids: pickerLimitCategoryIds,
                                  category_exclude_ids: pickerExcludeCategoryIds
                                }))
                                setShowProductPickerModal(false)
                              }}
                              style={{
                                padding: '10px 18px',
                                borderRadius: '8px',
                                border: 'none',
                                background: `rgba(${themeColorRgb}, 0.9)`,
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600
                              }}
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* POS Settings Tab */}
              {activeTab === 'pos' && (
                <div style={{ maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
                  <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px' }}>
                    POS Configuration
                  </FormTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Register Type */}
                    <FormField>
                      <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 600 }}>
                        Register Type
                      </FormTitle>
                      <CustomDropdown
                        value={posSettings.register_type}
                        onChange={(e) => setPosSettings({ ...posSettings, register_type: e.target.value })}
                        options={[
                          { value: 'one_screen', label: 'One Screen Register' },
                          { value: 'two_screen', label: 'Two Screen Register' }
                        ]}
                        placeholder="Select register type"
                        isDarkMode={isDarkMode}
                        themeColorRgb={themeColorRgb}
                        style={{ maxWidth: '320px' }}
                      />
                    </FormField>

                    {/* Orders & Delivery: master switches + sub options */}
                    <div style={{ marginTop: '16px' }}>
                      <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '4px', fontSize: '15px', fontWeight: 600 }}>
                        Orders &amp; Delivery
                      </FormTitle>
                      <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '14px', marginTop: 0 }}>
                        Choose which order types to offer and how customers can pay or schedule.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                          <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <input
                              type="checkbox"
                              className="sc-gJwTLC ikxBAC"
                              checked={allowDelivery}
                              onChange={async (e) => {
                                const v = e.target.checked
                                const ok = await saveOrderDeliverySetting('allow_delivery', v)
                                if (ok) setAllowDelivery(v)
                              }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Delivery</span>
                            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customers can place orders for delivery to an address.</div>
                          </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                          <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <input
                              type="checkbox"
                              className="sc-gJwTLC ikxBAC"
                              checked={allowPickup}
                              onChange={async (e) => {
                                const v = e.target.checked
                                const ok = await saveOrderDeliverySetting('allow_pickup', v)
                                if (ok) setAllowPickup(v)
                              }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Pickup</span>
                            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customers can place orders to pick up in store.</div>
                          </div>
                        </label>
                      </div>
                      <div style={{ marginTop: '20px', borderLeft: `3px solid ${isDarkMode ? 'var(--border-light, #444)' : '#ddd'}`, paddingLeft: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', marginBottom: '4px' }}>Options</div>
                        <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '12px', marginTop: 0 }}>
                          Additional settings for how orders can be paid and scheduled.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                            <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                              <input
                                type="checkbox"
                                className="sc-gJwTLC ikxBAC"
                                checked={allowPayAtPickup}
                                onChange={async (e) => {
                                  const v = e.target.checked
                                  const ok = await saveOrderDeliverySetting('allow_pay_at_pickup', v)
                                  if (ok) setAllowPayAtPickup(v)
                                }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Allow pay at pickup</span>
                              <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customer pays when they arrive to pick up the order.</div>
                            </div>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                            <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                              <input
                                type="checkbox"
                                className="sc-gJwTLC ikxBAC"
                                checked={deliveryPayOnDeliveryCashOnly}
                                onChange={(e) => saveDeliveryPayOnDeliveryCashOnly(e.target.checked)}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Allow pay at delivery (cash)</span>
                              <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customer can pay with cash when the order is delivered.</div>
                            </div>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                            <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                              <input
                                type="checkbox"
                                className="sc-gJwTLC ikxBAC"
                                checked={deliveryFeeEnabled}
                                onChange={async (e) => {
                                  const v = e.target.checked
                                  const ok = await saveOrderDeliverySetting('delivery_fee_enabled', v)
                                  if (ok) setDeliveryFeeEnabled(v)
                                }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Delivery fee</span>
                              <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Add a delivery fee to delivery orders (amount can be set in order/delivery settings).</div>
                            </div>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                            <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                              <input
                                type="checkbox"
                                className="sc-gJwTLC ikxBAC"
                                checked={allowScheduledPickup}
                                onChange={async (e) => {
                                  const v = e.target.checked
                                  const ok = await saveOrderDeliverySetting('allow_scheduled_pickup', v)
                                  if (ok) setAllowScheduledPickup(v)
                                }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Allow scheduled pickup</span>
                              <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customers can choose a date and time to pick up their order.</div>
                            </div>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                            <div className="checkbox-wrapper-2" style={{ flexShrink: 0, marginTop: '2px' }}>
                              <input
                                type="checkbox"
                                className="sc-gJwTLC ikxBAC"
                                checked={allowScheduledDelivery}
                                onChange={async (e) => {
                                  const v = e.target.checked
                                  const ok = await saveOrderDeliverySetting('allow_scheduled_delivery', v)
                                  if (ok) setAllowScheduledDelivery(v)
                                }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Allow scheduled delivery</span>
                              <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '2px' }}>Customers can choose a date and time for delivery.</div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Discount presets: customize labels and percentages shown in POS discount modal */}
                      <div style={{ marginTop: '24px' }}>
                        <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '4px', fontSize: '15px', fontWeight: 600 }}>
                          Discount presets
                        </FormTitle>
                        <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '14px', marginTop: 0 }}>
                          Edit the discount types and percentages shown in the POS discount modal. These appear as quick-select buttons (e.g. Student 10%, Employee 15%).
                        </p>
                        <style>{`
                  .discount-preset-percent-input::-webkit-outer-spin-button,
                  .discount-preset-percent-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                  .discount-preset-percent-input { -moz-appearance: textfield; appearance: textfield; }
                `}</style>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {(posSettings.discount_presets || []).map((preset, index) => (
                            <div
                              key={preset.id + String(index)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                flexWrap: 'wrap'
                              }}
                            >
                              <input
                                type="text"
                                value={preset.label}
                                onChange={(e) => {
                                  const next = [...(posSettings.discount_presets || [])]
                                  next[index] = { ...next[index], label: e.target.value }
                                  setPosSettings({ ...posSettings, discount_presets: next })
                                }}
                                placeholder="Label"
                                style={{
                                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                                  width: '140px',
                                  maxWidth: '180px'
                                }}
                                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                              />
                              <input
                                type="number"
                                className="discount-preset-percent-input"
                                min={0}
                                max={100}
                                step={0.5}
                                value={preset.percent}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value)
                                  if (Number.isNaN(v)) return
                                  const next = [...(posSettings.discount_presets || [])]
                                  next[index] = { ...next[index], percent: Math.max(0, Math.min(100, v)) }
                                  setPosSettings({ ...posSettings, discount_presets: next })
                                }}
                                placeholder="%"
                                style={{
                                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                                  width: '72px',
                                  boxSizing: 'border-box'
                                }}
                                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                              />
                              <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary)' : '#666' }}>%</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = (posSettings.discount_presets || []).filter((_, i) => i !== index)
                                  setPosSettings({ ...posSettings, discount_presets: next })
                                }}
                                style={{
                                  padding: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  borderRadius: '4px'
                                }}
                                aria-label="Remove discount"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const presets = posSettings.discount_presets || []
                            const usedIds = new Set(presets.map(p => (p.id || '').toLowerCase()))
                            let id = 'custom'
                            let n = 1
                            while (usedIds.has(id)) { id = `custom_${n}`; n++ }
                            setPosSettings({
                              ...posSettings,
                              discount_presets: [...presets, { id, label: 'New discount', percent: 10 }]
                            })
                          }}
                          style={{
                            marginTop: '12px',
                            padding: '8px 14px',
                            fontSize: '14px',
                            borderRadius: '6px',
                            border: `1px solid ${isDarkMode ? 'var(--border-light, #444)' : '#ccc'}`,
                            backgroundColor: 'transparent',
                            color: isDarkMode ? 'var(--text-primary)' : '#333',
                            cursor: 'pointer'
                          }}
                        >
                          Add discount
                        </button>
                      </div>

                      <div style={{
                        marginTop: '12px',
                        display: 'flex',
                        justifyContent: 'flex-end'
                      }}>
                        <button
                          type="button"
                          className="button-26 button-26--header"
                          role="button"
                          onClick={savePosSettings}
                          disabled={saving}
                          style={{
                            opacity: saving ? 0.6 : 1,
                            cursor: saving ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <div className="button-26__content">
                            <span className="button-26__text text">
                              {saving ? 'Saving…' : 'Save settings'}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Receipt Preview and Checkout UI Preview – each title above its preview; group centered */}
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
                        {!receiptEditModalOpen && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setReceiptEditModalOpen(true)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReceiptEditModalOpen(true); } }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', outline: 'none' }}
                          >
                            <div style={{ marginBottom: '8px', textAlign: 'center', width: '100%' }}>
                              <div style={{ fontSize: '15px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Receipt Preview</div>
                              <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '2px' }}>Click to edit</div>
                            </div>
                            <ReceiptPreview
                              settings={receiptSettings}
                              id="receipt-preview-print"
                              isDarkMode={isDarkMode}
                              themeColorRgb={themeColorRgb}
                            />
                          </div>
                        )}
                        {!checkoutUiEditModalOpen && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setCheckoutUiEditModalOpen(true)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCheckoutUiEditModalOpen(true); } }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', outline: 'none' }}
                          >
                            <div style={{ marginBottom: '8px', textAlign: 'center', width: '100%' }}>
                              <div style={{ fontSize: '15px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Checkout UI Preview</div>
                              <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '2px' }}>Click to edit</div>
                            </div>
                            <div
                              style={{
                                width: CHECKOUT_PREVIEW_CONTAINER_WIDTH,
                                maxWidth: '100%',
                                aspectRatio: `${CHECKOUT_PREVIEW_WIDTH} / ${CHECKOUT_PREVIEW_HEIGHT}`,
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                position: 'relative'
                              }}
                              ref={checkoutPreviewContainerRef}
                            >
                              {/* 800×600 content scaled to fill; absolute so it doesn't drive container size – fills correctly on first paint */}
                              <div style={{ position: 'absolute', top: 0, left: 0, width: CHECKOUT_PREVIEW_WIDTH, height: CHECKOUT_PREVIEW_HEIGHT, transform: `scale(${checkoutPreviewScale})`, transformOrigin: 'top left', overflow: 'hidden', borderRadius: '8px' }}>
                                <div style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: 'transparent' }}>
                                  {checkoutUiTab === 'review_order' && (() => {
                                    const s = checkoutUiSettings.review_order || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const btnTextStyle = getCheckoutTextStyle(s, 'button')
                                    const styleId = s.button_style || 'default'
                                    const btnRgb = hexToRgb(btn)
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        minHeight: CHECKOUT_PREVIEW_HEIGHT,
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="transaction-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                                          <div style={{ height: '32px', marginBottom: '4px' }} />
                                          <div className="screen-header" style={{ marginTop: 0, marginBottom: '20px' }}>
                                            <h2 style={titleStyle}>Review Your Order</h2>
                                          </div>
                                          <div className="items-list" style={bodyStyle}>
                                            <div className="item-row">
                                              <span className="item-name">Sample Item</span>
                                              <span className="item-price">$9.99</span>
                                            </div>
                                            <div className="item-row">
                                              <span className="item-name">Another Item</span>
                                              <span className="item-quantity">× 2</span>
                                              <span className="item-price">$24.00</span>
                                            </div>
                                          </div>
                                          <div className="totals-section" style={bodyStyle}>
                                            <div className="total-row"><span>Subtotal:</span><span>$33.99</span></div>
                                            <div className="total-row"><span>Tax:</span><span>$2.72</span></div>
                                            <div className="total-row final"><span>Total:</span><span>$36.71</span></div>
                                          </div>
                                          <div style={{ display: 'flex', gap: '20px', width: '100%', marginTop: '20px' }}>
                                            {renderCheckoutPreviewButton('Cash', styleId, btn, btnTextStyle)}
                                            {renderCheckoutPreviewButton('Card', styleId, btn, btnTextStyle)}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'cash_confirmation' && (() => {
                                    const s = checkoutUiSettings.cash_confirmation || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const btnRgb = hexToRgb(btn)
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        minHeight: CHECKOUT_PREVIEW_HEIGHT,
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="payment-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '10px', marginTop: '-10px' }}>
                                            <span style={{ padding: '6px 12px', fontSize: '12px', opacity: 0 }}>Cancel</span>
                                            <span style={{ padding: '6px 12px', fontSize: '12px', opacity: 0 }}>Continue</span>
                                          </div>
                                          <div className="screen-header" style={{ width: '100%', marginBottom: '20px' }}>
                                            <h2 style={{ margin: 0, ...titleStyle }}>Please give the cash amount to the cashier</h2>
                                          </div>
                                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                            <div className="totals-section" style={{ background: `rgba(${btnRgb}, 0.15)`, borderRadius: '15px', padding: '20px', width: '100%', ...bodyStyle }}>
                                              <div className="total-row"><span>Subtotal:</span><span>$33.99</span></div>
                                              <div className="total-row"><span>Tax:</span><span>$2.72</span></div>
                                              <div className="total-row final"><span>Total:</span><span>$36.71</span></div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'tip_selection' && (() => {
                                    const s = checkoutUiSettings.tip_selection || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const btnTextStyle = getCheckoutTextStyle(s, 'button')
                                    const btnRgb = hexToRgb(btn)
                                    const tipBtnBase = {
                                      aspectRatio: '1',
                                      minHeight: 0,
                                      padding: '16px',
                                      backgroundColor: btn,
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '8px',
                                      textAlign: 'center',
                                      cursor: 'default',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      ...btnTextStyle
                                    }
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        minHeight: CHECKOUT_PREVIEW_HEIGHT,
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="payment-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '8px' }}>
                                            <span />
                                          </div>
                                          <div className="screen-header" style={titleStyle}>
                                            <h2>Add a tip?</h2>
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', width: '100%', maxWidth: '400px', margin: '0 auto', flex: 1, alignContent: 'start' }}>
                                            {[15, 18, 20].map((pct) => (
                                              <div key={pct} style={{ ...tipBtnBase }}>
                                                <div style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 600, marginBottom: '4px' }}>{pct}%</div>
                                                <div style={{ fontSize: 'clamp(16px, 3.5vw, 20px)', opacity: 0.95 }}>${(36.71 * pct / 100).toFixed(2)}</div>
                                              </div>
                                            ))}
                                            <div style={{ ...tipBtnBase }}>
                                              No tip
                                            </div>
                                            <div style={{
                                              gridColumn: '1 / -1',
                                              padding: '20px 16px',
                                              backgroundColor: `rgba(${btnRgb}, 0.35)`,
                                              color: tc,
                                              border: `2px solid ${btn}`,
                                              borderRadius: '8px',
                                              textAlign: 'center',
                                              cursor: 'default',
                                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: 'clamp(18px, 4vw, 22px)',
                                              fontWeight: 600,
                                              ...btnTextStyle
                                            }}>
                                              Custom
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'card' && (() => {
                                    const s = checkoutUiSettings.card || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const tc = s.textColor || '#1a1a1a'
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const instructionText = s.instruction_text ?? 'Please insert or tap your card'
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        minHeight: CHECKOUT_PREVIEW_HEIGHT,
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: bodyStyle.fontFamily || 'system-ui',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="card-processing-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', justifyContent: 'flex-start', alignItems: 'stretch' }}>
                                          <div style={{ height: '32px', marginBottom: '10px', marginTop: '-10px' }} />
                                          <div className="card-animation" style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', marginTop: '24px' }}>
                                            <img src="/contactless-svgrepo-com.svg" alt="" style={{ width: '200px', height: '200px', color: 'inherit' }} />
                                          </div>
                                          <div className="card-instruction" style={{ fontSize: '1.25rem', textAlign: 'center', ...bodyStyle }}>
                                            {instructionText}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'receipt' && (() => {
                                    const s = checkoutUiSettings.receipt || {}
                                    const opts = s.receipt_options_offered || {}
                                    const showPrint = opts.print !== false
                                    const showEmail = opts.email !== false
                                    const showNoReceipt = opts.no_receipt !== false
                                    const hasAnyOption = showPrint || showEmail || showNoReceipt
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const btnTextStyle = getCheckoutTextStyle(s, 'button')
                                    const styleId = s.button_style || 'default'
                                    const sigBg = s.signature_background || '#ffffff'
                                    const sigBorderW = s.signature_border_width ?? 2
                                    const sigBorderColor = s.signature_border_color || 'rgba(0,0,0,0.2)'
                                    const sigInk = s.signature_ink_color || '#000000'
                                    const btnRgb = hexToRgb(btn)
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        minHeight: CHECKOUT_PREVIEW_HEIGHT,
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="receipt-screen-popup" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                                          <div className="screen-header" style={{ width: '100%', marginBottom: '30px' }}>
                                            <h2 style={titleStyle}>Sign Below</h2>
                                          </div>
                                          <div style={{
                                            width: '100%',
                                            height: '250px',
                                            border: `${sigBorderW}px solid ${sigBorderColor}`,
                                            borderRadius: '8px',
                                            backgroundColor: sigBg,
                                            marginBottom: '30px',
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: sigInk,
                                            ...bodyStyle
                                          }}>
                                            Signature area
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', marginTop: '20px' }}>
                                            {!hasAnyOption ? (
                                              <>
                                                <div style={{ textAlign: 'center', fontSize: '18px', color: tc, opacity: 0.9 }}>Thank you for your purchase</div>
                                                {renderCheckoutPreviewButton('Done', styleId, btn, btnTextStyle, true)}
                                              </>
                                            ) : (
                                              <>
                                                <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
                                                  {showPrint && renderCheckoutPreviewButton('Print', styleId, btn, btnTextStyle)}
                                                  {showNoReceipt && renderCheckoutPreviewButton('No Receipt', styleId, btn, btnTextStyle)}
                                                </div>
                                                {showEmail && renderCheckoutPreviewButton('Email', styleId, btn, btnTextStyle, true)}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Checkout UI Edit modal – left: controls, right: exact checkout preview */}
                    {checkoutUiEditModalOpen && (
                      <div
                        style={{ ...modalOverlayStyle(isDarkMode, 99999), padding: '24px' }}
                        onClick={() => setCheckoutUiEditModalOpen(false)}
                      >
                        <div
                          style={{
                            ...modalContentStyle(isDarkMode, {
                              borderRadius: '12px',
                              maxWidth: '95vw',
                              width: 360 + (CHECKOUT_PREVIEW_WIDTH * 0.75) + 32,
                              height: '72vh',
                              maxHeight: '90vh',
                              padding: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden'
                            }),
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                            {/* Left column: header (tabs) + scrollable controls + footer (Cancel, Save, Undo, Redo) */}
                            <div style={{ flex: '0 0 360px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#e0e0e0'}` }}>
                              <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
                                <div style={{ position: 'relative' }}>
                                  <div
                                    className="checkout-ui-tabs-scroll"
                                    style={{
                                      display: 'flex',
                                      gap: '8px',
                                      flexWrap: 'nowrap',
                                      overflowX: 'auto',
                                      paddingBottom: 0,
                                      scrollbarWidth: 'none',
                                      msOverflowStyle: 'none'
                                    }}
                                  >
                                    {[
                                      { id: 'review_order', label: 'Review Your Order' },
                                      { id: 'cash_confirmation', label: 'Cash to Cashier' },
                                      { id: 'tip_selection', label: 'Tip Selection' },
                                      { id: 'card', label: 'Tap or Insert Card' },
                                      { id: 'receipt', label: 'Sign Below' }
                                    ].map(({ id, label }) => {
                                      const isActive = checkoutUiTab === id
                                      return (
                                        <button
                                          key={id}
                                          type="button"
                                          onClick={() => setCheckoutUiTab(id)}
                                          style={{
                                            padding: '4px 16px',
                                            height: '28px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            whiteSpace: 'nowrap',
                                            backgroundColor: isActive
                                              ? `rgba(${themeColorRgb}, 0.7)`
                                              : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                                            border: isActive
                                              ? `1px solid rgba(${themeColorRgb}, 0.5)`
                                              : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: isActive ? 600 : 500,
                                            color: isActive ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            boxShadow: isActive ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                                          }}
                                        >
                                          {label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: '20px',
                                    background: `linear-gradient(to right, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`,
                                    pointerEvents: 'none',
                                    zIndex: 1
                                  }} />
                                  <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: '20px',
                                    background: `linear-gradient(to left, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`,
                                    pointerEvents: 'none',
                                    zIndex: 1
                                  }} />
                                </div>
                              </div>
                              <div className="checkout-ui-controls-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}>
                                <FormField>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Background color</FormLabel>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                      <div style={{ position: 'absolute', inset: 0, background: checkoutUiSettings[checkoutUiTab]?.backgroundColor || '#e8f0fe' }} />
                                      <input type="color" value={checkoutUiSettings[checkoutUiTab]?.backgroundColor || '#e8f0fe'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), backgroundColor: e.target.value } }))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', opacity: 0, cursor: 'pointer' }} />
                                    </div>
                                    <input type="text" value={checkoutUiSettings[checkoutUiTab]?.backgroundColor || '#e8f0fe'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), backgroundColor: e.target.value } }))} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', minWidth: '80px', fontSize: '13px' }} />
                                  </div>
                                </FormField>
                                <FormField>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Button color</FormLabel>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                      <div style={{ position: 'absolute', inset: 0, background: checkoutUiSettings[checkoutUiTab]?.buttonColor || '#4a90e2' }} />
                                      <input type="color" value={checkoutUiSettings[checkoutUiTab]?.buttonColor || '#4a90e2'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), buttonColor: e.target.value } }))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', opacity: 0, cursor: 'pointer' }} />
                                    </div>
                                    <input type="text" value={checkoutUiSettings[checkoutUiTab]?.buttonColor || '#4a90e2'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), buttonColor: e.target.value } }))} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', minWidth: '80px', fontSize: '13px' }} />
                                  </div>
                                </FormField>
                                <FormField>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Text color (body)</FormLabel>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                      <div style={{ position: 'absolute', inset: 0, background: checkoutUiSettings[checkoutUiTab]?.textColor || '#1a1a1a' }} />
                                      <input type="color" value={checkoutUiSettings[checkoutUiTab]?.textColor || '#1a1a1a'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), textColor: e.target.value } }))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', opacity: 0, cursor: 'pointer' }} />
                                    </div>
                                    <input type="text" value={checkoutUiSettings[checkoutUiTab]?.textColor || '#1a1a1a'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), textColor: e.target.value } }))} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', minWidth: '80px', fontSize: '13px' }} />
                                  </div>
                                </FormField>
                                <FormField>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Title text</FormLabel>
                                  <TextFormattingToolbar
                                    font={checkoutUiSettings[checkoutUiTab]?.title_font || 'system-ui'}
                                    onFontChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), title_font: e.target.value } }))}
                                    fontSize={checkoutUiSettings[checkoutUiTab]?.title_font_size ?? 36}
                                    onFontSizeChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), title_font_size: Math.min(72, Math.max(12, Number(e.target.value) || 36)) } }))}
                                    bold={checkoutUiSettings[checkoutUiTab]?.title_bold}
                                    onBoldToggle={() => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), title_bold: !(prev[checkoutUiTab]?.title_bold) } }))}
                                    italic={checkoutUiSettings[checkoutUiTab]?.title_italic}
                                    onItalicToggle={() => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), title_italic: !(prev[checkoutUiTab]?.title_italic) } }))}
                                    align={checkoutUiSettings[checkoutUiTab]?.title_align || 'center'}
                                    onAlignChange={(align) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), title_align: align } }))}
                                    isDarkMode={isDarkMode}
                                    themeColorRgb={themeColorRgb}
                                  />
                                </FormField>
                                <FormField>
                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Body / section text</FormLabel>
                                  <TextFormattingToolbar
                                    font={checkoutUiSettings[checkoutUiTab]?.body_font || 'system-ui'}
                                    onFontChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), body_font: e.target.value } }))}
                                    fontSize={checkoutUiSettings[checkoutUiTab]?.body_font_size ?? 24}
                                    onFontSizeChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), body_font_size: Math.min(48, Math.max(10, Number(e.target.value) || 24)) } }))}
                                    bold={checkoutUiSettings[checkoutUiTab]?.body_bold}
                                    onBoldToggle={() => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), body_bold: !(prev[checkoutUiTab]?.body_bold) } }))}
                                    italic={checkoutUiSettings[checkoutUiTab]?.body_italic}
                                    onItalicToggle={() => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), body_italic: !(prev[checkoutUiTab]?.body_italic) } }))}
                                    align={checkoutUiSettings[checkoutUiTab]?.body_align || 'left'}
                                    onAlignChange={(align) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), body_align: align } }))}
                                    isDarkMode={isDarkMode}
                                    themeColorRgb={themeColorRgb}
                                  />
                                </FormField>
                                {checkoutUiTab === 'card' && (
                                  <FormField>
                                    <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Instruction message</FormLabel>
                                    <input
                                      type="text"
                                      value={checkoutUiSettings.card?.instruction_text ?? 'Please insert or tap your card'}
                                      onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, card: { ...(prev.card || {}), instruction_text: e.target.value || 'Please insert or tap your card' } }))}
                                      placeholder="Please insert or tap your card"
                                      style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '100%', fontSize: '13px' }}
                                    />
                                    <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '6px', lineHeight: 1.4 }}>Shown below the contactless icon on the card screen.</p>
                                  </FormField>
                                )}
                                {(checkoutUiTab === 'review_order' || checkoutUiTab === 'tip_selection' || checkoutUiTab === 'receipt') && (
                                  <>
                                    <FormField>
                                      <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Button style</FormLabel>
                                      <CustomDropdown
                                        value={checkoutUiSettings[checkoutUiTab]?.button_style || 'default'}
                                        onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), button_style: e.target.value } }))}
                                        options={CHECKOUT_BUTTON_STYLES}
                                        placeholder="Style"
                                        isDarkMode={isDarkMode}
                                        themeColorRgb={themeColorRgb}
                                        style={{ width: '100%' }}
                                      />
                                    </FormField>
                                    <FormField>
                                      <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Button text</FormLabel>
                                      <TextFormattingToolbar
                                        font={checkoutUiSettings[checkoutUiTab]?.button_font || 'system-ui'}
                                        onFontChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), button_font: e.target.value } }))}
                                        fontSize={checkoutUiSettings[checkoutUiTab]?.button_font_size ?? 36}
                                        onFontSizeChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), button_font_size: Math.min(48, Math.max(12, Number(e.target.value) || 36)) } }))}
                                        bold={checkoutUiSettings[checkoutUiTab]?.button_bold !== false}
                                        onBoldToggle={() => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), button_bold: !(prev[checkoutUiTab]?.button_bold !== false) } }))}
                                        italic={checkoutUiSettings[checkoutUiTab]?.button_italic}
                                        onItalicToggle={() => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, [checkoutUiTab]: { ...(prev[checkoutUiTab] || {}), button_italic: !(prev[checkoutUiTab]?.button_italic) } }))}
                                        align="center"
                                        onAlignChange={() => { }}
                                        isDarkMode={isDarkMode}
                                        themeColorRgb={themeColorRgb}
                                      />
                                    </FormField>
                                  </>
                                )}
                                {checkoutUiTab === 'receipt' && (
                                  <>
                                    <FormField>
                                      <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Signature area background</FormLabel>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                          <div style={{ position: 'absolute', inset: 0, background: checkoutUiSettings.receipt?.signature_background || '#ffffff' }} />
                                          <input type="color" value={checkoutUiSettings.receipt?.signature_background || '#ffffff'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, receipt: { ...(prev.receipt || {}), signature_background: e.target.value } }))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', opacity: 0, cursor: 'pointer' }} />
                                        </div>
                                        <input type="text" value={checkoutUiSettings.receipt?.signature_background || '#ffffff'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, receipt: { ...(prev.receipt || {}), signature_background: e.target.value } }))} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', minWidth: '80px', fontSize: '13px' }} />
                                      </div>
                                    </FormField>
                                    <FormField>
                                      <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Signature border (outline)</FormLabel>
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <label style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>Width</label>
                                          <input type="number" min={0} max={8} value={checkoutUiSettings.receipt?.signature_border_width ?? 2} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, receipt: { ...(prev.receipt || {}), signature_border_width: Math.min(8, Math.max(0, Number(e.target.value) || 0)) } }))} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '56px', fontSize: '13px' }} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', inset: 0, background: (typeof checkoutUiSettings.receipt?.signature_border_color === 'string' && checkoutUiSettings.receipt.signature_border_color.startsWith('#')) ? checkoutUiSettings.receipt.signature_border_color : '#000000' }} />
                                            <input type="color" value={typeof checkoutUiSettings.receipt?.signature_border_color === 'string' && checkoutUiSettings.receipt.signature_border_color.startsWith('#') ? checkoutUiSettings.receipt.signature_border_color : '#000000'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, receipt: { ...(prev.receipt || {}), signature_border_color: e.target.value } }))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', opacity: 0, cursor: 'pointer' }} />
                                          </div>
                                          <input type="text" value={checkoutUiSettings.receipt?.signature_border_color || 'rgba(0,0,0,0.2)'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, receipt: { ...(prev.receipt || {}), signature_border_color: e.target.value } }))} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', minWidth: '80px', fontSize: '13px' }} />
                                        </div>
                                      </div>
                                    </FormField>
                                    <FormField>
                                      <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Signature ink color</FormLabel>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                                          <div style={{ position: 'absolute', inset: 0, background: checkoutUiSettings.receipt?.signature_ink_color || '#000000' }} />
                                          <input type="color" value={checkoutUiSettings.receipt?.signature_ink_color || '#000000'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, receipt: { ...(prev.receipt || {}), signature_ink_color: e.target.value } }))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', opacity: 0, cursor: 'pointer' }} />
                                        </div>
                                        <input type="text" value={checkoutUiSettings.receipt?.signature_ink_color || '#000000'} onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({ ...prev, receipt: { ...(prev.receipt || {}), signature_ink_color: e.target.value } }))} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', minWidth: '80px', fontSize: '13px' }} />
                                      </div>
                                    </FormField>
                                    <FormField>
                                      <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '8px', display: 'block' }}>Receipt options shown at checkout</FormLabel>
                                      <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '10px', lineHeight: 1.4 }}>
                                        Choose which buttons customers see on the Sign Below screen after payment.
                                      </p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                          <div className="checkbox-wrapper-2">
                                            <input
                                              type="checkbox"
                                              className="sc-gJwTLC ikxBAC"
                                              checked={(checkoutUiSettings.receipt?.receipt_options_offered?.print !== false)}
                                              onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({
                                                ...prev,
                                                receipt: {
                                                  ...(prev.receipt || {}),
                                                  receipt_options_offered: {
                                                    ...(prev.receipt?.receipt_options_offered || { print: true, email: true, no_receipt: true }),
                                                    print: e.target.checked
                                                  }
                                                }
                                              }))}
                                            />
                                          </div>
                                          <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Offer Print</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                          <div className="checkbox-wrapper-2">
                                            <input
                                              type="checkbox"
                                              className="sc-gJwTLC ikxBAC"
                                              checked={(checkoutUiSettings.receipt?.receipt_options_offered?.email !== false)}
                                              onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({
                                                ...prev,
                                                receipt: {
                                                  ...(prev.receipt || {}),
                                                  receipt_options_offered: {
                                                    ...(prev.receipt?.receipt_options_offered || { print: true, email: true, no_receipt: true }),
                                                    email: e.target.checked
                                                  }
                                                }
                                              }))}
                                            />
                                          </div>
                                          <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Offer Email</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                          <div className="checkbox-wrapper-2">
                                            <input
                                              type="checkbox"
                                              className="sc-gJwTLC ikxBAC"
                                              checked={(checkoutUiSettings.receipt?.receipt_options_offered?.no_receipt !== false)}
                                              onChange={(e) => setCheckoutUiSettingsWithUndo(prev => ({
                                                ...prev,
                                                receipt: {
                                                  ...(prev.receipt || {}),
                                                  receipt_options_offered: {
                                                    ...(prev.receipt?.receipt_options_offered || { print: true, email: true, no_receipt: true }),
                                                    no_receipt: e.target.checked
                                                  }
                                                }
                                              }))}
                                            />
                                          </div>
                                          <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Offer No Receipt</span>
                                        </label>
                                      </div>
                                    </FormField>
                                  </>
                                )}
                              </div>
                              <div style={{ padding: '12px 16px', borderTop: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#e0e0e0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={handleCheckoutUiUndo}
                                  disabled={checkoutUiUndoStack.length === 0}
                                  title="Undo"
                                  style={{
                                    padding: 0, border: 'none', background: 'none',
                                    color: checkoutUiUndoStack.length === 0 ? (isDarkMode ? 'var(--text-tertiary, #666)' : '#999') : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                                    cursor: checkoutUiUndoStack.length === 0 ? 'default' : 'pointer',
                                    opacity: checkoutUiUndoStack.length === 0 ? 0.5 : 1
                                  }}
                                >
                                  <Undo2 size={18} strokeWidth={2.5} />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCheckoutUiRedo}
                                  disabled={checkoutUiRedoStack.length === 0}
                                  title="Redo"
                                  style={{
                                    padding: 0, border: 'none', background: 'none',
                                    color: checkoutUiRedoStack.length === 0 ? (isDarkMode ? 'var(--text-tertiary, #666)' : '#999') : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                                    cursor: checkoutUiRedoStack.length === 0 ? 'default' : 'pointer',
                                    opacity: checkoutUiRedoStack.length === 0 ? 0.5 : 1
                                  }}
                                >
                                  <Redo2 size={18} strokeWidth={2.5} />
                                </button>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                                  <button
                                    type="button"
                                    className="button-26 button-26--header"
                                    role="button"
                                    onClick={() => setCheckoutUiEditModalOpen(false)}
                                  >
                                    <div className="button-26__content"><span className="button-26__text text">Cancel</span></div>
                                  </button>
                                  <button
                                    type="button"
                                    className="button-26 button-26--header"
                                    role="button"
                                    onClick={async () => {
                                      setSaving(true)
                                      setMessage(null)
                                      try {
                                        const sessionToken = localStorage.getItem('sessionToken')
                                        const res = await fetch('/api/customer-display/settings', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                                          body: JSON.stringify({ checkout_ui: checkoutUiSettings })
                                        })
                                        const data = await res.json()
                                        if (data.success) {
                                          const saved = data.data?.checkout_ui
                                          if (saved != null && typeof saved === 'object') {
                                            setCheckoutUiSettings(mergeCheckoutUiFromApi(saved))
                                          }
                                          setCheckoutUiEditModalOpen(false)
                                          setMessage({ type: 'success', text: 'Saved' })
                                          setTimeout(() => setMessage(null), 3000)
                                          loadDisplaySettings().catch(() => { })
                                        } else {
                                          setMessage({ type: 'error', text: data.message || 'Failed to save' })
                                        }
                                      } catch (err) {
                                        console.error(err)
                                        setMessage({ type: 'error', text: 'Failed to save' })
                                      } finally {
                                        setSaving(false)
                                      }
                                    }}
                                    disabled={saving}
                                  >
                                    <div className="button-26__content"><span className="button-26__text text">{saving ? 'Saving…' : 'Save'}</span></div>
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff', maxWidth: CHECKOUT_PREVIEW_WIDTH * 0.75 + 32 }}>
                              <div style={{ width: CHECKOUT_PREVIEW_WIDTH * 0.75, height: CHECKOUT_PREVIEW_HEIGHT * 0.75, flexShrink: 0, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                                <div style={{ width: CHECKOUT_PREVIEW_WIDTH, height: CHECKOUT_PREVIEW_HEIGHT, transform: 'scale(0.75)', transformOrigin: 'top left' }}>
                                  {checkoutUiTab === 'review_order' && (() => {
                                    const s = checkoutUiSettings.review_order || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const btnTextStyle = getCheckoutTextStyle(s, 'button')
                                    const styleId = s.button_style || 'default'
                                    const btnRgb = hexToRgb(btn)
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="transaction-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                                          <div style={{ height: '32px', marginBottom: '4px' }} />
                                          <div className="screen-header" style={{ marginTop: 0, marginBottom: '20px' }}>
                                            <h2 style={titleStyle}>Review Your Order</h2>
                                          </div>
                                          <div className="items-list" style={bodyStyle}>
                                            <div className="item-row">
                                              <span className="item-name">Sample Item</span>
                                              <span className="item-price">$9.99</span>
                                            </div>
                                            <div className="item-row">
                                              <span className="item-name">Another Item</span>
                                              <span className="item-quantity">× 2</span>
                                              <span className="item-price">$24.00</span>
                                            </div>
                                          </div>
                                          <div className="totals-section" style={bodyStyle}>
                                            <div className="total-row"><span>Subtotal:</span><span>$33.99</span></div>
                                            <div className="total-row"><span>Tax:</span><span>$2.72</span></div>
                                            <div className="total-row final"><span>Total:</span><span>$36.71</span></div>
                                          </div>
                                          <div style={{ display: 'flex', gap: '20px', width: '100%', marginTop: '20px' }}>
                                            {renderCheckoutPreviewButton('Cash', styleId, btn, btnTextStyle)}
                                            {renderCheckoutPreviewButton('Card', styleId, btn, btnTextStyle)}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'tip_selection' && (() => {
                                    const s = checkoutUiSettings.tip_selection || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const btnTextStyle = getCheckoutTextStyle(s, 'button')
                                    const btnRgb = hexToRgb(btn)
                                    const tipBtnBase = {
                                      aspectRatio: '1',
                                      minHeight: 0,
                                      padding: '16px',
                                      backgroundColor: btn,
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '8px',
                                      textAlign: 'center',
                                      cursor: 'default',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      ...btnTextStyle
                                    }
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        minHeight: CHECKOUT_PREVIEW_HEIGHT,
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="payment-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '8px' }}>
                                            <span />
                                          </div>
                                          <div className="screen-header" style={titleStyle}>
                                            <h2>Add a tip?</h2>
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', width: '100%', maxWidth: '400px', margin: '0 auto', flex: 1, alignContent: 'start' }}>
                                            {[15, 18, 20].map((pct) => (
                                              <div key={pct} style={{ ...tipBtnBase }}>
                                                <div style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 600, marginBottom: '4px' }}>{pct}%</div>
                                                <div style={{ fontSize: 'clamp(16px, 3.5vw, 20px)', opacity: 0.95 }}>${(36.71 * pct / 100).toFixed(2)}</div>
                                              </div>
                                            ))}
                                            <div style={{ ...tipBtnBase }}>
                                              No tip
                                            </div>
                                            <div style={{
                                              gridColumn: '1 / -1',
                                              padding: '20px 16px',
                                              backgroundColor: `rgba(${btnRgb}, 0.35)`,
                                              color: tc,
                                              border: `2px solid ${btn}`,
                                              borderRadius: '8px',
                                              textAlign: 'center',
                                              cursor: 'default',
                                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: 'clamp(18px, 4vw, 22px)',
                                              fontWeight: 600,
                                              ...btnTextStyle
                                            }}>
                                              Custom
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'card' && (() => {
                                    const s = checkoutUiSettings.card || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const tc = s.textColor || '#1a1a1a'
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const instructionText = s.instruction_text ?? 'Please insert or tap your card'
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: bodyStyle.fontFamily || 'system-ui',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="card-processing-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', justifyContent: 'flex-start', alignItems: 'stretch' }}>
                                          <div style={{ height: '32px', marginBottom: '10px', marginTop: '-10px' }} />
                                          <div className="card-animation" style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', marginTop: '48px' }}>
                                            <img src="/contactless-svgrepo-com.svg" alt="" style={{ width: '320px', height: '320px', color: 'inherit' }} />
                                          </div>
                                          <div className="card-instruction" style={{ fontSize: '1.25rem', textAlign: 'center', ...bodyStyle }}>
                                            {instructionText}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'cash_confirmation' && (() => {
                                    const s = checkoutUiSettings.cash_confirmation || {}
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const btnRgb = hexToRgb(btn)
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="payment-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '10px', marginTop: '-10px' }}>
                                            <span style={{ padding: '6px 12px', fontSize: '12px', opacity: 0 }}>Cancel</span>
                                            <span style={{ padding: '6px 12px', fontSize: '12px', opacity: 0 }}>Continue</span>
                                          </div>
                                          <div className="screen-header" style={{ width: '100%', marginBottom: '20px' }}>
                                            <h2 style={{ margin: 0, ...titleStyle }}>Please give the cash amount to the cashier</h2>
                                          </div>
                                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                            <div className="totals-section" style={{ background: `rgba(${btnRgb}, 0.15)`, borderRadius: '15px', padding: '20px', width: '100%', ...bodyStyle }}>
                                              <div className="total-row"><span>Subtotal:</span><span>$33.99</span></div>
                                              <div className="total-row"><span>Tax:</span><span>$2.72</span></div>
                                              <div className="total-row final"><span>Total:</span><span>$36.71</span></div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  {checkoutUiTab === 'receipt' && (() => {
                                    const s = checkoutUiSettings.receipt || {}
                                    const opts = s.receipt_options_offered || {}
                                    const showPrint = opts.print !== false
                                    const showEmail = opts.email !== false
                                    const showNoReceipt = opts.no_receipt !== false
                                    const hasAnyOption = showPrint || showEmail || showNoReceipt
                                    const bg = s.backgroundColor || '#e8f0fe'
                                    const btn = s.buttonColor || '#4a90e2'
                                    const tc = s.textColor || '#1a1a1a'
                                    const titleStyle = getCheckoutTextStyle(s, 'title')
                                    const bodyStyle = getCheckoutTextStyle(s, 'body')
                                    const btnTextStyle = getCheckoutTextStyle(s, 'button')
                                    const styleId = s.button_style || 'default'
                                    const sigBg = s.signature_background || '#ffffff'
                                    const sigBorderW = s.signature_border_width ?? 2
                                    const sigBorderColor = s.signature_border_color || 'rgba(0,0,0,0.2)'
                                    const sigInk = s.signature_ink_color || '#000000'
                                    const btnRgb = hexToRgb(btn)
                                    return (
                                      <div className="customer-display-popup-container" style={{
                                        ['--customer-display-theme-color-rgb']: btnRgb,
                                        padding: '20px',
                                        width: '100%',
                                        height: '100%',
                                        boxSizing: 'border-box',
                                        backgroundColor: bg,
                                        color: tc,
                                        fontFamily: titleStyle.fontFamily || 'system-ui',
                                        fontWeight: titleStyle.fontWeight || '600',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderRadius: 0,
                                        boxShadow: 'none',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                      }}>
                                        <div className="receipt-screen-popup" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                                          <div className="screen-header" style={{ width: '100%', marginBottom: '30px' }}>
                                            <h2 style={titleStyle}>Sign Below</h2>
                                          </div>
                                          <div style={{
                                            width: '100%',
                                            height: '250px',
                                            border: `${sigBorderW}px solid ${sigBorderColor}`,
                                            borderRadius: '8px',
                                            backgroundColor: sigBg,
                                            marginBottom: '30px',
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: sigInk,
                                            ...bodyStyle
                                          }}>
                                            Signature area
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', marginTop: '20px' }}>
                                            {!hasAnyOption ? (
                                              <>
                                                <div style={{ textAlign: 'center', fontSize: '18px', color: tc, opacity: 0.9 }}>Thank you for your purchase</div>
                                                {renderCheckoutPreviewButton('Done', styleId, btn, btnTextStyle, true)}
                                              </>
                                            ) : (
                                              <>
                                                <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
                                                  {showPrint && renderCheckoutPreviewButton('Print', styleId, btn, btnTextStyle)}
                                                  {showNoReceipt && renderCheckoutPreviewButton('No Receipt', styleId, btn, btnTextStyle)}
                                                </div>
                                                {showEmail && renderCheckoutPreviewButton('Email', styleId, btn, btnTextStyle, true)}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Receipt Edit modal – same style as Checkout UI: left controls, right preview */}
                    {receiptEditModalOpen && (
                      <div
                        style={{ ...modalOverlayStyle(isDarkMode, 99999), padding: '24px' }}
                        onClick={() => setReceiptEditModalOpen(false)}
                      >
                        <div
                          style={{
                            ...modalContentStyle(isDarkMode, {
                              borderRadius: '12px',
                              maxWidth: '95vw',
                              width: receiptEditorView === 'email' ? '900px' : '720px',
                              height: receiptEditorView === 'email' ? '85vh' : '72vh',
                              maxHeight: '90vh',
                              padding: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                              transition: 'width 0.35s ease, height 0.35s ease'
                            }),
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                            <div style={{ flex: '0 0 360px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#e0e0e0'}` }}>
                              <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
                                <div style={{ position: 'relative' }}>
                                  <div
                                    className="checkout-ui-tabs-scroll"
                                    style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 0, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                  >
                                    {['header', 'customer_order', 'body_items', 'body_totals', 'body_barcode', 'footer', 'styling'].map(s => {
                                      const labels = { header: 'Header', customer_order: 'Customer & Order', body_items: 'Line items', body_totals: 'Totals', body_barcode: 'Date & barcode', footer: 'Footer', styling: 'Styling' }
                                      const isActive = activeReceiptSection === s
                                      return (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => setActiveReceiptSection(isActive ? null : s)}
                                          style={{
                                            padding: '4px 16px', height: '28px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
                                            backgroundColor: isActive ? `rgba(${themeColorRgb}, 0.7)` : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                                            border: isActive ? `1px solid rgba(${themeColorRgb}, 0.5)` : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                                            borderRadius: '8px', fontSize: '14px', fontWeight: isActive ? 600 : 500,
                                            color: isActive ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                                            cursor: 'pointer', transition: 'all 0.3s ease',
                                            boxShadow: isActive ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                                          }}
                                        >
                                          {labels[s]}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '20px', background: `linear-gradient(to right, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`, pointerEvents: 'none', zIndex: 1 }} />
                                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '20px', background: `linear-gradient(to left, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`, pointerEvents: 'none', zIndex: 1 }} />
                                </div>
                              </div>
                              <div className="checkout-ui-controls-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}>
                                {activeReceiptSection && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                    {/* Header Settings */}
                                    {activeReceiptSection === 'header' && (
                                      <>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Store name</FormLabel>
                                          <input type="text" placeholder="Store" value={receiptSettings.store_name ?? ''} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_name: e.target.value })} style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />

                                          {/* Toolbar - Google Docs style */}
                                          <TextFormattingToolbar
                                            font={receiptSettings.store_name_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_name_font: e.target.value })}
                                            fontSize={receiptSettings.store_name_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_name_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 14)) })}
                                            bold={receiptSettings.store_name_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_name_bold: !receiptSettings.store_name_bold })}
                                            italic={receiptSettings.store_name_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_name_italic: !receiptSettings.store_name_italic })}
                                            align={receiptSettings.store_name_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, store_name_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Store address (multiple lines)</FormLabel>
                                          <textarea placeholder="Street, City, State ZIP" value={receiptSettings.store_address ?? ''} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_address: e.target.value })} rows={2} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), resize: 'vertical', fontFamily: 'inherit', minHeight: '56px' }} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                                          <TextFormattingToolbar
                                            font={receiptSettings.store_address_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_address_font: e.target.value })}
                                            fontSize={receiptSettings.store_address_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_address_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.store_address_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_address_bold: !receiptSettings.store_address_bold })}
                                            italic={receiptSettings.store_address_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_address_italic: !receiptSettings.store_address_italic })}
                                            align={receiptSettings.store_address_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, store_address_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Phone</FormLabel>
                                          <input type="text" placeholder="Phone" value={receiptSettings.store_phone ?? ''} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_phone: e.target.value })} style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                                          <TextFormattingToolbar
                                            font={receiptSettings.store_phone_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_phone_font: e.target.value })}
                                            fontSize={receiptSettings.store_phone_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_phone_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.store_phone_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_phone_bold: !receiptSettings.store_phone_bold })}
                                            italic={receiptSettings.store_phone_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_phone_italic: !receiptSettings.store_phone_italic })}
                                            align={receiptSettings.store_phone_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, store_phone_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Logo upload</FormLabel>
                                          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setReceiptSettingsWithUndo({ ...receiptSettings, store_logo: r.result }); r.readAsDataURL(f); } }} style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666' }} />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Header alignment</FormLabel>
                                          <CustomDropdown value={receiptSettings.header_alignment || 'center'} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, header_alignment: e.target.value })} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} placeholder="Alignment" isDarkMode={isDarkMode} themeColorRgb={themeColorRgb} style={{ maxWidth: '160px' }} />
                                        </FormField>
                                      </>
                                    )}

                                    {/* Customer & Order section */}
                                    {activeReceiptSection === 'customer_order' && (
                                      <>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Show in preview</FormLabel>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={receiptSettings.preview_customer_order !== false} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, preview_customer_order: e.target.checked })} />
                                            <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Show Customer & Order section (Order Type, Customer, Phone, Address)</span>
                                          </label>
                                          <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '6px', lineHeight: 1.4 }}>This section appears on receipts for pickup and delivery orders.</p>
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Order type line (e.g. Order Type: Pickup)</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.order_type_font ?? receiptSettings.customer_order_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, order_type_font: e.target.value })}
                                            fontSize={receiptSettings.order_type_font_size ?? receiptSettings.customer_order_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, order_type_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.order_type_bold ?? receiptSettings.customer_order_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, order_type_bold: !(receiptSettings.order_type_bold ?? receiptSettings.customer_order_bold) })}
                                            italic={receiptSettings.order_type_italic ?? receiptSettings.customer_order_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, order_type_italic: !(receiptSettings.order_type_italic ?? receiptSettings.customer_order_italic) })}
                                            align={receiptSettings.order_type_align ?? receiptSettings.customer_order_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, order_type_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Customer name line</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.customer_name_font ?? receiptSettings.customer_order_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_name_font: e.target.value })}
                                            fontSize={receiptSettings.customer_name_font_size ?? receiptSettings.customer_order_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_name_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.customer_name_bold ?? receiptSettings.customer_order_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, customer_name_bold: !(receiptSettings.customer_name_bold ?? receiptSettings.customer_order_bold) })}
                                            italic={receiptSettings.customer_name_italic ?? receiptSettings.customer_order_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, customer_name_italic: !(receiptSettings.customer_name_italic ?? receiptSettings.customer_order_italic) })}
                                            align={receiptSettings.customer_name_align ?? receiptSettings.customer_order_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_name_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Phone line</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.customer_phone_font ?? receiptSettings.customer_order_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_phone_font: e.target.value })}
                                            fontSize={receiptSettings.customer_phone_font_size ?? receiptSettings.customer_order_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_phone_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.customer_phone_bold ?? receiptSettings.customer_order_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, customer_phone_bold: !(receiptSettings.customer_phone_bold ?? receiptSettings.customer_order_bold) })}
                                            italic={receiptSettings.customer_phone_italic ?? receiptSettings.customer_order_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, customer_phone_italic: !(receiptSettings.customer_phone_italic ?? receiptSettings.customer_order_italic) })}
                                            align={receiptSettings.customer_phone_align ?? receiptSettings.customer_order_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_phone_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Address line</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.customer_address_font ?? receiptSettings.customer_order_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_address_font: e.target.value })}
                                            fontSize={receiptSettings.customer_address_font_size ?? receiptSettings.customer_order_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_address_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.customer_address_bold ?? receiptSettings.customer_order_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, customer_address_bold: !(receiptSettings.customer_address_bold ?? receiptSettings.customer_order_bold) })}
                                            italic={receiptSettings.customer_address_italic ?? receiptSettings.customer_order_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, customer_address_italic: !(receiptSettings.customer_address_italic ?? receiptSettings.customer_order_italic) })}
                                            align={receiptSettings.customer_address_align ?? receiptSettings.customer_order_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, customer_address_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                      </>
                                    )}

                                    {/* Body: 1. Line items (products & prices) */}
                                    {activeReceiptSection === 'body_items' && (
                                      <>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Item name</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.item_name_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_name_font: e.target.value })}
                                            fontSize={receiptSettings.item_name_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_name_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.item_name_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_name_bold: !receiptSettings.item_name_bold })}
                                            italic={receiptSettings.item_name_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_name_italic: !receiptSettings.item_name_italic })}
                                            align={receiptSettings.item_name_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, item_name_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <input type="checkbox" checked={!!receiptSettings.show_item_descriptions} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_item_descriptions: e.target.checked })} />
                                            <FormLabel isDarkMode={isDarkMode} style={{ margin: 0 }}>Item description</FormLabel>
                                          </div>
                                          <TextFormattingToolbar
                                            font={receiptSettings.item_desc_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_desc_font: e.target.value })}
                                            fontSize={receiptSettings.item_desc_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_desc_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 10)) })}
                                            bold={receiptSettings.item_desc_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_desc_bold: !receiptSettings.item_desc_bold })}
                                            italic={receiptSettings.item_desc_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_desc_italic: !receiptSettings.item_desc_italic })}
                                            align={receiptSettings.item_desc_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, item_desc_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <input type="checkbox" checked={!!receiptSettings.show_item_skus} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_item_skus: e.target.checked })} />
                                            <FormLabel isDarkMode={isDarkMode} style={{ margin: 0 }}>Item SKU</FormLabel>
                                          </div>
                                          <TextFormattingToolbar
                                            font={receiptSettings.item_sku_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_sku_font: e.target.value })}
                                            fontSize={receiptSettings.item_sku_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_sku_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 10)) })}
                                            bold={receiptSettings.item_sku_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_sku_bold: !receiptSettings.item_sku_bold })}
                                            italic={receiptSettings.item_sku_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_sku_italic: !receiptSettings.item_sku_italic })}
                                            align={receiptSettings.item_sku_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, item_sku_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Item price</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.item_price_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_price_font: e.target.value })}
                                            fontSize={receiptSettings.item_price_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, item_price_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.item_price_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_price_bold: !receiptSettings.item_price_bold })}
                                            italic={receiptSettings.item_price_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, item_price_italic: !receiptSettings.item_price_italic })}
                                            align={receiptSettings.item_price_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, item_price_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                      </>
                                    )}

                                    {/* Body: 2. Totals & payment */}
                                    {activeReceiptSection === 'body_totals' && (
                                      <>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                          <input type="checkbox" checked={!!receiptSettings.show_tax_breakdown} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_tax_breakdown: e.target.checked })} />
                                          <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Show tax breakdown</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                          <input type="checkbox" checked={!!receiptSettings.show_payment_method} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_payment_method: e.target.checked })} />
                                          <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Show payment method</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                          <input type="checkbox" checked={receiptSettings.show_tip !== false} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_tip: e.target.checked })} />
                                          <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Show tip in totals</span>
                                        </label>
                                        <div style={{ borderTop: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`, margin: '8px 0' }} />
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Subtotal</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.subtotal_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, subtotal_font: e.target.value })}
                                            fontSize={receiptSettings.subtotal_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, subtotal_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.subtotal_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, subtotal_bold: !receiptSettings.subtotal_bold })}
                                            italic={receiptSettings.subtotal_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, subtotal_italic: !receiptSettings.subtotal_italic })}
                                            align={receiptSettings.subtotal_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, subtotal_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <FormLabel isDarkMode={isDarkMode} style={{ margin: 0 }}>Tax</FormLabel>
                                            <CustomDropdown value={receiptSettings.tax_line_display || 'breakdown'} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, tax_line_display: e.target.value })} options={[{ value: 'single_line', label: 'Single' }, { value: 'breakdown', label: 'Breakdown' }, { value: 'none', label: 'Hide' }]} placeholder="Display" isDarkMode={isDarkMode} themeColorRgb={themeColorRgb} style={{ maxWidth: '100px' }} />
                                          </div>
                                          <TextFormattingToolbar
                                            font={receiptSettings.tax_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, tax_font: e.target.value })}
                                            fontSize={receiptSettings.tax_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, tax_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.tax_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, tax_bold: !receiptSettings.tax_bold })}
                                            italic={receiptSettings.tax_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, tax_italic: !receiptSettings.tax_italic })}
                                            align={receiptSettings.tax_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, tax_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Tip (when shown)</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.tip_font || 'monospace'}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, tip_font: e.target.value })}
                                            fontSize={receiptSettings.tip_font_size ?? 12}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, tip_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.tip_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, tip_bold: !receiptSettings.tip_bold })}
                                            italic={receiptSettings.tip_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, tip_italic: !receiptSettings.tip_italic })}
                                            align={receiptSettings.tip_align || 'right'}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, tip_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Total</FormLabel>
                                          <TextFormattingToolbar
                                            font={receiptSettings.total_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, total_font: e.target.value })}
                                            fontSize={receiptSettings.total_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, total_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 14)) })}
                                            bold={receiptSettings.total_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, total_bold: !receiptSettings.total_bold })}
                                            italic={receiptSettings.total_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, total_italic: !receiptSettings.total_italic })}
                                            align={receiptSettings.total_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, total_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <div style={{ borderTop: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`, margin: '8px 0' }} />
                                        <FormField>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <FormLabel isDarkMode={isDarkMode} style={{ margin: 0 }}>Payment method</FormLabel>
                                            <CustomDropdown value={receiptSettings.preview_payment_type || 'card'} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, preview_payment_type: e.target.value })} options={[{ value: 'card', label: 'Card' }, { value: 'cash', label: 'Cash' }, { value: 'store_credit', label: 'Store Credit' }, { value: 'check', label: 'Check' }, { value: 'mobile', label: 'Mobile' }, { value: 'not_paid_pickup', label: 'Not paid - Pickup' }, { value: 'not_paid_delivery', label: 'Not paid - Delivery' }]} placeholder="Preview" isDarkMode={isDarkMode} themeColorRgb={themeColorRgb} style={{ maxWidth: '180px', marginLeft: 'auto' }} />
                                          </div>
                                          <TextFormattingToolbar
                                            font={receiptSettings.payment_method_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, payment_method_font: e.target.value })}
                                            fontSize={receiptSettings.payment_method_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, payment_method_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 11)) })}
                                            bold={receiptSettings.payment_method_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, payment_method_bold: !receiptSettings.payment_method_bold })}
                                            italic={receiptSettings.payment_method_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, payment_method_italic: !receiptSettings.payment_method_italic })}
                                            align={receiptSettings.payment_method_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, payment_method_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                          {receiptSettings.preview_payment_type === 'cash' && (
                                            <>
                                              <div style={{ display: 'flex', gap: '12px', marginTop: '10px', marginBottom: '4px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                                  <input type="checkbox" checked={!!receiptSettings.show_cash_amount_given} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_cash_amount_given: e.target.checked })} />
                                                  Amount given
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                                  <input type="checkbox" checked={!!receiptSettings.show_cash_change} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_cash_change: e.target.checked })} />
                                                  Change
                                                </label>
                                              </div>
                                              <FormField style={{ marginTop: '6px' }}>
                                                <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block', fontSize: '12px' }}>Amount given line</FormLabel>
                                                <TextFormattingToolbar
                                                  font={receiptSettings.cash_amount_given_font}
                                                  onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, cash_amount_given_font: e.target.value })}
                                                  fontSize={receiptSettings.cash_amount_given_font_size}
                                                  onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, cash_amount_given_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 11)) })}
                                                  bold={receiptSettings.cash_amount_given_bold}
                                                  onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, cash_amount_given_bold: !receiptSettings.cash_amount_given_bold })}
                                                  italic={receiptSettings.cash_amount_given_italic}
                                                  onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, cash_amount_given_italic: !receiptSettings.cash_amount_given_italic })}
                                                  align={receiptSettings.cash_amount_given_align}
                                                  onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, cash_amount_given_align: align })}
                                                  isDarkMode={isDarkMode}
                                                  themeColorRgb={themeColorRgb}
                                                />
                                              </FormField>
                                              <FormField style={{ marginTop: '6px' }}>
                                                <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block', fontSize: '12px' }}>Change line</FormLabel>
                                                <TextFormattingToolbar
                                                  font={receiptSettings.cash_change_font}
                                                  onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, cash_change_font: e.target.value })}
                                                  fontSize={receiptSettings.cash_change_font_size}
                                                  onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, cash_change_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 11)) })}
                                                  bold={receiptSettings.cash_change_bold}
                                                  onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, cash_change_bold: !receiptSettings.cash_change_bold })}
                                                  italic={receiptSettings.cash_change_italic}
                                                  onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, cash_change_italic: !receiptSettings.cash_change_italic })}
                                                  align={receiptSettings.cash_change_align}
                                                  onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, cash_change_align: align })}
                                                  isDarkMode={isDarkMode}
                                                  themeColorRgb={themeColorRgb}
                                                />
                                              </FormField>
                                            </>
                                          )}
                                        </FormField>
                                      </>
                                    )}

                                    {/* Body: 3. Date & barcode */}
                                    {activeReceiptSection === 'body_barcode' && (
                                      <>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Date & Time</FormLabel>
                                          <div style={{ marginBottom: '8px' }}>
                                            <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '4px', display: 'block' }}>Show</span>
                                            <CustomDropdown
                                              value={receiptSettings.date_display_mode ?? 'both'}
                                              onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, date_display_mode: e.target.value })}
                                              options={[
                                                { value: 'both', label: 'Date and time' },
                                                { value: 'date_only', label: 'Date only' },
                                                { value: 'time_only', label: 'Time only' }
                                              ]}
                                              placeholder="Select"
                                              isDarkMode={isDarkMode}
                                              themeColorRgb={themeColorRgb}
                                              style={{ fontSize: '13px', padding: '6px 10px' }}
                                            />
                                          </div>
                                          <TextFormattingToolbar
                                            font={receiptSettings.date_line_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, date_line_font: e.target.value })}
                                            fontSize={receiptSettings.date_line_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, date_line_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 10)) })}
                                            bold={receiptSettings.date_line_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, date_line_bold: !receiptSettings.date_line_bold })}
                                            italic={receiptSettings.date_line_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, date_line_italic: !receiptSettings.date_line_italic })}
                                            align={receiptSettings.date_line_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, date_line_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Barcode</FormLabel>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', cursor: 'pointer', fontSize: '13px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                            <input type="checkbox" checked={receiptSettings.show_barcode !== false} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_barcode: e.target.checked })} />
                                            Show barcode
                                          </label>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', cursor: 'pointer', fontSize: '13px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                            <input type="checkbox" checked={receiptSettings.show_order_number_below_barcode !== false} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_order_number_below_barcode: e.target.checked })} />
                                            Order number below barcode
                                          </label>
                                          {receiptSettings.show_order_number_below_barcode !== false && (
                                            <TextFormattingToolbar
                                              font={receiptSettings.barcode_number_font}
                                              onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, barcode_number_font: e.target.value })}
                                              fontSize={receiptSettings.barcode_number_font_size}
                                              onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, barcode_number_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 10)) })}
                                              bold={receiptSettings.barcode_number_bold}
                                              onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, barcode_number_bold: !receiptSettings.barcode_number_bold })}
                                              italic={receiptSettings.barcode_number_italic}
                                              onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, barcode_number_italic: !receiptSettings.barcode_number_italic })}
                                              align={receiptSettings.barcode_number_align}
                                              onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, barcode_number_align: align })}
                                              isDarkMode={isDarkMode}
                                              themeColorRgb={themeColorRgb}
                                            />
                                          )}
                                        </FormField>
                                      </>
                                    )}

                                    {/* Footer Settings */}
                                    {activeReceiptSection === 'footer' && (
                                      <>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Custom message</FormLabel>
                                          <textarea placeholder="Thank you for your business!" value={receiptSettings.footer_message ?? ''} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, footer_message: e.target.value })} rows={2} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), resize: 'vertical', fontFamily: 'inherit', minHeight: '56px' }} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                                          <TextFormattingToolbar
                                            font={receiptSettings.footer_message_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, footer_message_font: e.target.value })}
                                            fontSize={receiptSettings.footer_message_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, footer_message_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.footer_message_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, footer_message_bold: !receiptSettings.footer_message_bold })}
                                            italic={receiptSettings.footer_message_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, footer_message_italic: !receiptSettings.footer_message_italic })}
                                            align={receiptSettings.footer_message_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, footer_message_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Return policy</FormLabel>
                                          <textarea placeholder="e.g. Returns within 30 days with receipt" value={receiptSettings.return_policy ?? ''} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, return_policy: e.target.value })} rows={2} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), resize: 'vertical', fontFamily: 'inherit', minHeight: '56px' }} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                                          <TextFormattingToolbar
                                            font={receiptSettings.return_policy_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, return_policy_font: e.target.value })}
                                            fontSize={receiptSettings.return_policy_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, return_policy_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.return_policy_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, return_policy_bold: !receiptSettings.return_policy_bold })}
                                            italic={receiptSettings.return_policy_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, return_policy_italic: !receiptSettings.return_policy_italic })}
                                            align={receiptSettings.return_policy_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, return_policy_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Website</FormLabel>
                                          <input type="text" placeholder="https://..." value={receiptSettings.store_website ?? ''} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_website: e.target.value })} style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                                          <TextFormattingToolbar
                                            font={receiptSettings.store_website_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_website_font: e.target.value })}
                                            fontSize={receiptSettings.store_website_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_website_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.store_website_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_website_bold: !receiptSettings.store_website_bold })}
                                            italic={receiptSettings.store_website_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_website_italic: !receiptSettings.store_website_italic })}
                                            align={receiptSettings.store_website_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, store_website_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Email</FormLabel>
                                          <input type="email" placeholder="store@example.com" value={receiptSettings.store_email ?? ''} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_email: e.target.value })} style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                                          <TextFormattingToolbar
                                            font={receiptSettings.store_email_font}
                                            onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_email_font: e.target.value })}
                                            fontSize={receiptSettings.store_email_font_size}
                                            onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, store_email_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                                            bold={receiptSettings.store_email_bold}
                                            onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_email_bold: !receiptSettings.store_email_bold })}
                                            italic={receiptSettings.store_email_italic}
                                            onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, store_email_italic: !receiptSettings.store_email_italic })}
                                            align={receiptSettings.store_email_align}
                                            onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, store_email_align: align })}
                                            isDarkMode={isDarkMode}
                                            themeColorRgb={themeColorRgb}
                                          />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Signature</FormLabel>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                            <input type="checkbox" checked={!!receiptSettings.show_signature} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_signature: e.target.checked })} />
                                            Show signature line
                                          </label>
                                          {receiptSettings.show_signature && (
                                            <>
                                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px', fontSize: '13px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                                <input type="checkbox" checked={receiptSettings.show_signature_title !== false} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, show_signature_title: e.target.checked })} />
                                                Show signature title
                                              </label>
                                              {receiptSettings.show_signature_title !== false && (
                                                <FormField style={{ marginTop: '8px' }}>
                                                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block', fontSize: '12px' }}>Signature title font</FormLabel>
                                                  <TextFormattingToolbar
                                                    font={receiptSettings.signature_title_font}
                                                    onFontChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, signature_title_font: e.target.value })}
                                                    fontSize={receiptSettings.signature_title_font_size}
                                                    onFontSizeChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, signature_title_font_size: Math.min(24, Math.max(8, Number(e.target.value) || 10)) })}
                                                    bold={receiptSettings.signature_title_bold}
                                                    onBoldToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, signature_title_bold: !receiptSettings.signature_title_bold })}
                                                    italic={receiptSettings.signature_title_italic}
                                                    onItalicToggle={() => setReceiptSettingsWithUndo({ ...receiptSettings, signature_title_italic: !receiptSettings.signature_title_italic })}
                                                    align={receiptSettings.signature_title_align}
                                                    onAlignChange={(align) => setReceiptSettingsWithUndo({ ...receiptSettings, signature_title_align: align })}
                                                    isDarkMode={isDarkMode}
                                                    themeColorRgb={themeColorRgb}
                                                  />
                                                </FormField>
                                              )}
                                            </>
                                          )}
                                        </FormField>
                                      </>
                                    )}

                                    {/* Styling Options */}
                                    {activeReceiptSection === 'styling' && (
                                      <>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Receipt width</FormLabel>
                                          <CustomDropdown value={receiptSettings.receipt_width === 58 ? 58 : 80} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, receipt_width: Number(e.target.value) })} options={[{ value: 58, label: '58mm' }, { value: 80, label: '80mm' }]} placeholder="Width" isDarkMode={isDarkMode} themeColorRgb={themeColorRgb} style={{ maxWidth: '120px' }} />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Line spacing</FormLabel>
                                          <input type="number" min={1} max={2} step={0.1} value={receiptSettings.line_spacing ?? 1.2} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, line_spacing: Math.min(2, Math.max(1, Number(e.target.value) || 1.2)) })} style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Item names</FormLabel>
                                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                            <input type="checkbox" checked={!!receiptSettings.bold_item_names} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, bold_item_names: e.target.checked })} />
                                            Bold item names
                                          </label>
                                        </FormField>
                                        <FormField>
                                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '4px', display: 'block' }}>Divider style</FormLabel>
                                          <CustomDropdown value={receiptSettings.divider_style || 'dashed'} onChange={(e) => setReceiptSettingsWithUndo({ ...receiptSettings, divider_style: e.target.value })} options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'none', label: 'None' }]} placeholder="Divider" isDarkMode={isDarkMode} themeColorRgb={themeColorRgb} style={{ maxWidth: '140px' }} />
                                        </FormField>
                                      </>
                                    )}

                                  </div>
                                )}
                              </div>
                              <div style={{ padding: '12px 16px', borderTop: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#e0e0e0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
                                <button type="button" onClick={handleReceiptUndo} disabled={receiptUndoStack.length === 0} title="Undo" style={{ padding: 0, border: 'none', background: 'none', color: receiptUndoStack.length === 0 ? (isDarkMode ? 'var(--text-tertiary, #666)' : '#999') : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'), cursor: receiptUndoStack.length === 0 ? 'default' : 'pointer', opacity: receiptUndoStack.length === 0 ? 0.5 : 1 }}>
                                  <Undo2 size={18} strokeWidth={2.5} />
                                </button>
                                <button type="button" onClick={handleReceiptRedo} disabled={receiptRedoStack.length === 0} title="Redo" style={{ padding: 0, border: 'none', background: 'none', color: receiptRedoStack.length === 0 ? (isDarkMode ? 'var(--text-tertiary, #666)' : '#999') : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'), cursor: receiptRedoStack.length === 0 ? 'default' : 'pointer', opacity: receiptRedoStack.length === 0 ? 0.5 : 1 }}>
                                  <Redo2 size={18} strokeWidth={2.5} />
                                </button>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                                  <button type="button" className="button-26 button-26--header" role="button" onClick={() => setReceiptEditModalOpen(false)}>
                                    <div className="button-26__content"><span className="button-26__text text">Cancel</span></div>
                                  </button>
                                  <button type="button" className="button-26 button-26--header" role="button" disabled={saving} onClick={async () => { setSaving(true); setMessage(null); try { await saveReceiptSettingsOnly(receiptSettings); setReceiptEditModalOpen(false); setMessage({ type: 'success', text: 'Saved' }); setTimeout(() => setMessage(null), 3000); loadDisplaySettings().catch(() => { }); } catch (e) { setMessage({ type: 'error', text: 'Failed to save' }); } finally { setSaving(false); } }}>
                                    <div className="button-26__content"><span className="button-26__text text">{saving ? 'Saving…' : 'Save'}</span></div>
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff' }}>
                              <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 10, padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => { setReceiptEditorView(receiptEditorView === 'print' ? 'email' : 'print'); setReceiptTemplateDropdownOpen(false) }}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '13px',
                                    border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                    borderRadius: '8px',
                                    background: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                  }}
                                >
                                  {receiptEditorView === 'print' ? (
                                    <>
                                      <Mail size={14} />
                                      <span>Email</span>
                                    </>
                                  ) : (
                                    <>
                                      <Printer size={14} />
                                      <span>Receipt</span>
                                    </>
                                  )}
                                </button>
                                <div ref={receiptTemplateDropdownRef}>
                                  <button
                                    type="button"
                                    onClick={() => setReceiptTemplateDropdownOpen(o => !o)}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '13px',
                                      border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                      borderRadius: '8px',
                                      background: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                    }}
                                  >
                                    <span>
                                      {receiptEditorView === 'email'
                                        ? (receiptEditorEmailPreset === 'restaurantPromotion' ? 'Restaurant Promotion' : 'Premium')
                                        : (receiptSettings.template_preset?.startsWith('template_')
                                          ? (savedTemplates.find(t => t.id === parseInt(receiptSettings.template_preset.replace('template_', ''), 10))?.name ?? 'Template')
                                          : (receiptSettings.template_preset === 'modern' ? 'Modern' : receiptSettings.template_preset === 'classic' ? 'Classic' : receiptSettings.template_preset === 'minimal' ? 'Minimal' : 'Custom'))}
                                    </span>
                                    <ChevronDown size={14} style={{ opacity: 0.8 }} />
                                  </button>
                                  {receiptTemplateDropdownOpen && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        minWidth: '200px',
                                        background: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                                        borderRadius: '8px',
                                        boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.15)',
                                        zIndex: 99999,
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {receiptEditorView === 'email' ? (
                                        <>
                                          {['premium', 'restaurantPromotion'].map(presetId => {
                                            const label = presetId === 'premium' ? 'Premium' : 'Restaurant Promotion'
                                            const isActive = receiptEditorEmailPreset === presetId
                                            return (
                                              <button
                                                key={presetId}
                                                type="button"
                                                onClick={() => {
                                                  setReceiptEditorEmailPreset(presetId)
                                                  setReceiptTemplateDropdownOpen(false)
                                                }}
                                                style={{
                                                  width: '100%',
                                                  padding: '10px 14px',
                                                  border: 'none',
                                                  background: isActive ? `rgba(${themeColorRgb}, 0.15)` : 'none',
                                                  fontSize: '13px',
                                                  textAlign: 'left',
                                                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                                  cursor: 'pointer',
                                                  fontWeight: isActive ? 600 : 400
                                                }}
                                              >
                                                {label}
                                              </button>
                                            )
                                          })}
                                        </>
                                      ) : (
                                        <>
                                          {['modern', 'classic', 'minimal', 'custom'].map(preset => {
                                            const label = preset === 'modern' ? 'Modern' : preset === 'classic' ? 'Classic' : preset === 'minimal' ? 'Minimal' : 'Custom'
                                            const isActive = !receiptSettings.template_preset?.startsWith('template_') && receiptSettings.template_preset === preset
                                            return (
                                              <button
                                                key={preset}
                                                type="button"
                                                onClick={() => {
                                                  if (preset === 'custom') {
                                                    setReceiptSettingsWithUndo(prev => ({ ...prev, template_preset: 'custom' }))
                                                  } else {
                                                    const base = RECEIPT_PRESETS[preset] || DEFAULT_RECEIPT_TEMPLATE
                                                    const next = { ...base, template_preset: preset, store_name: receiptSettings.store_name, store_address: receiptSettings.store_address, store_phone: receiptSettings.store_phone, footer_message: receiptSettings.footer_message, return_policy: receiptSettings.return_policy, store_email: receiptSettings.store_email, store_website: receiptSettings.store_website }
                                                    setReceiptSettingsWithUndo(() => next)
                                                  }
                                                  setReceiptTemplateDropdownOpen(false)
                                                }}
                                                style={{
                                                  width: '100%',
                                                  padding: '10px 14px',
                                                  border: 'none',
                                                  background: isActive ? `rgba(${themeColorRgb}, 0.15)` : 'none',
                                                  fontSize: '13px',
                                                  textAlign: 'left',
                                                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                                  cursor: 'pointer',
                                                  fontWeight: isActive ? 600 : 400
                                                }}
                                              >
                                                {label}
                                              </button>
                                            )
                                          })}
                                          {savedTemplates.length > 0 && (
                                            <>
                                              <div style={{ borderTop: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#eee'}` }} />
                                              {savedTemplates.map(t => {
                                                const isActive = receiptSettings.template_preset === `template_${t.id}`
                                                return (
                                                  <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => {
                                                      if (t.settings) {
                                                        setReceiptSettingsWithUndo(() => ({ ...DEFAULT_RECEIPT_TEMPLATE, ...t.settings, template_preset: `template_${t.id}` }))
                                                      } else {
                                                        setReceiptSettingsWithUndo(prev => ({ ...prev, template_preset: `template_${t.id}` }))
                                                      }
                                                      setReceiptTemplateDropdownOpen(false)
                                                    }}
                                                    style={{
                                                      width: '100%',
                                                      padding: '10px 14px',
                                                      border: 'none',
                                                      background: isActive ? `rgba(${themeColorRgb}, 0.15)` : 'none',
                                                      fontSize: '13px',
                                                      textAlign: 'left',
                                                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                                      cursor: 'pointer',
                                                      fontWeight: isActive ? 600 : 400
                                                    }}
                                                  >
                                                    {t.name}
                                                  </button>
                                                )
                                              })}
                                            </>
                                          )}
                                          <div style={{ borderTop: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#eee'}` }} />
                                          {receiptShowNewTemplateInput ? (
                                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                              <input
                                                ref={receiptNewTemplateInputRef}
                                                type="text"
                                                value={receiptNewTemplateName}
                                                onChange={(e) => setReceiptNewTemplateName(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    if (receiptNewTemplateName.trim()) {
                                                      const name = receiptNewTemplateName.trim()
                                                      setReceiptNewTemplateName('')
                                                      setReceiptShowNewTemplateInput(false)
                                                      fetch('/api/receipt-templates', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ name, settings: receiptSettings })
                                                      }).then(res => res.json()).then(data => {
                                                        if (data.success && data.template) {
                                                          loadReceiptTemplates()
                                                          setReceiptSettings(prev => ({ ...prev, template_preset: `template_${data.template.id}` }))
                                                          setMessage({ type: 'success', text: `Template "${data.template.name}" saved.` })
                                                          setTimeout(() => setMessage(null), 2500)
                                                        } else {
                                                          setMessage({ type: 'error', text: data.message || 'Failed to save template' })
                                                        }
                                                      }).catch(() => setMessage({ type: 'error', text: 'Failed to save template' }))
                                                    }
                                                  } else if (e.key === 'Escape') {
                                                    setReceiptShowNewTemplateInput(false)
                                                    setReceiptNewTemplateName('')
                                                  }
                                                }}
                                                placeholder="Template name"
                                                style={{
                                                  padding: '8px 12px',
                                                  fontSize: '13px',
                                                  border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                                  borderRadius: '6px',
                                                  background: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                                                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                                  outline: 'none'
                                                }}
                                              />
                                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => { setReceiptShowNewTemplateInput(false); setReceiptNewTemplateName('') }}
                                                  style={{ padding: '6px 10px', fontSize: '12px', border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`, borderRadius: '6px', background: 'none', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', cursor: 'pointer' }}
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    const name = receiptNewTemplateName.trim()
                                                    if (!name) return
                                                    setReceiptNewTemplateName('')
                                                    setReceiptShowNewTemplateInput(false)
                                                    try {
                                                      const response = await fetch('/api/receipt-templates', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ name, settings: receiptSettings })
                                                      })
                                                      const data = await response.json()
                                                      if (data.success && data.template) {
                                                        await loadReceiptTemplates()
                                                        setReceiptSettings(prev => ({ ...prev, template_preset: `template_${data.template.id}` }))
                                                        setMessage({ type: 'success', text: `Template "${data.template.name}" saved.` })
                                                        setTimeout(() => setMessage(null), 2500)
                                                      } else {
                                                        setMessage({ type: 'error', text: data.message || 'Failed to save template' })
                                                      }
                                                    } catch (e) {
                                                      setMessage({ type: 'error', text: 'Failed to save template' })
                                                    }
                                                  }}
                                                  disabled={!receiptNewTemplateName.trim()}
                                                  style={{ padding: '6px 12px', fontSize: '12px', border: 'none', borderRadius: '6px', background: `rgba(${themeColorRgb}, 0.8)`, color: '#fff', cursor: receiptNewTemplateName.trim() ? 'pointer' : 'default', opacity: receiptNewTemplateName.trim() ? 1 : 0.6 }}
                                                >
                                                  Save
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setReceiptShowNewTemplateInput(true)}
                                              style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                border: 'none',
                                                background: 'none',
                                                fontSize: '13px',
                                                textAlign: 'left',
                                                color: `rgba(${themeColorRgb}, 1)`,
                                                cursor: 'pointer',
                                                fontWeight: 500
                                              }}
                                            >
                                              Save as new template…
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="checkout-ui-controls-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: receiptEditorView === 'email' ? 'stretch' : 'flex-start' }}>
                                {receiptEditorView === 'print' ? (
                                  <ReceiptPreview
                                    settings={receiptSettings}
                                    id="receipt-preview-print"
                                    onSectionClick={(section) => setActiveReceiptSection(activeReceiptSection === section ? null : section)}
                                    activeSection={activeReceiptSection}
                                    isDarkMode={isDarkMode}
                                    themeColorRgb={themeColorRgb}
                                  />
                                ) : (() => {
                                  const RECEIPT_EMAIL_SAMPLE = {
                                    store_name: receiptSettings.store_name || storeLocationSettings.store_name || 'La Maison',
                                    store_tagline: receiptSettings.store_tagline || 'Fine Dining & Provisions',
                                    order_number: 'RCP-2024-001234',
                                    receipt_date: 'February 12, 2026',
                                    receipt_time: '2:45 PM',
                                    location: 'Downtown - Main Street',
                                    employee_name: 'James Patterson',
                                    items_html: '<tr><td><div class="item-name">Grilled Atlantic Salmon @ $24.99</div><div class="item-description">Seasonal vegetables, lemon beurre blanc, wild rice</div></td><td>$24.99</td></tr><tr><td><div class="item-name">Classic Caesar Salad @ $12.50</div><div class="item-description">Romaine hearts, aged parmesan, garlic croutons</div></td><td>$12.50</td></tr><tr><td><div class="item-name">Cold Brew Coffee @ $4.50</div><div class="item-description">House blend, served over ice</div></td><td>$4.50</td></tr>',
                                    subtotal: '41.99',
                                    tax: '3.57',
                                    tip: '8.00',
                                    total: '53.56',
                                    payment_method: 'Paid by Card',
                                    barcode_html: '',
                                    signature_html: '',
                                    footer_message: receiptSettings.footer_message || 'Thank you for dining with us.',
                                    store_email: receiptSettings.store_email || storeLocationSettings.store_email || 'concierge@lamaison.com',
                                    formatted_store_phone: receiptSettings.store_phone || storeLocationSettings.store_phone || '(555) 123-4567',
                                    store_address: receiptSettings.store_address || storeLocationSettings.address || [storeLocationSettings.address, storeLocationSettings.city, storeLocationSettings.state, storeLocationSettings.zip].filter(Boolean).join(', ') || '123 Main Street · Your City, ST 12345'
                                  }
                                  let emailHtml = receiptEditorEmailPreset === 'restaurantPromotion' ? LA_MAISON_RESTAURANT_PROMOTION_RECEIPT_HTML : LA_MAISON_RECEIPT_HTML
                                  Object.entries(RECEIPT_EMAIL_SAMPLE).forEach(([k, v]) => {
                                    emailHtml = emailHtml.replace(new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'g'), String(v ?? ''))
                                  })
                                  emailHtml = emailHtml.replace(/\{\{[^}]*\}\}/g, '')
                                  return (
                                    <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                                      <iframe
                                        title="Receipt email preview"
                                        srcDoc={emailHtml}
                                        style={{
                                          flex: 1,
                                          minHeight: 0,
                                          width: '100%',
                                          border: 'none',
                                          borderRadius: '8px',
                                          backgroundColor: '#fff',
                                          boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
                                        }}
                                        sandbox="allow-same-origin"
                                      />
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div style={{ maxWidth: '560px', margin: '0 auto', width: '100%' }}>
                  <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '8px' }}>
                    Notifications
                  </FormTitle>
                  <p style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '24px' }}>
                    Turn specific in-app notifications on or off. Use the Test button to see how each notification looks.
                  </p>

                  {/* Email & SMS - External Notifications */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fafafa',
                    marginBottom: '24px'
                  }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: isDarkMode ? 'var(--text-primary)' : '#333', marginBottom: '16px' }}>
                      Email & SMS Notifications
                    </div>
                    <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '16px' }}>
                      Email: Use Gmail to test, then switch to AWS SES for production. SMS: AWS SNS only (~$0.006/SMS). Toggle which events send notifications.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Email service</FormLabel>
                        <select
                          value={notificationChannelSettings.email_provider}
                          onChange={(e) => setNotificationChannelSettings({ ...notificationChannelSettings, email_provider: e.target.value })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                        >
                          <option value="gmail">Gmail (test email)</option>
                          <option value="aws_ses">AWS SES (production email)</option>
                        </select>
                        <p style={{ fontSize: '11px', color: isDarkMode ? 'var(--text-tertiary)' : '#999', marginTop: '4px' }}>
                          {notificationChannelSettings.email_provider === 'gmail'
                            ? 'Test email delivery with Gmail before switching to AWS SES.'
                            : 'Production email via AWS SES.'}
                        </p>
                      </div>

                      <div>
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>SMS service</FormLabel>
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #ddd',
                          backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#f5f5f5',
                          fontSize: '14px',
                          color: isDarkMode ? 'var(--text-secondary)' : '#555'
                        }}>
                          AWS SNS (~$0.006/SMS) — separate from email
                        </div>
                      </div>

                      {notificationChannelSettings.email_provider === 'gmail' && (
                        <>
                          <div>
                            <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>SMTP Server</FormLabel>
                            <input
                              type="text"
                              value={notificationChannelSettings.smtp_server}
                              onChange={(e) => setNotificationChannelSettings({ ...notificationChannelSettings, smtp_server: e.target.value })}
                              placeholder="smtp.gmail.com"
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            />
                          </div>
                          <div>
                            <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Gmail Address</FormLabel>
                            <input
                              type="email"
                              value={notificationChannelSettings.smtp_user}
                              onChange={(e) => setNotificationChannelSettings({ ...notificationChannelSettings, smtp_user: e.target.value })}
                              placeholder="your@gmail.com"
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            />
                            <p style={{ fontSize: '11px', color: isDarkMode ? 'var(--text-tertiary)' : '#999', marginTop: '4px' }}>
                              Enable 2FA and create an App Password at Google Account → Security
                            </p>
                          </div>
                          <div>
                            <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>App Password</FormLabel>
                            <input
                              type="password"
                              value={notificationChannelSettings.smtp_password === '***' ? '' : (notificationChannelSettings.smtp_password || '')}
                              onChange={(e) => setNotificationChannelSettings({ ...notificationChannelSettings, smtp_password: e.target.value })}
                              placeholder={notificationChannelSettings.smtp_password === '***' ? 'Leave blank to keep current' : '16-character app password'}
                              style={inputBaseStyle(isDarkMode, themeColorRgb)}
                            />
                          </div>
                        </>
                      )}

                      {/* AWS credentials: for AWS SES (production email) and AWS SNS (SMS) */}
                      <>
                        <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary)' : '#888', marginBottom: '10px' }}>
                          Used for AWS SES (production email) and AWS SNS (SMS)
                        </div>
                        <div>
                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>AWS Access Key ID</FormLabel>
                          <input
                            type="text"
                            value={notificationChannelSettings.aws_access_key_id === '***' ? '' : (notificationChannelSettings.aws_access_key_id || '')}
                            onChange={(e) => setNotificationChannelSettings({ ...notificationChannelSettings, aws_access_key_id: e.target.value })}
                            placeholder={notificationChannelSettings.aws_access_key_id === '***' ? 'Leave blank to keep current' : 'AKIA...'}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          />
                        </div>
                        <div>
                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>AWS Secret Access Key</FormLabel>
                          <input
                            type="password"
                            value={notificationChannelSettings.aws_secret_access_key === '***' ? '' : (notificationChannelSettings.aws_secret_access_key || '')}
                            onChange={(e) => setNotificationChannelSettings({ ...notificationChannelSettings, aws_secret_access_key: e.target.value })}
                            placeholder={notificationChannelSettings.aws_secret_access_key === '***' ? 'Leave blank to keep current' : 'Secret key'}
                            style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          />
                        </div>
                        <div>
                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>AWS Region</FormLabel>
                          <input
                            type="text"
                            value={notificationChannelSettings.aws_region}
                            onChange={(e) => setNotificationChannelSettings({ ...notificationChannelSettings, aws_region: e.target.value })}
                            placeholder="us-east-1"
                            style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '140px' }}
                          />
                        </div>
                      </>

                      <div>
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '10px', display: 'block' }}>Notify for</FormLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {[
                            { id: 'orders', label: 'Orders', desc: 'New orders (integrations, POS)' },
                            { id: 'reports', label: 'Reports', desc: 'Scheduled or manual reports' },
                            { id: 'scheduling', label: 'Scheduling', desc: 'Schedule published / changed' },
                            { id: 'clockins', label: 'Clock-ins', desc: 'Employee clock in / out' },
                            { id: 'receipts', label: 'Receipts', desc: 'Email receipts to customers' }
                          ].map(({ id, label, desc }) => (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '90px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{label}</span>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={notificationChannelSettings.notification_preferences?.[id]?.email ?? false}
                                  onChange={(e) => setNotificationChannelSettings({
                                    ...notificationChannelSettings,
                                    notification_preferences: {
                                      ...notificationChannelSettings.notification_preferences,
                                      [id]: { ...notificationChannelSettings.notification_preferences?.[id], email: e.target.checked }
                                    }
                                  })}
                                />
                                <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>Email</span>
                              </label>
                              {id !== 'receipts' && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={notificationChannelSettings.notification_preferences?.[id]?.sms ?? false}
                                    onChange={(e) => setNotificationChannelSettings({
                                      ...notificationChannelSettings,
                                      notification_preferences: {
                                        ...notificationChannelSettings.notification_preferences,
                                        [id]: { ...notificationChannelSettings.notification_preferences?.[id], sms: e.target.checked }
                                      }
                                    })}
                                  />
                                  <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>SMS</span>
                                </label>
                              )}
                              <span style={{ fontSize: '11px', color: isDarkMode ? 'var(--text-tertiary)' : '#999' }}>{desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={notificationChannelSaving}
                          onClick={async () => {
                            setNotificationChannelSaving(true)
                            try {
                              const token = localStorage.getItem('sessionToken')
                              const res = await cachedFetch('/api/notification-settings', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'X-Session-Token': token || '' },
                                body: JSON.stringify({
                                  session_token: token,
                                  store_id: 1,
                                  ...notificationChannelSettings,
                                  smtp_port: parseInt(notificationChannelSettings.smtp_port, 10) || 587,
                                  smtp_password: (notificationChannelSettings.smtp_password && notificationChannelSettings.smtp_password !== '') ? notificationChannelSettings.smtp_password : undefined
                                })
                              })
                              const data = await res.json()
                              if (data.success) {
                                showToast('Settings saved', 'success')
                              } else {
                                showToast(data.message || 'Failed to save', 'error')
                              }
                            } catch (e) {
                              showToast(e.message || 'Error saving', 'error')
                            } finally {
                              setNotificationChannelSaving(false)
                            }
                          }}
                          style={compactPrimaryButtonStyle(themeColorRgb)}
                        >
                          {notificationChannelSaving ? 'Saving…' : 'Save'}
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {showTestEmailInput ? (
                            <>
                              <input
                                type="email"
                                placeholder="Email to send test to"
                                value={testEmailInput}
                                onChange={(e) => setTestEmailInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') setShowTestEmailInput(false) }}
                                autoFocus
                                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px', padding: '6px 10px' }}
                              />
                              <button
                                type="button"
                                disabled={testEmailSending || !testEmailInput.trim()}
                                onClick={async () => {
                                  const email = testEmailInput.trim()
                                  if (!email) return
                                  if (notificationChannelSettings.email_provider === 'gmail' && (!notificationChannelSettings.smtp_user || !notificationChannelSettings.smtp_password)) {
                                    showToast('Enter Gmail address and App Password first', 'error')
                                    return
                                  }
                                  setTestEmailSending(true)
                                  try {
                                    const token = localStorage.getItem('sessionToken')
                                    const body = {
                                      to_address: email,
                                      store_id: 1,
                                      session_token: token,
                                      email_provider: notificationChannelSettings.email_provider,
                                      smtp_server: notificationChannelSettings.smtp_server,
                                      smtp_port: notificationChannelSettings.smtp_port || 587,
                                      smtp_user: notificationChannelSettings.smtp_user,
                                      smtp_password: notificationChannelSettings.smtp_password,
                                      business_name: notificationChannelSettings.business_name || 'POS'
                                    }
                                    const res = await cachedFetch('/api/notifications/test-email', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token || '' },
                                      body: JSON.stringify(body)
                                    })
                                    const data = await res.json()
                                    showToast(data.success ? 'Test email sent!' : (data.message || 'Failed to send'), data.success ? 'success' : 'error')
                                    if (data.success) { setShowTestEmailInput(false); setTestEmailInput('') }
                                  } catch (e) {
                                    showToast(e.message || 'Error sending test email', 'error')
                                  } finally {
                                    setTestEmailSending(false)
                                  }
                                }}
                                style={compactPrimaryButtonStyle(themeColorRgb)}
                              >
                                {testEmailSending ? 'Sending…' : 'Send'}
                              </button>
                              <button type="button" onClick={() => { setShowTestEmailInput(false); setTestEmailInput('') }} style={compactCancelButtonStyle(isDarkMode)}>Cancel</button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowTestEmailInput(true)}
                              style={compactCancelButtonStyle(isDarkMode)}
                            >
                              Test Email
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const phone = window.prompt('Phone number (10 digits) for test SMS:')
                            if (!phone) return
                            try {
                              const token = localStorage.getItem('sessionToken')
                              const res = await cachedFetch('/api/notifications/test-sms', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'X-Session-Token': token || '' },
                                body: JSON.stringify({ phone_number: phone.replace(/\D/g, '').slice(-10), store_id: 1, session_token: token })
                              })
                              const data = await res.json()
                              showToast(data.success ? 'Test SMS sent!' : (data.message || 'Failed to send'), data.success ? 'success' : 'error')
                            } catch (e) {
                              showToast(e.message || 'Error sending test SMS', 'error')
                            }
                          }}
                          style={compactCancelButtonStyle(isDarkMode)}
                        >
                          Test SMS
                        </button>
                      </div>
                    </div>
                  </div>


                  {/* ── Clock-In / Clock-Out Notification Settings ── */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #e3f2fd',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#f5faff',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: isDarkMode ? 'var(--text-primary)' : '#1565c0' }}>Clock-In / Clock-Out Notifications</div>
                    </div>
                    <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#546e7a', marginBottom: '18px' }}>
                      Receive email alerts when employees clock in or out, get notified if someone is running late, and flag overtime shifts automatically.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                      {/* ── Who gets notified ── */}
                      <div style={{ padding: '14px 16px', borderRadius: '10px', border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #bbdefb', backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#fff' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '12px' }}>Notify on Clock Events</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {[
                            { key: 'notify_admin_on_clockin', label: 'Notify admin when employee clocks in', icon: '→' },
                            { key: 'notify_admin_on_clockout', label: 'Notify admin when employee clocks out', icon: '←' },
                            { key: 'notify_employee_self', label: 'Also notify the employee themselves', icon: '✉' },
                          ].map(({ key, label, icon }) => (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                              <div className="checkbox-wrapper-2">
                                <input type="checkbox" className="sc-gJwTLC ikxBAC"
                                  checked={!!clockinNotifSettings[key]}
                                  onChange={e => setClockinNotifSettings(p => ({ ...p, [key]: e.target.checked }))} />
                              </div>
                              <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-primary)' : '#37474f' }}>{icon} {label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* ── Admin recipients ── */}
                      <div style={{ padding: '14px 16px', borderRadius: '10px', border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #bbdefb', backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#fff' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>Admin Recipients</div>
                        <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#78909c', marginBottom: '10px' }}>Select which employees receive admin clock-event emails (must have an email address).</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(employeesWithEmail.length > 0 ? employeesWithEmail : []).map(emp => {
                            const empId = emp.employee_id ?? emp.id
                            const selected = (clockinNotifSettings.admin_email_ids || []).includes(empId)
                            return (
                              <button key={empId} type="button"
                                onClick={() => setClockinNotifSettings(p => {
                                  const ids = Array.isArray(p.admin_email_ids) ? p.admin_email_ids : []
                                  return { ...p, admin_email_ids: selected ? ids.filter(i => i !== empId) : [...ids, empId] }
                                })}
                                style={{
                                  padding: '6px 12px', fontSize: '12px', borderRadius: '20px', cursor: 'pointer',
                                  border: selected ? '2px solid #1565c0' : `1px solid ${isDarkMode ? 'var(--border-color)' : '#bbdefb'}`,
                                  background: selected ? 'rgba(21,101,192,.12)' : (isDarkMode ? 'var(--bg-secondary)' : '#f5faff'),
                                  color: selected ? '#1565c0' : (isDarkMode ? 'var(--text-secondary)' : '#546e7a'),
                                  fontWeight: selected ? 600 : 400
                                }}>
                                {selected && '✓ '}{emp.first_name || emp.name || `Employee #${empId}`}{emp.email ? ` (${emp.email})` : ''}
                              </button>
                            )
                          })}
                          {employeesWithEmail.length === 0 && (
                            <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary)' : '#90a4ae', fontStyle: 'italic' }}>No employees with email addresses found.</span>
                          )}
                        </div>
                      </div>

                      {/* ── Late Alert ── */}
                      <div style={{ padding: '14px 16px', borderRadius: '10px', border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #bbdefb', backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: '.5px' }}>Late Alert</div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <div className="checkbox-wrapper-2">
                              <input type="checkbox" className="sc-gJwTLC ikxBAC"
                                checked={!!clockinNotifSettings.late_alert_enabled}
                                onChange={e => setClockinNotifSettings(p => ({ ...p, late_alert_enabled: e.target.checked }))} />
                            </div>
                            <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#546e7a' }}>Enabled</span>
                          </label>
                        </div>
                        <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#78909c', marginBottom: '12px' }}>
                          Send an alert if an employee hasn't clocked in within the delay window after their scheduled start.
                        </p>
                        {clockinNotifSettings.late_alert_enabled && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#546e7a', marginBottom: '4px' }}>
                                Send alert after <strong style={{ color: '#e65100' }}>{clockinNotifSettings.late_alert_delay_min} min</strong> past scheduled start
                              </div>
                              <input type="range" min="5" max="60" step="5"
                                value={clockinNotifSettings.late_alert_delay_min}
                                onChange={e => setClockinNotifSettings(p => ({ ...p, late_alert_delay_min: Number(e.target.value) }))}
                                style={{ width: '100%', accentColor: '#1565c0' }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: isDarkMode ? 'var(--text-tertiary)' : '#90a4ae' }}><span>5 min</span><span>60 min</span></div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#546e7a', marginBottom: '4px' }}>
                                Late threshold (grace): <strong style={{ color: '#e65100' }}>{clockinNotifSettings.late_alert_threshold_min} min</strong>
                              </div>
                              <input type="range" min="1" max="30" step="1"
                                value={clockinNotifSettings.late_alert_threshold_min}
                                onChange={e => setClockinNotifSettings(p => ({ ...p, late_alert_threshold_min: Number(e.target.value) }))}
                                style={{ width: '100%', accentColor: '#1565c0' }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: isDarkMode ? 'var(--text-tertiary)' : '#90a4ae' }}><span>1 min</span><span>30 min</span></div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                              {[{ key: 'late_alert_to_admin', label: 'Alert admin' }, { key: 'late_alert_to_employee', label: 'Alert employee' }].map(({ key, label }) => (
                                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                                  <div className="checkbox-wrapper-2">
                                    <input type="checkbox" className="sc-gJwTLC ikxBAC"
                                      checked={!!clockinNotifSettings[key]}
                                      onChange={e => setClockinNotifSettings(p => ({ ...p, [key]: e.target.checked }))} />
                                  </div>
                                  <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-primary)' : '#37474f' }}>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Overtime Alert ── */}
                      <div style={{ padding: '14px 16px', borderRadius: '10px', border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #bbdefb', backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: '.5px' }}>Overtime Flag</div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                            <div className="checkbox-wrapper-2">
                              <input type="checkbox" className="sc-gJwTLC ikxBAC"
                                checked={!!clockinNotifSettings.overtime_alert_enabled}
                                onChange={e => setClockinNotifSettings(p => ({ ...p, overtime_alert_enabled: e.target.checked }))} />
                            </div>
                            <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#546e7a' }}>Enabled</span>
                          </label>
                        </div>
                        {clockinNotifSettings.overtime_alert_enabled && (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#546e7a', marginBottom: '4px' }}>
                              Flag shifts over <strong style={{ color: '#c62828' }}>{clockinNotifSettings.overtime_threshold_hours}h</strong> as overtime in clock-out email
                            </div>
                            <input type="range" min="4" max="16" step="0.5"
                              value={clockinNotifSettings.overtime_threshold_hours}
                              onChange={e => setClockinNotifSettings(p => ({ ...p, overtime_threshold_hours: Number(e.target.value) }))}
                              style={{ width: '100%', accentColor: '#c62828' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: isDarkMode ? 'var(--text-tertiary)' : '#90a4ae' }}><span>4h</span><span>16h</span></div>
                          </div>
                        )}
                      </div>

                      {/* ── Save button ── */}
                      <button type="button" disabled={clockinNotifSaving}
                        onClick={async () => {
                          setClockinNotifSaving(true)
                          try {
                            const token = localStorage.getItem('sessionToken') || ''
                            const res = await fetch('/api/clockin-notification-settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
                              body: JSON.stringify({ store_id: 1, ...clockinNotifSettings })
                            })
                            const d = await res.json()
                            showToast(d.success ? 'Clock-in notification settings saved' : (d.message || 'Failed to save'), d.success ? 'success' : 'error')
                          } catch (e) {
                            showToast(e?.message || 'Error saving', 'error')
                          } finally {
                            setClockinNotifSaving(false)
                          }
                        }}
                        style={{ ...compactPrimaryButtonStyle(themeColorRgb), background: 'linear-gradient(135deg,#1976d2,#1565c0)', alignSelf: 'flex-start' }}>
                        {clockinNotifSaving ? 'Saving…' : 'Save Clock-In Settings'}
                      </button>
                    </div>
                  </div>

                  {/* ── Register Notification Settings ── */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fafafa',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>💵</span>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                        Register Activity Emails
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '20px' }}>
                      Get notified when cash is moved or registers are opened/closed.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Triggers */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#444' }}>
                          Email Triggers
                        </div>
                        {[
                          { id: 'notify_admin_on_open', label: 'Register Open' },
                          { id: 'notify_admin_on_close', label: 'Register Close/Summary' },
                          { id: 'notify_admin_on_drop', label: 'Cash Drop' },
                          { id: 'notify_admin_on_withdraw', label: 'Cash Withdrawal (Take-out)' },
                        ].map(({ id, label }) => (
                          <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                            <input type="checkbox"
                              checked={!!registerNotifSettings[id]}
                              onChange={e => setRegisterNotifSettings(p => ({ ...p, [id]: e.target.checked }))}
                              style={{ accentColor: themeColorRgb, width: '16px', height: '16px' }} />
                            {label}
                          </label>
                        ))}
                      </div>

                      {/* Employee Self-copy */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#444' }}>
                          Employee Notification
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                          <input type="checkbox"
                            checked={!!registerNotifSettings.notify_employee_self}
                            onChange={e => setRegisterNotifSettings(p => ({ ...p, notify_employee_self: e.target.checked }))}
                            style={{ accentColor: themeColorRgb, width: '16px', height: '16px' }} />
                          Always text/email CC the action performer (if they have an email)
                        </label>
                      </div>

                      {/* Admin Recipients */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#444' }}>
                          Admin / Management Recipients
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {employeesWithEmail.map(emp => {
                            const empId = Number(emp.employee_id)
                            const selected = (registerNotifSettings.admin_email_ids || []).includes(empId)
                            return (
                              <button key={empId} type="button"
                                onClick={() => setRegisterNotifSettings(p => {
                                  const cur = p.admin_email_ids || []
                                  return { ...p, admin_email_ids: selected ? cur.filter(id => id !== empId) : [...cur, empId] }
                                })}
                                style={{
                                  padding: '6px 12px', fontSize: '13px', borderRadius: '20px', border: '1px solid',
                                  backgroundColor: selected ? `${themeColorRgb}1A` : 'transparent',
                                  borderColor: selected ? themeColorRgb : (isDarkMode ? 'var(--border-light)' : '#ccc'),
                                  color: selected ? themeColorRgb : (isDarkMode ? 'var(--text-primary)' : '#444'),
                                  cursor: 'pointer', transition: 'all 0.15s ease'
                                }}>
                                {emp.name} <span style={{ opacity: 0.6, fontSize: '11px' }}>({emp.email})</span>
                              </button>
                            )
                          })}
                          {employeesWithEmail.length === 0 && <span style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>No active employees with valid email addresses.</span>}
                        </div>
                      </div>

                      {/* Save button */}
                      <button type="button" disabled={registerNotifSaving}
                        onClick={async () => {
                          setRegisterNotifSaving(true)
                          try {
                            const token = localStorage.getItem('sessionToken') || ''
                            const res = await fetch('/api/register-notification-settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
                              body: JSON.stringify({ store_id: 1, ...registerNotifSettings })
                            })
                            const d = await res.json()
                            showToast(d.success ? 'Register notification settings saved' : (d.message || 'Failed to save'), d.success ? 'success' : 'error')
                          } catch (e) {
                            showToast(e?.message || 'Error saving', 'error')
                          } finally {
                            setRegisterNotifSaving(false)
                          }
                        }}
                        style={{ ...compactPrimaryButtonStyle(themeColorRgb), background: 'linear-gradient(135deg,#e65100,#ef6c00)', alignSelf: 'flex-start' }}>
                        {registerNotifSaving ? 'Saving…' : 'Save Register Settings'}
                      </button>
                    </div>
                  </div>

                  {/* ── Schedule Notification Settings ── */}
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fafafa',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>📅</span>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                        Schedule Publishing & Email Alerts
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '20px' }}>
                      Control how shift assignments are emailed to employees and who gets the full team schedule.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Toggles */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                          <input type="checkbox"
                            checked={!!scheduleNotifSettings.notify_on_edit}
                            onChange={(e) => setScheduleNotifSettings({ ...scheduleNotifSettings, notify_on_edit: e.target.checked })}
                            style={{ accentColor: themeColorRgb, width: '16px', height: '16px' }} />
                          <strong>Notify on shift edits:</strong> Send email to affected employees when a published schedule is altered.
                        </label>
                      </div>

                      {/* Employee View Strategy */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#444' }}>
                          Employee Shift Email Contents
                        </div>
                        <select
                          value={scheduleNotifSettings.employee_schedule_view || 'shifts_only'}
                          onChange={(e) => setScheduleNotifSettings({ ...scheduleNotifSettings, employee_schedule_view: e.target.value })}
                          style={{
                            padding: '10px', fontSize: '14px', borderRadius: '8px', border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ccc', backgroundColor: isDarkMode ? 'var(--input-bg)' : '#fff', color: isDarkMode ? 'var(--text-primary)' : '#000', width: '100%', maxWidth: '400px', cursor: 'pointer'
                          }}>
                          <option value="shifts_only">Shifts Only (employee only sees their scheduled shifts)</option>
                          <option value="full_schedule">Full Schedule (employee sees their shifts AND the full team schedule)</option>
                        </select>
                      </div>

                      {/* Admin Recipients */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#444' }}>
                          Admin Observers (always receive full schedule)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {employeesWithEmail.map(emp => {
                            const empId = Number(emp.employee_id)
                            const selected = (scheduleNotifSettings.admin_email_ids || []).includes(empId)
                            return (
                              <button key={empId} type="button"
                                onClick={() => {
                                  const cur = scheduleNotifSettings.admin_email_ids || []
                                  const next = selected ? cur.filter(id => id !== empId) : [...cur, empId]
                                  setScheduleNotifSettings({ ...scheduleNotifSettings, admin_email_ids: next })
                                }}
                                style={{
                                  padding: '6px 12px', fontSize: '13px', borderRadius: '20px', border: '1px solid',
                                  backgroundColor: selected ? `${themeColorRgb}1A` : 'transparent',
                                  borderColor: selected ? themeColorRgb : (isDarkMode ? 'var(--border-light)' : '#ccc'),
                                  color: selected ? themeColorRgb : (isDarkMode ? 'var(--text-primary)' : '#444'),
                                  cursor: 'pointer', transition: 'all 0.15s ease'
                                }}>
                                {emp.name} <span style={{ opacity: 0.6, fontSize: '11px' }}>({emp.email})</span>
                              </button>
                            )
                          })}
                          {employeesWithEmail.length === 0 && <span style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>No active employees with valid email addresses.</span>}
                        </div>
                      </div>

                      {/* Save button */}
                      <button type="button" disabled={scheduleNotifSaving}
                        onClick={async () => {
                          setScheduleNotifSaving(true)
                          try {
                            const token = localStorage.getItem('sessionToken') || ''
                            const res = await fetch('/api/schedule-notification-settings', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
                              body: JSON.stringify({ store_id: 1, ...scheduleNotifSettings })
                            })
                            const d = await res.json()
                            showToast(d.success ? 'Schedule notification settings saved' : (d.message || 'Failed to save'), d.success ? 'success' : 'error')
                          } catch (e) {
                            showToast(e?.message || 'Error saving', 'error')
                          } finally {
                            setScheduleNotifSaving(false)
                          }
                        }}
                        style={{ ...compactPrimaryButtonStyle(themeColorRgb), background: 'linear-gradient(135deg,#9c27b0,#7b1fa2)', alignSelf: 'flex-start' }}>
                        {scheduleNotifSaving ? 'Saving…' : 'Save Schedule Settings'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                    {NOTIFICATION_SECTIONS.map((section) => {
                      const optionIds = NOTIFICATION_OPTIONS_BY_SECTION[section.id] || []
                      const opts = optionIds.map((id) => NOTIFICATION_OPTIONS_MAP[id]).filter(Boolean)
                      if (opts.length === 0) return null
                      return (
                        <div key={section.id} style={{ width: '100%', maxWidth: '560px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: isDarkMode ? 'var(--text-secondary)' : '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {section.title}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {opts.map((opt) => (
                              <Fragment key={opt.id}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    flexWrap: 'wrap',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                    backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fafafa'
                                  }}
                                >
                                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333', marginBottom: '2px' }}>
                                      {opt.label}
                                    </div>
                                    <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>
                                      {opt.description}
                                    </div>
                                  </div>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
                                    <div className="checkbox-wrapper-2">
                                      <input
                                        type="checkbox"
                                        className="sc-gJwTLC ikxBAC"
                                        checked={notificationSettings[opt.id] !== false}
                                        onChange={(e) => persistNotificationSettings({ ...notificationSettings, [opt.id]: e.target.checked })}
                                      />
                                    </div>
                                    <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>
                                      {notificationSettings[opt.id] !== false ? 'On' : 'Off'}
                                    </span>
                                  </label>
                                  {opt.id === 'recent_new_order' ? (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      {[
                                        { id: 'doordash', label: 'DoorDash', src: '/doordash-logo.svg', alt: 'DoorDash' },
                                        { id: 'uber_eats', label: 'Uber Eats', src: '/uber-eats-logo.svg', alt: 'Uber Eats' },
                                        { id: 'shopify', label: 'Shopify', src: '/shopify-logo.svg', alt: 'Shopify' }
                                      ].map((int) => (
                                        <button
                                          key={int.id}
                                          type="button"
                                          onClick={async () => {
                                            const soundOpts = { sound_type: newOrderToastOptions.sound_type ?? 'default', volume: newOrderToastOptions.volume ?? 0.5 }
                                            let intervalId = null;
                                            if (newOrderToastOptions.play_sound && newOrderToastOptions.sound_type !== 'none') {
                                              await playNewOrderSound(soundOpts)
                                              if (newOrderToastOptions.sound_until_dismiss) {
                                                intervalId = setInterval(() => playNewOrderSound(soundOpts), 1200)
                                              }
                                            }
                                            const toastId = showToast(`Order #${Math.floor(1000 + Math.random() * 9000)} from ${int.alt}`, 'success', {
                                              icon: { src: int.src, alt: int.alt },
                                              variant: 'sidebar',
                                              pulseColor: int.id === 'doordash' ? 'red' : int.id === 'shopify' ? 'shopify' : 'green',
                                              autoDismiss: newOrderToastOptions.auto_dismiss_sec === 4 ? 4000 : false,
                                              onDismiss: () => {
                                                if (intervalId) clearInterval(intervalId);
                                              }
                                            })
                                            if (newOrderToastOptions.auto_dismiss_sec === 4 && intervalId) {
                                              setTimeout(() => clearInterval(intervalId), 4000);
                                            }
                                          }}
                                          style={{
                                            padding: '8px 12px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#e5e7eb',
                                            color: isDarkMode ? 'var(--text-primary)' : '#374151',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          <img src={int.src} alt="" style={{ height: '16px', width: 'auto', maxWidth: '48px', objectFit: 'contain' }} />
                                          Test
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => showToast(opt.sampleMessage, opt.toastType)}
                                      style={{
                                        padding: '8px 14px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        borderRadius: '8px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#e5e7eb',
                                        color: isDarkMode ? 'var(--text-primary)' : '#374151'
                                      }}
                                    >
                                      Test
                                    </button>
                                  )}
                                </div>
                                {opt.id === 'recent_new_order' && notificationSettings.recent_new_order !== false && (
                                  <div
                                    style={{
                                      padding: '16px',
                                      borderRadius: '12px',
                                      border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                      backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#f5f5f5',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '24px'
                                    }}
                                  >
                                    {/* === POPUP & SOUND OPTIONS === */}
                                    <div>
                                      <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333', marginBottom: '12px' }}>
                                        Popup & Sound
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                                          <div className="checkbox-wrapper-2">
                                            <input
                                              type="checkbox"
                                              className="sc-gJwTLC ikxBAC"
                                              checked={newOrderToastOptions.play_sound}
                                              onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, play_sound: e.target.checked })}
                                            />
                                          </div>
                                          <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>Play sound when a new order arrives</span>
                                        </label>

                                        {newOrderToastOptions.play_sound && (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                                            <select
                                              value={newOrderToastOptions.sound_type ?? 'default'}
                                              onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, sound_type: e.target.value })}
                                              style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #ddd',
                                                backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                                fontSize: '13px'
                                              }}
                                            >
                                              {NOTIFICATION_SOUND_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                              ))}
                                            </select>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Vol: {Math.round((newOrderToastOptions.volume ?? 0.5) * 100)}%</span>
                                              <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={Math.round((newOrderToastOptions.volume ?? 0.5) * 100)}
                                                onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, volume: parseInt(e.target.value, 10) / 100 })}
                                                style={{ width: '100px', accentColor: isDarkMode ? 'var(--theme-color)' : undefined }}
                                              />
                                            </div>
                                          </div>
                                        )}

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Dismiss:</span>
                                            <select
                                              value={newOrderToastOptions.auto_dismiss_sec === 0 ? 'manual' : 'auto'}
                                              onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, auto_dismiss_sec: e.target.value === 'auto' ? 4 : 0, sound_until_dismiss: e.target.value === 'manual' })}
                                              style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #ddd',
                                                backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                                fontSize: '13px'
                                              }}
                                            >
                                              <option value="manual">When I click</option>
                                              <option value="auto">After 4s</option>
                                            </select>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Action:</span>
                                            <select
                                              value={newOrderToastOptions.click_action}
                                              onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, click_action: e.target.value })}
                                              style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                border: isDarkMode ? '1px solid var(--border-color)' : '1px solid #ddd',
                                                backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                                fontSize: '13px'
                                              }}
                                            >
                                              <option value="go_to_order">Go to order</option>
                                              <option value="print_receipt">Print receipt</option>
                                              <option value="dismiss_only">Just dismiss</option>
                                            </select>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* === EMAIL NOTIFICATION OPTIONS === */}
                                    <div style={{ paddingTop: '16px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
                                      <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333', marginBottom: '12px' }}>Email Notification</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {/* Enable toggle */}
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                                          <div className="checkbox-wrapper-2">
                                            <input type="checkbox" className="sc-gJwTLC ikxBAC" checked={orderEmailPrefs.email_enabled} onChange={e => setOrderEmailPrefs(p => ({ ...p, email_enabled: e.target.checked }))} />
                                          </div>
                                          <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>Send an email when a new order arrives</span>
                                        </label>

                                        {orderEmailPrefs.email_enabled && (
                                          <>
                                            {/* Source filter */}
                                            <div>
                                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {[{ id: 'all', label: 'All orders' }, { id: 'doordash', label: 'DoorDash' }, { id: 'uber_eats', label: 'Uber Eats' }, { id: 'shopify', label: 'Shopify' }, { id: 'pickup', label: 'Pickup' }, { id: 'delivery', label: 'Delivery' }].map(src => {
                                                  const sf = Array.isArray(orderEmailPrefs.source_filter) ? orderEmailPrefs.source_filter : ['all']
                                                  const active = sf.includes(src.id)
                                                  return (
                                                    <button key={src.id} type="button"
                                                      onClick={() => {
                                                        if (src.id === 'all') { setOrderEmailPrefs(p => ({ ...p, source_filter: ['all'] })) }
                                                        else { setOrderEmailPrefs(p => { const cur = (Array.isArray(p.source_filter) ? p.source_filter : ['all']).filter(x => x !== 'all'); const next = cur.includes(src.id) ? cur.filter(x => x !== src.id) : [...cur, src.id]; return { ...p, source_filter: next.length ? next : ['all'] } }) }
                                                      }}
                                                      style={{ padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 500, border: active ? `1px solid var(--theme-color, #2196f3)` : `1px solid ${isDarkMode ? 'var(--border-color)' : '#ddd'}`, backgroundColor: active ? (isDarkMode ? 'var(--theme-color, #2196f3)' : '#2196f3') : (isDarkMode ? 'var(--bg-secondary)' : '#fff'), color: active ? '#fff' : (isDarkMode ? 'var(--text-secondary)' : '#555'), cursor: 'pointer' }}
                                                    >{src.label}</button>
                                                  )
                                                })}
                                              </div>
                                            </div>

                                            {/* Recipient employees */}
                                            <div>
                                              <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#555', marginBottom: '8px' }}>Send to</div>
                                              {employeesWithEmail.length === 0 ? (
                                                <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#888', fontStyle: 'italic' }}>No employees with email. Add in HR.</div>
                                              ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', padding: '4px 8px', borderRadius: '8px', border: '1px solid', borderColor: orderEmailPrefs.recipient_employee_ids.length === 0 ? 'var(--theme-color, #2196f3)' : (isDarkMode ? 'var(--border-color)' : '#ddd'), backgroundColor: orderEmailPrefs.recipient_employee_ids.length === 0 ? (isDarkMode ? 'rgba(33,150,243,0.1)' : 'rgba(33,150,243,0.05)') : 'transparent' }}>
                                                    <input type="checkbox" style={{ accentColor: themeColorRgb }} checked={orderEmailPrefs.recipient_employee_ids.length === 0} onChange={() => setOrderEmailPrefs(p => ({ ...p, recipient_employee_ids: [] }))} />
                                                    <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>Store email</span>
                                                  </label>
                                                  {employeesWithEmail.map(emp => {
                                                    const sel = (Array.isArray(orderEmailPrefs.recipient_employee_ids) ? orderEmailPrefs.recipient_employee_ids : []).includes(emp.employee_id)
                                                    return (
                                                      <label key={emp.employee_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', padding: '4px 8px', borderRadius: '8px', border: '1px solid', borderColor: sel ? 'var(--theme-color, #2196f3)' : (isDarkMode ? 'var(--border-color)' : '#ddd'), backgroundColor: sel ? (isDarkMode ? 'rgba(33,150,243,0.1)' : 'rgba(33,150,243,0.05)') : 'transparent' }}>
                                                        <input type="checkbox" style={{ accentColor: themeColorRgb }} checked={sel} onChange={() => setOrderEmailPrefs(p => { const ids = Array.isArray(p.recipient_employee_ids) ? p.recipient_employee_ids : []; const next = sel ? ids.filter(id => id !== emp.employee_id) : [...ids, emp.employee_id]; return { ...p, recipient_employee_ids: next } })} />
                                                        <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{emp.name}</span>
                                                      </label>
                                                    )
                                                  })}
                                                </div>
                                              )}
                                            </div>

                                            {/* Save button */}
                                            <div>
                                              <button type="button"
                                                onClick={async () => {
                                                  try {
                                                    const token = localStorage.getItem('sessionToken')
                                                    const mergedPrefs = {
                                                      ...notificationChannelSettings.notification_preferences,
                                                      orders: {
                                                        ...(notificationChannelSettings.notification_preferences?.orders || {}),
                                                        email_enabled: orderEmailPrefs.email_enabled,
                                                        email: orderEmailPrefs.email_enabled,
                                                        source_filter: Array.isArray(orderEmailPrefs.source_filter) ? orderEmailPrefs.source_filter : ['all'],
                                                        recipient_employee_ids: Array.isArray(orderEmailPrefs.recipient_employee_ids) ? orderEmailPrefs.recipient_employee_ids : []
                                                      }
                                                    }
                                                    const res = await cachedFetch('/api/notification-settings', {
                                                      method: 'POST',
                                                      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token || '' },
                                                      body: JSON.stringify({ ...notificationChannelSettings, notification_preferences: mergedPrefs, store_id: 1, session_token: token })
                                                    })
                                                    const d = await res.json()
                                                    if (d.success) setNotificationChannelSettings(p => ({ ...p, notification_preferences: mergedPrefs }))
                                                    showToast(d.success ? 'Email settings saved' : (d.message || 'Failed to save'), d.success ? 'success' : 'error')
                                                  } catch (e) { showToast(e.message || 'Error saving settings', 'error') }
                                                }}
                                                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, backgroundColor: isDarkMode ? 'var(--theme-color, #2196f3)' : '#2196f3', color: '#fff', border: 'none', cursor: 'pointer' }}
                                              >Save Settings</button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Email Template Modal – top level so it opens from receipt editor (POS tab) or notifications */}

              {/* Integrations Tab */}
              {activeTab === 'integration' && (
                <div style={{ maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto' }}>
                  <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '8px' }}>
                    Integrations
                  </FormTitle>
                  <p style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '24px' }}>
                    Connect Shopify, DoorDash, and Uber Eats. When an order is placed, it will appear on Recent Orders with pay breakdown and in Accounting. For Shopify: add your store URL and Admin API access token (Settings → Apps and sales channels → Develop apps → Create an app → Configure Admin API scopes: <code>read_orders</code>, <code>read_products</code>), then use &quot;Sync orders now&quot; or &quot;Sync products now&quot; to pull data, or set up the webhook for instant new orders.
                  </p>
                  {integrationsLoading ? (
                    <div style={{ padding: '24px', color: isDarkMode ? '#999' : '#666' }}>Loading…</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {[
                        { id: 'shopify', label: 'Shopify', extra: 'Store URL' },
                        { id: 'doordash', label: 'DoorDash' },
                        { id: 'uber_eats', label: 'Uber Eats' }
                      ].map(({ id, label, extra }) => {
                        const state = integrations[id] || { enabled: false, config: {} }
                        const config = state.config || {}
                        const integrationLogo = id === 'shopify' ? '/shopify.svg' : id === 'doordash' ? '/doordash.svg' : id === 'uber_eats' ? '/uber-15.svg' : null
                        const integrationInputRgb = id === 'shopify' ? '34, 197, 94' : themeColorRgb
                        const integrationInputGlassStyle = {
                          background: isDarkMode ? 'rgba(50, 50, 50, 0.35)' : 'rgba(255, 255, 255, 0.35)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.14)',
                          boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255, 255, 255, 0.04)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.4)'
                        }
                        return (
                          <div
                            key={id}
                            className={`integration-card-glass${id === 'shopify' ? ' integration-card-shopify-bg' : ''}${id === 'doordash' ? ' integration-card-doordash-bg' : ''}${id === 'uber_eats' ? ' integration-card-ubereats-bg' : ''}`}
                            style={{
                              padding: '20px',
                              borderRadius: '12px',
                              ...(id === 'shopify' && shopifySyncDropdownOpen ? { position: 'relative', zIndex: 10 } : {}),
                              ...(id === 'doordash' && doordashSyncDropdownOpen ? { position: 'relative', zIndex: 10 } : {})
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '16px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                                {integrationLogo && (
                                  <img src={integrationLogo} alt="" style={{ height: '24px', width: 'auto', maxWidth: '72px', objectFit: 'contain' }} />
                                )}
                                {label}
                              </span>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: isDarkMode ? '#888' : '#999' }}>
                                  {state.enabled ? 'Activated' : 'Deactivated'}
                                </span>
                                <div className="checkbox-wrapper-2 integration-toggle" style={{ flexShrink: 0 }}>
                                  <input
                                    type="checkbox"
                                    className="sc-gJwTLC ikxBAC"
                                    checked={!!state.enabled}
                                    onChange={() => setIntegrations(prev => ({
                                      ...prev,
                                      [id]: { ...prev[id], enabled: !prev[id].enabled }
                                    }))}
                                  />
                                </div>
                              </label>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {id === 'shopify' && (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                                    <FormField isDarkMode={isDarkMode} label="Your Shopify store" style={{ flex: '1 1 200px', minWidth: '200px' }}>
                                      <input
                                        type="text"
                                        value={config.store_url || ''}
                                        onChange={(e) => setIntegrations(prev => ({
                                          ...prev,
                                          shopify: { ...prev.shopify, config: { ...(prev.shopify?.config || {}), store_url: e.target.value } }
                                        }))}
                                        placeholder="mystore.myshopify.com"
                                        style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle }}
                                        {...getInputFocusHandlers(integrationInputRgb, isDarkMode)}
                                      />
                                      {config.api_key && config.store_url && (
                                        <div style={{ fontSize: '11px', color: isDarkMode ? '#6b7c6b' : '#7a9a7a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <CheckCircle size={12} /> Connected: {(config.store_url || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                                        </div>
                                      )}
                                    </FormField>
                                    {!config.api_key || !config.store_url ? (() => {
                                      const isTauri = typeof window !== 'undefined' && window.__TAURI__
                                      const su = (integrations.shopify?.config?.store_url || '').trim()
                                      let shop = su.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.myshopify\.com.*/, '')
                                      if (!shop) shop = ''
                                      else if (!shop.includes('.myshopify.com')) shop = shop + '.myshopify.com'
                                      const connectUrl = shop && typeof window !== 'undefined'
                                        ? `${window.location.origin}/api/integrations/shopify/connect?shop=${encodeURIComponent(shop)}${isTauri ? '&from=tauri' : ''}`
                                        : null
                                      if (!connectUrl) {
                                        return (
                                          <span className="button-53 button-53--shopify" style={{ cursor: 'not-allowed', opacity: 0.6 }}>
                                            Connect with Shopify
                                          </span>
                                        )
                                      }
                                      if (isTauri) {
                                        return (
                                          <button
                                            type="button"
                                            className="button-53 button-53--shopify"
                                            onClick={async () => {
                                              try {
                                                const { open } = await import('@tauri-apps/plugin-shell')
                                                await open(connectUrl)
                                                showToast('Shopify authorization opened in your browser. Approve there, then return here.', 'success')
                                              } catch (e) {
                                                showToast('Failed to open Shopify connect', 'error')
                                              }
                                            }}
                                          >
                                            Connect with Shopify
                                          </button>
                                        )
                                      }
                                      return (
                                        <a
                                          href={connectUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="button-53 button-53--shopify"
                                        >
                                          Connect with Shopify
                                        </a>
                                      )
                                    })() : null}
                                  </div>
                                  {!config.api_key && (
                                    <>
                                      <p style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#666', margin: 0 }}>
                                        Enter your store (e.g. mystore.myshopify.com) and click Connect to authorize. Or paste a token manually below.
                                      </p>
                                      <p style={{ fontSize: '11px', color: isDarkMode ? '#666' : '#999', margin: '4px 0 0 0' }}>
                                        If Connect shows &quot;redirect_uri is not whitelisted&quot;, skip OAuth: paste an <strong>Admin API token</strong> below (Shopify Admin → Settings → Apps → Develop apps → Create app → Configure Admin API → Install → Reveal token). Or try <a href="http://localhost:5001/shopify-connect-test" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--theme-color, #008060)' }}>http://localhost:5001/shopify-connect-test</a> and click the link there.
                                      </p>
                                    </>
                                  )}
                                </>
                              )}
                              <FormField isDarkMode={isDarkMode} label={id === 'shopify' ? 'Or paste API token manually' : 'API Key / Access Token'}>
                                <input
                                  type="password"
                                  value={config.api_key || ''}
                                  onChange={(e) => setIntegrations(prev => ({
                                    ...prev,
                                    [id]: {
                                      ...prev[id],
                                      config: { ...(prev[id].config || {}), api_key: e.target.value }
                                    }
                                  }))}
                                  placeholder={id === 'shopify' ? 'Admin API access token (if not using Connect)' : 'API key'}
                                  style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle }}
                                  {...getInputFocusHandlers(integrationInputRgb, isDarkMode)}
                                />
                              </FormField>
                              {extra === 'Store URL' && id !== 'shopify' && (
                                <FormField isDarkMode={isDarkMode} label="Store URL">
                                  <input
                                    type="text"
                                    value={config.store_url || ''}
                                    onChange={(e) => setIntegrations(prev => ({
                                      ...prev,
                                      [id]: {
                                        ...prev[id],
                                        config: { ...(prev[id].config || {}), store_url: e.target.value }
                                      }
                                    }))}
                                    placeholder="https://your-store.myshopify.com"
                                    style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle }}
                                    {...getInputFocusHandlers(integrationInputRgb, isDarkMode)}
                                  />
                                </FormField>
                              )}
                              {id === 'shopify' && (
                                <>
                                  <FormField isDarkMode={isDarkMode} label="Webhook secret (optional, for orders/create verification)">
                                    <input
                                      type="password"
                                      value={config.webhook_secret || ''}
                                      onChange={(e) => setIntegrations(prev => ({
                                        ...prev,
                                        shopify: {
                                          ...prev.shopify,
                                          config: { ...(prev.shopify?.config || {}), webhook_secret: e.target.value }
                                        }
                                      }))}
                                      placeholder="From Shopify webhook setup"
                                      style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle }}
                                      {...getInputFocusHandlers(integrationInputRgb, isDarkMode)}
                                    />
                                  </FormField>
                                  <p style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#666', margin: 0 }}>
                                    Webhook URL: <code style={{ background: isDarkMode ? '#333' : '#eee', padding: '2px 6px', borderRadius: '4px' }}>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/shopify/orders` : '/api/webhooks/shopify/orders'}</code>. In Shopify: Settings → Notifications → Webhooks → Order creation.
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: isDarkMode ? '#999' : '#666' }}>
                                      {(config.last_synced_at || config.last_synced_order_id) && (
                                        <>Orders: {config.last_synced_at ? new Date(config.last_synced_at).toLocaleString() : config.last_synced_order_id ? `#${config.last_synced_order_id}` : '-'}</>
                                      )}
                                      {(config.last_synced_at || config.last_synced_order_id) && (config.products_synced_at || config.last_synced_product_id) && ' · '}
                                      {(config.products_synced_at || config.last_synced_product_id) && (
                                        <>Products: {config.products_synced_at ? new Date(config.products_synced_at).toLocaleString() : config.last_synced_product_id ? `#${config.last_synced_product_id}` : '-'}</>
                                      )}
                                      {!(config.last_synced_at || config.last_synced_order_id || config.products_synced_at || config.last_synced_product_id) && '\u00a0'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <div ref={shopifySyncDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                                        <button
                                          type="button"
                                          className="button-50 button-50--shopify"
                                          onClick={() => setShopifySyncDropdownOpen((open) => !open)}
                                          disabled={shopifySyncLoading || shopifyProductsSyncLoading || !state.enabled}
                                        >
                                          <span className="button-50__Content">{shopifySyncLoading || shopifyProductsSyncLoading ? 'Syncing…' : 'Sync'}</span>
                                        </button>
                                        {shopifySyncDropdownOpen && (
                                          <div
                                            style={{
                                              position: 'absolute',
                                              top: '100%',
                                              left: 0,
                                              right: 0,
                                              marginTop: '4px',
                                              width: '100%',
                                              boxSizing: 'border-box',
                                              borderRadius: '8px',
                                              boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
                                              background: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                                              border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                              zIndex: 1000,
                                              overflow: 'hidden'
                                            }}
                                          >
                                            <button
                                              type="button"
                                              style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '8px 6px',
                                                textAlign: 'left',
                                                border: 'none',
                                                background: 'none',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                              }}
                                              onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'var(--bg-tertiary)' : '#f0f8f0' }}
                                              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                                              onClick={() => { syncShopifyNow(); setShopifySyncDropdownOpen(false) }}
                                            >
                                              Orders
                                            </button>
                                            <button
                                              type="button"
                                              style={{
                                                display: 'block',
                                                width: '100%',
                                                padding: '8px 6px',
                                                textAlign: 'left',
                                                border: 'none',
                                                background: 'none',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                                cursor: 'pointer',
                                                borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                              }}
                                              onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'var(--bg-tertiary)' : '#f0f8f0' }}
                                              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                                              onClick={() => { syncShopifyProductsNow(); setShopifySyncDropdownOpen(false) }}
                                            >
                                              Products
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        className="button-50 button-50--shopify"
                                        onClick={() => saveIntegration('shopify')}
                                        disabled={integrationsSaving === 'shopify'}
                                      >
                                        <span className="button-50__Content">{integrationsSaving === 'shopify' ? 'Saving…' : 'Save'}</span>
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                              {id === 'doordash' && (
                                <>
                                  {doordashLatestDeactivation && (doordashLatestDeactivation.reason || doordashLatestDeactivation.end_time || doordashLatestDeactivation.notes) && (
                                    <div
                                      style={{
                                        marginBottom: '12px',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        background: isDarkMode ? 'rgba(255, 180, 0, 0.12)' : 'rgba(251, 191, 36, 0.2)',
                                        border: isDarkMode ? '1px solid rgba(255, 180, 0, 0.3)' : '1px solid rgba(245, 158, 11, 0.4)',
                                        fontSize: '13px',
                                        color: isDarkMode ? '#fbbf24' : '#b45309'
                                      }}
                                    >
                                      <strong>Store temporarily deactivated</strong>
                                      {doordashLatestDeactivation.reason && <span>: {doordashLatestDeactivation.reason}</span>}
                                      {doordashLatestDeactivation.end_time && (
                                        <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', opacity: 0.95 }}>
                                          End time: {new Date(doordashLatestDeactivation.end_time).toLocaleString()}
                                        </span>
                                      )}
                                      {doordashLatestDeactivation.notes && (
                                        <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>{doordashLatestDeactivation.notes}</span>
                                      )}
                                    </div>
                                  )}
                                  <p style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#666', margin: '0 0 12px 0' }}>
                                    Webhooks are set up automatically using your store URL. Use <strong>Settings → DoorDash</strong> for hours, push menu, and advanced options.
                                  </p>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      className="button-50 button-50--doordash"
                                      onClick={() => setDoordashEditModalOpen(true)}
                                    >
                                      <span className="button-50__Content">Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="button-50 button-50--doordash"
                                      onClick={() => saveIntegration('doordash')}
                                      disabled={integrationsSaving === 'doordash'}
                                    >
                                      <span className="button-50__Content">{integrationsSaving === 'doordash' ? 'Saving…' : 'Save'}</span>
                                    </button>
                                  </div>
                                </>
                              )}
                              {id !== 'shopify' && id !== 'doordash' && (
                                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className={`button-50 button-50--${id}`}
                                    onClick={() => saveIntegration(id)}
                                    disabled={integrationsSaving === id}
                                  >
                                    <span className="button-50__Content">{integrationsSaving === id ? 'Saving…' : 'Save'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {hasAdminAccess && (
                        <SquareMigrationCard
                          isDarkMode={isDarkMode}
                          themeColorRgb={themeColorRgb}
                          showToast={showToast}
                          compactPrimaryButtonStyle={compactPrimaryButtonStyle}
                          inputBaseStyle={inputBaseStyle}
                          getInputFocusHandlers={getInputFocusHandlers}
                          FormField={FormField}
                          FormLabel={FormLabel}
                          searchParams={searchParams}
                        />
                      )}
                    </div>
                  )}
                  {doordashItemHoursModalOpen && typeof createPortal === 'function' && createPortal(
                    <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)'
                      }}
                      onClick={(e) => { if (e.target === e.currentTarget) setDoordashItemHoursModalOpen(false) }}
                    >
                      <div
                        style={{
                          background: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                          borderRadius: '12px',
                          boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.2)',
                          maxWidth: '90vw',
                          width: '720px',
                          maxHeight: '85vh',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ padding: '16px 20px', borderBottom: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333' }}>DoorDash item-level hours</h3>
                          <button type="button" onClick={() => setDoordashItemHoursModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: isDarkMode ? '#999' : '#666' }} aria-label="Close">×</button>
                        </div>
                        <p style={{ padding: '12px 20px 0', margin: 0, fontSize: '12px', color: isDarkMode ? '#888' : '#666' }}>
                          Optional. JSON array per product, e.g. [{'{'} "day_index": "MON", "start_time": "05:00:00", "end_time": "17:00:00" {'}'}]. Leave empty to use store hours. <code>start_date</code>/<code>end_date</code> (YYYY-MM-DD) for LTO.
                        </p>
                        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                          {doordashItemHoursProducts.length === 0 ? (
                            <p style={{ color: isDarkMode ? '#888' : '#666' }}>Loading…</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {doordashItemHoursProducts.map((p) => (
                                <div key={p.product_id} style={{ border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee', borderRadius: '8px', padding: '10px 12px' }}>
                                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{p.product_name || 'Unnamed'}</div>
                                  <div style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#666', marginBottom: '6px' }}>SKU: {p.sku}</div>
                                  <textarea
                                    value={p.item_special_hours_edit ?? ''}
                                    onChange={(e) => setDoordashItemHoursEdit(p.product_id, e.target.value)}
                                    placeholder={'[] or e.g. [{"day_index":"MON","start_time":"05:00:00","end_time":"17:00:00"}]'}
                                    rows={2}
                                    style={{
                                      width: '100%',
                                      boxSizing: 'border-box',
                                      padding: '8px',
                                      fontSize: '12px',
                                      fontFamily: 'monospace',
                                      background: isDarkMode ? '#2a2a2a' : '#f9f9f9',
                                      border: isDarkMode ? '1px solid #444' : '1px solid #ddd',
                                      borderRadius: '6px',
                                      color: isDarkMode ? '#eee' : '#333'
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button type="button" onClick={() => setDoordashItemHoursModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: isDarkMode ? '1px solid #555' : '1px solid #ccc', background: 'none', color: isDarkMode ? '#eee' : '#333', cursor: 'pointer' }}>Cancel</button>
                          <button type="button" onClick={saveDoordashItemHours} disabled={doordashItemHoursSaving} className="button-50 button-50--doordash" style={{ padding: '8px 16px' }}>
                            <span className="button-50__Content">{doordashItemHoursSaving ? 'Saving…' : 'Save'}</span>
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                  {doordashDeactivateModalOpen && typeof createPortal === 'function' && createPortal(
                    <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)'
                      }}
                      onClick={(e) => { if (e.target === e.currentTarget) setDoordashDeactivateModalOpen(false) }}
                    >
                      <div
                        style={{
                          background: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                          borderRadius: '12px',
                          boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.2)',
                          maxWidth: '90vw',
                          width: '440px',
                          padding: '20px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333' }}>DoorDash: Deactivate store</h3>
                          <button type="button" onClick={() => setDoordashDeactivateModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: isDarkMode ? '#999' : '#666' }} aria-label="Close">×</button>
                        </div>
                        <p style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#666', marginBottom: '12px' }}>
                          Without an end time, the store will deactivate for 2 weeks then auto-reactivate. Use end time for a specific reactivation time (ISO format).
                        </p>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Reason (required)</label>
                          <select
                            value={doordashDeactivateReason}
                            onChange={(e) => setDoordashDeactivateReason(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ddd',
                              background: isDarkMode ? 'var(--bg-tertiary)' : '#fff',
                              color: isDarkMode ? 'var(--text-primary)' : '#333',
                              fontSize: '14px'
                            }}
                          >
                            {doordashDeactivateReasons.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Notes (required)</label>
                          <textarea
                            value={doordashDeactivateNotes}
                            onChange={(e) => setDoordashDeactivateNotes(e.target.value)}
                            placeholder="Detail reason for internal records"
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ddd',
                              background: isDarkMode ? 'var(--bg-tertiary)' : '#fff',
                              color: isDarkMode ? 'var(--text-primary)' : '#333',
                              fontSize: '14px',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>End time (optional, ISO e.g. 2023-04-28T01:01:00+01:00)</label>
                          <input
                            type="text"
                            value={doordashDeactivateEndTime}
                            onChange={(e) => setDoordashDeactivateEndTime(e.target.value)}
                            placeholder="Leave empty for 2-week auto reactivate"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ddd',
                              background: isDarkMode ? 'var(--bg-tertiary)' : '#fff',
                              color: isDarkMode ? 'var(--text-primary)' : '#333',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button type="button" onClick={() => setDoordashDeactivateModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: isDarkMode ? '1px solid #555' : '1px solid #ccc', background: 'none', color: isDarkMode ? '#eee' : '#333', cursor: 'pointer' }}>Cancel</button>
                          <button type="button" onClick={doordashDeactivateStoreSubmit} disabled={doordashStoreStatusLoading} className="button-50 button-50--doordash" style={{ padding: '8px 16px', background: '#c53030', border: '1px solid #b91c1c' }}>
                            <span className="button-50__Content">{doordashStoreStatusLoading ? 'Sending…' : 'Deactivate'}</span>
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                  {doordashSetupModalOpen && typeof createPortal === 'function' && createPortal(
                    <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '20px'
                      }}
                      onClick={(e) => { if (e.target === e.currentTarget) setDoordashSetupModalOpen(false) }}
                    >
                      <div
                        style={{
                          background: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                          borderRadius: '12px',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                          maxWidth: '480px',
                          width: '100%',
                          maxHeight: '90vh',
                          overflow: 'auto',
                          padding: '20px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333' }}>DoorDash setup</h3>
                          <button type="button" onClick={() => setDoordashSetupModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: isDarkMode ? '#999' : '#666' }} aria-label="Close">×</button>
                        </div>
                        <p style={{ fontSize: '13px', color: isDarkMode ? '#888' : '#666', marginBottom: '16px' }}>
                          Set your DoorDash hours and which days you’re unavailable. You can add all inventory items to DoorDash in one step.
                        </p>
                        <FormField isDarkMode={isDarkMode} label="DoorDash hours (unavailable = closed that day)" style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                              const d = doordashSetupHours[day] || { open: '09:00', close: '17:00', closed: false }
                              return (
                                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <label style={{ width: '80px', fontSize: '13px', color: isDarkMode ? '#ccc' : '#555', textTransform: 'capitalize' }}>{day}</label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                                    <input
                                      type="checkbox"
                                      checked={!!d.closed}
                                      onChange={(e) => setDoordashSetupHours(prev => ({
                                        ...prev,
                                        [day]: { ...prev[day], closed: e.target.checked }
                                      }))}
                                    />
                                    <span>Closed</span>
                                  </label>
                                  {!d.closed && (
                                    <>
                                      <input
                                        type="time"
                                        value={d.open || '09:00'}
                                        onChange={(e) => setDoordashSetupHours(prev => ({ ...prev, [day]: { ...prev[day], open: e.target.value } }))}
                                        style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), padding: '4px 8px', fontSize: '13px', width: '100px' }}
                                      />
                                      <span style={{ color: isDarkMode ? '#888' : '#999' }}>–</span>
                                      <input
                                        type="time"
                                        value={d.close || '17:00'}
                                        onChange={(e) => setDoordashSetupHours(prev => ({ ...prev, [day]: { ...prev[day], close: e.target.value } }))}
                                        style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), padding: '4px 8px', fontSize: '13px', width: '100px' }}
                                      />
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </FormField>
                        <div style={{ marginBottom: '16px' }}>
                          <button
                            type="button"
                            className="button-50 button-50--doordash"
                            disabled={doordashAddAllItemsLoading}
                            onClick={async () => {
                              setDoordashAddAllItemsLoading(true)
                              try {
                                const res = await fetch('/api/integrations/doordash/add-all-items', { method: 'POST' })
                                const data = await res.json()
                                if (data.success) {
                                  showToast(data.message || 'Items added to DoorDash', 'success')
                                } else {
                                  showToast(data.message || 'Failed', 'error')
                                }
                              } catch (e) {
                                showToast('Failed to add items', 'error')
                              } finally {
                                setDoordashAddAllItemsLoading(false)
                              }
                            }}
                          >
                            <span className="button-50__Content">{doordashAddAllItemsLoading ? 'Adding…' : 'Add all inventory items to DoorDash'}</span>
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button type="button" onClick={() => setDoordashSetupModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: isDarkMode ? '1px solid #555' : '1px solid #ccc', background: 'none', color: isDarkMode ? '#eee' : '#333', cursor: 'pointer' }}>Skip</button>
                          <button
                            type="button"
                            className="button-50 button-50--doordash"
                            onClick={async () => {
                              const nextConfig = { ...(integrations.doordash?.config || {}), doordash_hours: doordashSetupHours }
                              setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, config: nextConfig } }))
                              setDoordashSetupModalOpen(false)
                              try {
                                const res = await fetch('/api/integrations', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ provider: 'doordash', enabled: !!integrations.doordash?.enabled, config: nextConfig })
                                })
                                const data = await res.json()
                                if (data.success) showToast('DoorDash setup saved', 'success')
                                else showToast(data.message || 'Failed to save', 'error')
                              } catch (e) {
                                showToast('Failed to save', 'error')
                              }
                            }}
                            style={{ padding: '8px 16px' }}
                          >
                            <span className="button-50__Content">Done</span>
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                  {doordashEditModalOpen && typeof createPortal === 'function' && (() => {
                    const body = integrationsLoading
                      ? <div style={{ padding: '24px', color: isDarkMode ? '#999' : '#666' }}>Loading…</div>
                      : (() => {
                        const state = integrations.doordash || { enabled: false, config: {} }
                        const config = state.config || {}
                        const integrationInputRgb = themeColorRgb
                        const integrationInputGlassStyle = {
                          background: isDarkMode ? 'rgba(50, 50, 50, 0.35)' : 'rgba(255, 255, 255, 0.35)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.14)',
                          boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255, 255, 255, 0.04)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.4)'
                        }
                        return (
                          <>
                            {doordashLatestDeactivation && (doordashLatestDeactivation.reason || doordashLatestDeactivation.end_time || doordashLatestDeactivation.notes) && (
                              <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', background: isDarkMode ? 'rgba(255, 180, 0, 0.12)' : 'rgba(251, 191, 36, 0.2)', border: isDarkMode ? '1px solid rgba(255, 180, 0, 0.3)' : '1px solid rgba(245, 158, 11, 0.4)', fontSize: '13px', color: isDarkMode ? '#fbbf24' : '#b45309' }}>
                                <strong>Store temporarily deactivated</strong>
                                {doordashLatestDeactivation.reason && <span>: {doordashLatestDeactivation.reason}</span>}
                                {doordashLatestDeactivation.end_time && <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', opacity: 0.95 }}>End time: {new Date(doordashLatestDeactivation.end_time).toLocaleString()}</span>}
                                {doordashLatestDeactivation.notes && <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>{doordashLatestDeactivation.notes}</span>}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '16px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                                <img src="/doordash.svg" alt="" style={{ height: '24px', width: 'auto', maxWidth: '72px', objectFit: 'contain' }} />
                                DoorDash
                              </span>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: isDarkMode ? '#888' : '#999' }}>{state.enabled ? 'Activated' : 'Deactivated'}</span>
                                <div className="checkbox-wrapper-2 integration-toggle integration-card-doordash-bg" style={{ flexShrink: 0 }}>
                                  <input type="checkbox" className="sc-gJwTLC ikxBAC" checked={!!state.enabled} onChange={() => setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, enabled: !prev.doordash.enabled } }))} />
                                </div>
                              </label>
                            </div>
                            <FormField isDarkMode={isDarkMode} label="API key" style={{ marginBottom: '12px' }}>
                              <input type="password" autoComplete="off" value={config.api_key || ''} onChange={(e) => setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, config: { ...(prev.doordash?.config || {}), api_key: e.target.value } } }))} placeholder="From DoorDash Developer Portal" style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle, maxWidth: '320px' }} {...getInputFocusHandlers(integrationInputRgb, isDarkMode)} />
                            </FormField>
                            <p style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#666', marginBottom: '16px' }}><strong>Actions</strong> – Push menu, store/menu info, deactivate store.</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                              <div ref={doordashSyncDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
                                <button type="button" className="button-50 button-50--doordash" onClick={() => setDoordashSyncDropdownOpen((o) => !o)} disabled={doordashSyncLoading || !state.enabled}><span className="button-50__Content">{doordashSyncLoading ? 'Syncing…' : 'Sync'}</span></button>
                                {doordashSyncDropdownOpen && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.15)', background: isDarkMode ? 'var(--bg-secondary)' : '#fff', border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee', zIndex: 1000, overflow: 'hidden' }}>
                                    <button type="button" style={{ display: 'block', width: '100%', padding: '8px 6px', textAlign: 'left', border: 'none', background: 'none', fontSize: '11px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary)' : '#333', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.background = isDarkMode ? 'var(--bg-tertiary)' : '#fff0f0' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }} onClick={() => { syncDoordashNow(); setDoordashSyncDropdownOpen(false) }}>Orders</button>
                                  </div>
                                )}
                              </div>
                              <button type="button" className="button-50 button-50--doordash" onClick={pushDoordashMenuNow} disabled={doordashPushMenuLoading || !state.enabled}><span className="button-50__Content">{doordashPushMenuLoading ? 'Pushing…' : 'Push menu'}</span></button>
                              <button type="button" className="button-50 button-50--doordash" onClick={getDoordashMenuNow} disabled={doordashGetMenuLoading || !state.enabled}><span className="button-50__Content">{doordashGetMenuLoading ? 'Getting…' : 'Get store menu'}</span></button>
                              <button type="button" className="button-50 button-50--doordash" onClick={getDoordashStoreDetailsNow} disabled={doordashStoreDetailsLoading || !state.enabled}><span className="button-50__Content">{doordashStoreDetailsLoading ? 'Loading…' : 'Store info'}</span></button>
                              <button type="button" className="button-50 button-50--doordash" onClick={getDoordashMenuDetailsNow} disabled={doordashMenuDetailsLoading || !state.enabled}><span className="button-50__Content">{doordashMenuDetailsLoading ? 'Loading…' : 'Menu info'}</span></button>
                              <button type="button" className="button-50 button-50--doordash" onClick={() => { setDoordashDeactivateModalOpen(true) }} disabled={doordashStoreStatusLoading || !state.enabled}><span className="button-50__Content">Deactivate store</span></button>
                              <button type="button" className="button-50 button-50--doordash" onClick={doordashReactivateStore} disabled={doordashStoreStatusLoading || !state.enabled}><span className="button-50__Content">{doordashStoreStatusLoading ? 'Updating…' : 'Reactivate store'}</span></button>
                              <button type="button" className="button-50 button-50--doordash" onClick={runDoordashMigrations} disabled={doordashMigrationsLoading}><span className="button-50__Content">{doordashMigrationsLoading ? 'Running…' : 'Run migrations'}</span></button>
                              <button type="button" className="button-50 button-50--doordash" onClick={openDoordashItemHoursModal}><span className="button-50__Content">Item-level hours</span></button>
                            </div>
                            <FormField isDarkMode={isDarkMode} label="Location id (Menu Pull URL)" style={{ marginBottom: '8px' }}>
                              <input type="text" value={config.location_id ?? '1'} onChange={(e) => setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, config: { ...(prev.doordash?.config || {}), location_id: e.target.value || '1' } } }))} placeholder="1" style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle, maxWidth: '80px' }} {...getInputFocusHandlers(integrationInputRgb, isDarkMode)} />
                              <span style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#666', marginLeft: '8px' }}>Usually your establishment id. Used in Menu Pull URL.</span>
                            </FormField>
                            <FormField isDarkMode={isDarkMode} label="Public base URL (item images)" style={{ marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <input type="url" value={config.doordash_public_base_url || config.public_base_url || ''} onChange={(e) => setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, config: { ...(prev.doordash?.config || {}), doordash_public_base_url: e.target.value.trim() } } }))} placeholder="https://your-store.com" style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle, maxWidth: '280px', flex: '1 1 200px' }} {...getInputFocusHandlers(integrationInputRgb, isDarkMode)} />
                                <button type="button" onClick={() => setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, config: { ...(prev.doordash?.config || {}), doordash_public_base_url: typeof window !== 'undefined' ? window.location.origin : '' } } }))} style={{ padding: '6px 10px', borderRadius: '6px', border: isDarkMode ? '1px solid #555' : '1px solid #ccc', background: isDarkMode ? '#333' : '#f5f5f5', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Use current site URL</button>
                              </div>
                              <span style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#666', marginTop: '4px', display: 'block' }}>For DoorDash item photos.</span>
                            </FormField>
                            <FormField isDarkMode={isDarkMode} label="Default pickup instructions for Dasher (optional)" style={{ marginBottom: '8px' }}>
                              <textarea value={config.doordash_pickup_instructions_default || config.pickup_instructions || ''} onChange={(e) => setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, config: { ...(prev.doordash?.config || {}), doordash_pickup_instructions_default: e.target.value } } }))} placeholder="e.g. Pick up at counter" rows={2} style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), ...integrationInputGlassStyle, maxWidth: '400px', resize: 'vertical' }} {...getInputFocusHandlers(integrationInputRgb, isDarkMode)} />
                            </FormField>
                            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
                              <p style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333', marginBottom: '6px' }}>Sync menu to inventory</p>
                              <p style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#666', marginBottom: '12px' }}>If you have an existing DoorDash store, pull the menu and map each DoorDash item to a POS product.</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                <button type="button" className="button-50 button-50--doordash" disabled={doordashSyncMenuLoading || !state.enabled} onClick={async () => { setDoordashSyncMenuLoading(true); try { const [menuRes, invRes] = await Promise.all([cachedFetch('/api/integrations/doordash/store-menu-flat'), cachedFetch('/api/inventory?item_type=product&limit=2000')]); const menuData = await menuRes.json(); const invData = await invRes.json(); if (menuData.success && Array.isArray(menuData.items)) { setDoordashSyncMenuItems(menuData.items); const existing = (config.doordash_item_to_product_id && typeof config.doordash_item_to_product_id === 'object') ? config.doordash_item_to_product_id : {}; setDoordashSyncMappings(existing); } else { showToast(menuData.message || 'Failed to pull menu', 'error'); } const invList = (invData && Array.isArray(invData.data)) ? invData.data : []; setDoordashSyncInventoryProducts(invList.map(p => ({ product_id: p.product_id, product_name: (p.product_name || '').trim() || `Product ${p.product_id}` }))); } catch (e) { showToast('Failed to pull menu', 'error'); } finally { setDoordashSyncMenuLoading(false); } }}><span className="button-50__Content">{doordashSyncMenuLoading ? 'Pulling…' : 'Pull DoorDash menu'}</span></button>
                                {doordashSyncMenuItems.length > 0 && (
                                  <button type="button" className="button-50 button-50--doordash" disabled={doordashSyncSaveLoading} onClick={async () => { setDoordashSyncSaveLoading(true); try { const res = await fetch('/api/integrations/doordash/menu-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings: doordashSyncMappings }) }); const data = await res.json(); if (data.success) { showToast(data.message || 'Mapping saved', 'success'); setIntegrations(prev => ({ ...prev, doordash: { ...prev.doordash, config: { ...(prev.doordash?.config || {}), doordash_item_to_product_id: doordashSyncMappings } } })); } else { showToast(data.message || 'Save failed', 'error'); } } catch (e) { showToast('Failed to save mapping', 'error'); } finally { setDoordashSyncSaveLoading(false); } }}><span className="button-50__Content">{doordashSyncSaveLoading ? 'Saving…' : 'Save mapping'}</span></button>
                                )}
                              </div>
                              {doordashSyncMenuItems.length > 0 && (
                                <div style={{ maxHeight: '240px', overflow: 'auto', marginBottom: '12px', border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ddd', borderRadius: '8px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead><tr style={{ background: isDarkMode ? 'var(--bg-tertiary)' : '#f5f5f5', position: 'sticky', top: 0, zIndex: 1 }}><th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ddd' }}>DoorDash item</th><th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ddd', width: '80px' }}>Price</th><th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: isDarkMode ? '1px solid var(--border-light)' : '1px solid #ddd', minWidth: '180px' }}>Map to POS product</th></tr></thead>
                                    <tbody>
                                      {doordashSyncMenuItems.map((item) => (
                                        <tr key={item.doordash_id} style={{ borderBottom: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
                                          <td style={{ padding: '8px 10px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}><span title={item.doordash_id}>{item.name}</span></td>
                                          <td style={{ padding: '8px 10px', color: isDarkMode ? '#888' : '#666' }}>${(item.price_cents / 100).toFixed(2)}</td>
                                          <td style={{ padding: '8px 10px' }}>
                                            <select value={doordashSyncMappings[item.doordash_id] ?? ''} onChange={(e) => { const v = e.target.value; setDoordashSyncMappings(prev => { const next = { ...prev }; if (v === '') delete next[item.doordash_id]; else next[item.doordash_id] = parseInt(v, 10); return next; }); }} style={{ ...inputBaseStyle(isDarkMode, integrationInputRgb), padding: '6px 8px', width: '100%', maxWidth: '220px', fontSize: '12px' }}>
                                              <option value="">— Not mapped —</option>
                                              {doordashSyncInventoryProducts.map((p) => (<option key={p.product_id} value={p.product_id}>{p.product_name}</option>))}
                                            </select>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button type="button" onClick={() => setDoordashEditModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: isDarkMode ? '1px solid #555' : '1px solid #ccc', background: 'none', color: isDarkMode ? '#eee' : '#333', cursor: 'pointer' }}>Close</button>
                              <button type="button" className="button-50 button-50--doordash" onClick={() => saveIntegration('doordash')} disabled={integrationsSaving === 'doordash'}><span className="button-50__Content">{integrationsSaving === 'doordash' ? 'Saving…' : 'Save'}</span></button>
                            </div>
                          </>
                        )
                      })()
                    return createPortal(
                      <div
                        style={{
                          position: 'fixed',
                          inset: 0,
                          zIndex: 10000,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '20px'
                        }}
                        onClick={(e) => { if (e.target === e.currentTarget) setDoordashEditModalOpen(false) }}
                      >
                        <div
                          style={{
                            background: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            maxWidth: '720px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#333' }}>DoorDash settings</h3>
                            <button type="button" onClick={() => setDoordashEditModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: isDarkMode ? '#999' : '#666' }} aria-label="Close">×</button>
                          </div>
                          <div style={{ overflow: 'auto', padding: '20px', flex: 1 }}>
                            {body}
                          </div>
                        </div>
                      </div>,
                      document.body
                    )
                  })()}
                  <p style={{ fontSize: '13px', color: isDarkMode ? '#888' : '#999', marginTop: '24px' }}>
                    Webhook URL for incoming orders: <code style={{ background: isDarkMode ? '#333' : '#eee', padding: '2px 6px', borderRadius: '4px' }}>{typeof window !== 'undefined' ? `${window.location.origin}/api/orders/from-integration` : '/api/orders/from-integration'}</code>. Use your integration partner’s dashboard to send orders to this URL with JSON body: order_source, prepare_by_iso, customer_*, order_type, items (product_id, quantity, unit_price).
                  </p>
                </div>
              )}

              {/* Admin Tab */}
              {activeTab === 'admin' && hasAdminAccess && (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <AdminDashboard />
                </div>
              )}

              {activeTab === 'cash' && (
                <div style={{
                  width: '100%',
                  maxWidth: '600px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                  overflow: 'visible'
                }}>
                  <div style={{ flexShrink: 0, width: '100%', minWidth: 0, overflow: 'visible' }}>
                    <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px' }}>
                      Cash Register Management
                    </FormTitle>

                    {/* Register Management - fixed width so add/delete doesn't change form width */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', width: '100%', minWidth: '100%', overflow: 'visible' }}>
                      <FormLabel isDarkMode={isDarkMode} style={{ margin: 0, flexShrink: 0 }}>
                        Registers:
                      </FormLabel>
                      {registers.map((register) => (
                        <div
                          key={register.id}
                          data-register-menu-area
                          data-register-delete-area={registerToDelete?.id === register.id ? true : undefined}
                          role="button"
                          tabIndex={0}
                          onClick={() => setCashSettings({ ...cashSettings, register_id: register.id })}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCashSettings({ ...cashSettings, register_id: register.id }); } }}
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            border: cashSettings.register_id === register.id
                              ? `2px solid rgb(${themeColorRgb})`
                              : (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'),
                            borderRadius: '8px',
                            overflow: 'visible',
                            zIndex: registerToDelete?.id === register.id ? 10001 : undefined,
                            backgroundColor: cashSettings.register_id === register.id
                              ? (isDarkMode ? `rgba(${themeColorRgb}, 0.12)` : `rgba(${themeColorRgb}, 0.08)`)
                              : (isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff'),
                            width: '180px',
                            cursor: 'pointer'
                          }}
                        >
                          {registerEditingId === register.id ? (
                            <input
                              type="text"
                              data-register-input-id={register.id}
                              value={register.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const updated = registers.map(r =>
                                  r.id === register.id ? { ...r, name: e.target.value } : r
                                )
                                setRegisters(updated)
                                localStorage.setItem('cash_registers', JSON.stringify(updated))
                              }}
                              onBlur={() => setRegisterEditingId(null)}
                              style={{
                                ...inputBaseStyle(isDarkMode, themeColorRgb),
                                border: 'none',
                                borderRadius: 0,
                                flex: 1,
                                minWidth: 0,
                                fontSize: '14px',
                                padding: '6px 10px',
                                boxShadow: 'none'
                              }}
                              placeholder="Register name"
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          ) : (
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: '14px',
                                padding: '6px 10px',
                                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {register.name || 'Register name'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRegisterMenuOpenId(registerMenuOpenId === register.id ? null : register.id); }}
                            style={{
                              flexShrink: 0,
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'transparent',
                              color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0
                            }}
                            aria-label="Options"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {registerMenuOpenId === register.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                padding: '4px 0',
                                borderRadius: '8px',
                                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 1001,
                                minWidth: '120px'
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setRegisterEditingId(register.id)
                                  setRegisterMenuOpenId(null)
                                  setTimeout(() => document.querySelector(`[data-register-input-id="${register.id}"]`)?.focus(), 0)
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 14px',
                                  textAlign: 'left',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                                }}
                              >
                                Edit
                              </button>
                              {registers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setRegisterMenuOpenId(null)
                                    setRegisterToDelete({ id: register.id, name: register.name })
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 14px',
                                    textAlign: 'left',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                          {registerToDelete?.id === register.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: '4px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 10002,
                                width: '100%',
                                minWidth: '200px',
                                boxSizing: 'border-box'
                              }}
                            >
                              <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '10px' }}>
                                Delete &quot;{register.name}&quot;?
                              </div>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                <button
                                  type="button"
                                  onClick={() => setRegisterToDelete(null)}
                                  style={{ ...compactCancelButtonStyle(isDarkMode, false), flexShrink: 0, minWidth: '80px' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = registers.filter(r => r.id !== register.id)
                                    setRegisters(updated)
                                    localStorage.setItem('cash_registers', JSON.stringify(updated))
                                    if (cashSettings.register_id === register.id && updated.length > 0) {
                                      setCashSettings({ ...cashSettings, register_id: updated[0].id })
                                    }
                                    setRegisterToDelete(null)
                                  }}
                                  style={{ ...compactPrimaryButtonStyle(themeColorRgb, false), flexShrink: 0, minWidth: '80px' }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const newId = Math.max(...registers.map(r => r.id), 0) + 1
                          const updated = [...registers, { id: newId, name: `Register ${newId}` }]
                          setRegisters(updated)
                          localStorage.setItem('cash_registers', JSON.stringify(updated))
                        }}
                        aria-label="Add register"
                        style={{
                          ...compactPrimaryButtonStyle(themeColorRgb, false),
                          width: '32px',
                          minWidth: '32px',
                          height: '32px',
                          padding: 0
                        }}
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'nowrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="button-26 button-26--header"
                        role="button"
                        onClick={() => {
                          const expectedAmount = parseFloat(lastClosedSession?.ending_cash) || 0
                          setOpenRegisterForm({
                            ...openRegisterForm,
                            register_id: cashSettings.register_id,
                            expected_amount: expectedAmount,
                            total_amount: expectedAmount,
                            adjustment_type: 'none',
                            adjustment_amount: 0,
                            adjustment_denominations: {
                              '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
                              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
                            }
                          })
                          setShowOpenModal(true)
                        }}
                        disabled={!!currentSession}
                        style={{
                          opacity: currentSession ? 0.5 : 1,
                          cursor: currentSession ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <div className="button-26__content">
                          <span className="button-26__text text" style={{ whiteSpace: 'nowrap' }}>Open Register</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="button-26 button-26--header"
                        role="button"
                        onClick={() => {
                          setDailyCount({
                            ...dailyCount,
                            register_id: cashSettings.register_id,
                            count_type: 'drop',
                            count_date: new Date().toISOString().split('T')[0],
                            total_amount: 0,
                            denominations: {
                              '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
                              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
                            },
                            adjustment_type: 'none',
                            adjustment_mode: 'total',
                            adjustment_amount: 0,
                            adjustment_denominations: {
                              '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
                              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
                            },
                            notes: ''
                          })
                          setShowCountDropModal(true)
                        }}
                      >
                        <div className="button-26__content">
                          <span className="button-26__text text" style={{ whiteSpace: 'nowrap' }}>Count Drop</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="button-26 button-26--header"
                        role="button"
                        onClick={() => {
                          if (currentSession) {
                            const expected = calculateExpectedCash()
                            setCloseRegisterForm({
                              ...closeRegisterForm,
                              total_amount: expected,
                              adjustment_type: 'none',
                              adjustment_mode: 'total',
                              adjustment_amount: 0,
                              adjustment_denominations: {
                                '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
                                '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
                              }
                            })
                            setShowCloseModal(true)
                          }
                        }}
                        disabled={!currentSession}
                        style={{
                          opacity: !currentSession ? 0.5 : 1,
                          cursor: !currentSession ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <div className="button-26__content">
                          <span className="button-26__text text" style={{ whiteSpace: 'nowrap' }}>Close Register</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="button-26 button-26--header"
                        role="button"
                        onClick={() => setShowTakeOutModal(true)}
                      >
                        <div className="button-26__content">
                          <span className="button-26__text text" style={{ whiteSpace: 'nowrap' }}>Take Out Money</span>
                        </div>
                      </button>
                    </div>

                    {/* Register Status */}
                    {(currentSession || lastClosedSession) && (
                      <div style={{
                        padding: '16px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                        borderRadius: '8px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                              Register Status: <span style={{ color: currentSession ? `rgb(${themeColorRgb})` : '#999' }}>
                                {currentSession ? 'OPEN' : 'CLOSED'}
                              </span>
                            </strong>
                            {currentSession && (
                              <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginTop: '4px' }}>
                                Opened: {currentSession.opened_at ? new Date(currentSession.opened_at).toLocaleString() : 'N/A'}
                              </div>
                            )}
                            {!currentSession && lastClosedSession && (
                              <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginTop: '4px' }}>
                                Closed: {lastClosedSession.closed_at ? new Date(lastClosedSession.closed_at).toLocaleString() : 'N/A'}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {currentSession && (
                              <div>
                                <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666' }}>
                                  Starting Cash: ${(parseFloat(currentSession?.starting_cash) || 0).toFixed(2)}
                                </div>
                                <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginTop: '4px' }}>
                                  Expected Cash: ${calculateExpectedCash().toFixed(2)}
                                </div>
                              </div>
                            )}
                            {!currentSession && lastClosedSession && (
                              <>
                                <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666' }}>
                                  Ending Cash: ${(parseFloat(lastClosedSession?.ending_cash) || 0).toFixed(2)}
                                </div>
                                {lastClosedSession.opened_at && (
                                  <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginTop: '4px' }}>
                                    Started: ${(parseFloat(lastClosedSession?.starting_cash) || 0).toFixed(2)}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Register Events Table - only this area scrolls */}
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <FormTitle isDarkMode={isDarkMode} style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                        Register Events
                      </FormTitle>
                      <button
                        type="button"
                        onClick={() => {
                          setRegisterRefreshSpinning(true)
                          loadRegisterSessions()
                          loadRegisterEvents()
                          setTimeout(() => setRegisterRefreshSpinning(false), 600)
                        }}
                        aria-label="Refresh register"
                        style={{
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          animation: registerRefreshSpinning ? 'register-refresh-spin 0.6s ease' : 'none'
                        }}>
                          <RefreshCw size={18} />
                        </span>
                      </button>
                    </div>
                    <style>{`
              @keyframes register-refresh-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
                      {registerTransactions.length > 0 ? (
                        <div style={{ border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                              <tr style={{
                                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f8f9fa',
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                                boxShadow: isDarkMode ? '0 1px 0 0 var(--border-color, #404040)' : '0 1px 0 0 #dee2e6'
                              }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6', color: isDarkMode ? 'var(--text-primary)' : '#495057', fontSize: '13px', backgroundColor: 'inherit' }}>Event</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6', color: isDarkMode ? 'var(--text-primary)' : '#495057', fontSize: '13px', backgroundColor: 'inherit' }}>Amount</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6', color: isDarkMode ? 'var(--text-primary)' : '#495057', fontSize: '13px', backgroundColor: 'inherit' }}>Time</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6', color: isDarkMode ? 'var(--text-primary)' : '#495057', fontSize: '13px', backgroundColor: 'inherit' }}>Employee</th>
                                <th style={{ width: '28px', padding: '8px', borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6', backgroundColor: 'inherit' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {registerTransactions.map((t, idx) => {
                                const ts = t.timestamp ? new Date(t.timestamp) : null
                                const now = new Date()
                                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                                const yesterday = new Date(today)
                                yesterday.setDate(yesterday.getDate() - 1)
                                let timeStr = 'N/A'
                                if (ts) {
                                  const timePart = ts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                                  const tsDay = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate())
                                  if (tsDay.getTime() === today.getTime()) timeStr = `Today ${timePart}`
                                  else if (tsDay.getTime() === yesterday.getTime()) timeStr = `Yesterday ${timePart}`
                                  else timeStr = ts.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                                }
                                const eventLabel = t.transaction_type === 'open' ? 'Open' : t.transaction_type === 'close' ? 'Close' : t.transaction_type === 'drop' ? 'Drop' : t.transaction_type === 'take_out' ? 'Take Out' : 'Cash In'
                                const amount = parseFloat(t.amount || 0)
                                const eventId = t.transaction_id != null ? String(t.transaction_id) : `evt-${idx}-${t.timestamp || ''}`
                                const isExpanded = expandedRegisterEventId === eventId
                                const detailLine = t.transaction_type === 'open'
                                  ? `Starting cash: $${amount.toFixed(2)}`
                                  : t.transaction_type === 'close'
                                    ? `Ending cash: $${amount.toFixed(2)}`
                                    : t.transaction_type === 'drop'
                                      ? `Drop amount: $${amount.toFixed(2)}`
                                      : t.transaction_type === 'take_out'
                                        ? `Amount taken out: $${amount.toFixed(2)}`
                                        : amount ? `Amount: $${amount.toFixed(2)}` : ''
                                return (
                                  <Fragment key={eventId}>
                                    <tr
                                      onClick={() => setExpandedRegisterEventId(isExpanded ? null : eventId)}
                                      style={{
                                        cursor: 'pointer',
                                        backgroundColor: isExpanded ? (isDarkMode ? 'var(--bg-tertiary, #333)' : '#f0f0f0') : (idx % 2 === 0 ? (isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff') : (isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#fafafa'))
                                      }}
                                    >
                                      <td style={{ padding: '10px 12px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{eventLabel}</td>
                                      <td style={{ padding: '10px 12px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>${amount.toFixed(2)}</td>
                                      <td style={{ padding: '10px 12px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{timeStr}</td>
                                      <td style={{ padding: '10px 12px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>{t.employee_name || 'N/A'}</td>
                                      <td style={{ padding: '8px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee', color: isDarkMode ? '#999' : '#666' }}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                                    </tr>
                                    {isExpanded && (
                                      <tr style={{ backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5' }}>
                                        <td colSpan={5} style={{ padding: '12px 12px 12px 24px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee', fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#555' }}>
                                          {detailLine && <div style={{ marginBottom: (t.notes || t.reason) ? '6px' : 0 }}><strong>{detailLine}</strong></div>}
                                          {(t.notes || t.reason) ? <div>Notes: {t.notes || t.reason}</div> : null}
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{
                          padding: '40px',
                          textAlign: 'center',
                          color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                          borderRadius: '8px'
                        }}>
                          No register events. Click "Open Register" to start.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Open Register Modal */}
                  {showOpenModal && (
                    <div style={modalOverlayStyle(isDarkMode, 1000)} onClick={() => setShowOpenModal(false)}>
                      <div
                        style={modalContentStyle(isDarkMode, { padding: '30px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' })}
                        onClick={e => e.stopPropagation()}
                      >
                        <h2 style={{
                          marginTop: 0,
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Open Register
                        </h2>

                        {/* Expected Amount Display */}
                        {lastClosedSession && (
                          <FormField>
                            <div style={{
                              padding: '12px',
                              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                              borderRadius: '6px',
                              marginBottom: '12px'
                            }}>
                              <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginBottom: '4px' }}>
                                Expected Amount (from last close):
                              </div>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                ${(parseFloat(lastClosedSession.ending_cash) || 0).toFixed(2)}
                              </div>
                            </div>
                          </FormField>
                        )}

                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Adjustment
                          </FormLabel>
                          <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="open_adjustment_type"
                                value="none"
                                checked={openRegisterForm.adjustment_type === 'none'}
                                onChange={(e) => setOpenRegisterForm({ ...openRegisterForm, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>No Adjustment</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="open_adjustment_type"
                                value="add"
                                checked={openRegisterForm.adjustment_type === 'add'}
                                onChange={(e) => setOpenRegisterForm({ ...openRegisterForm, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Add Cash</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="open_adjustment_type"
                                value="take_out"
                                checked={openRegisterForm.adjustment_type === 'take_out'}
                                onChange={(e) => setOpenRegisterForm({ ...openRegisterForm, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Take Out Cash</span>
                            </label>
                          </div>
                        </FormField>

                        {openRegisterForm.adjustment_type !== 'none' && (
                          <>
                            <FormField>
                              <FormLabel isDarkMode={isDarkMode}>
                                Adjustment Mode
                              </FormLabel>
                              <div style={{ display: 'flex', gap: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="open_adjustment_mode"
                                    value="total"
                                    checked={openRegisterForm.adjustment_mode === 'total'}
                                    onChange={(e) => setOpenRegisterForm({ ...openRegisterForm, adjustment_mode: e.target.value })}
                                  />
                                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Total Amount</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="open_adjustment_mode"
                                    value="denominations"
                                    checked={openRegisterForm.adjustment_mode === 'denominations'}
                                    onChange={(e) => setOpenRegisterForm({ ...openRegisterForm, adjustment_mode: e.target.value })}
                                  />
                                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Denominations</span>
                                </label>
                              </div>
                            </FormField>
                            {openRegisterForm.adjustment_mode === 'total' ? (
                              <FormField>
                                <FormLabel isDarkMode={isDarkMode}>
                                  {openRegisterForm.adjustment_type === 'add' ? 'Amount to Add ($)' : 'Amount to Take Out ($)'}
                                </FormLabel>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={openRegisterForm.adjustment_amount}
                                  onChange={(e) => setOpenRegisterForm({ ...openRegisterForm, adjustment_amount: parseFloat(e.target.value) || 0 })}
                                  style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                            ) : (
                              <FormField>
                                <FormLabel isDarkMode={isDarkMode}>
                                  {openRegisterForm.adjustment_type === 'add' ? 'Bills/Coins to Add' : 'Bills/Coins to Take Out'}
                                </FormLabel>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                  gap: '12px'
                                }}>
                                  {Object.entries(openRegisterForm.adjustment_denominations).map(([denom, count]) => (
                                    <div key={denom}>
                                      <label style={{
                                        display: 'block',
                                        marginBottom: '4px',
                                        fontSize: '14px',
                                        color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                                      }}>
                                        ${denom}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={count}
                                        onChange={(e) => setOpenRegisterForm({
                                          ...openRegisterForm,
                                          adjustment_denominations: {
                                            ...openRegisterForm.adjustment_denominations,
                                            [denom]: parseInt(e.target.value) || 0
                                          },
                                          adjustment_amount: calculateTotalFromDenominations({
                                            ...openRegisterForm.adjustment_denominations,
                                            [denom]: parseInt(e.target.value) || 0
                                          })
                                        })}
                                        style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div style={{
                                  marginTop: '12px',
                                  padding: '12px',
                                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                                  borderRadius: '6px'
                                }}>
                                  <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                    Adjustment Total: ${calculateTotalFromDenominations(openRegisterForm.adjustment_denominations).toFixed(2)}
                                  </strong>
                                </div>
                              </FormField>
                            )}
                          </>
                        )}

                        {/* Final Starting Cash Display */}
                        <FormField>
                          <div style={{
                            padding: '12px',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                            borderRadius: '6px',
                            marginTop: '16px'
                          }}>
                            <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginBottom: '4px' }}>
                              Final Starting Cash:
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: `rgb(${themeColorRgb})` }}>
                              ${(() => {
                                const expected = parseFloat(lastClosedSession?.ending_cash) || 0
                                let adjustment = 0
                                if (openRegisterForm.adjustment_type === 'add') {
                                  adjustment = openRegisterForm.adjustment_mode === 'total'
                                    ? parseFloat(openRegisterForm.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(openRegisterForm.adjustment_denominations)
                                } else if (openRegisterForm.adjustment_type === 'take_out') {
                                  adjustment = -(openRegisterForm.adjustment_mode === 'total'
                                    ? parseFloat(openRegisterForm.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(openRegisterForm.adjustment_denominations))
                                }
                                return (expected + adjustment).toFixed(2)
                              })()}
                            </div>
                          </div>
                        </FormField>
                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Notes (optional)
                          </FormLabel>
                          <textarea
                            value={openRegisterForm.notes}
                            onChange={(e) => setOpenRegisterForm({ ...openRegisterForm, notes: e.target.value })}
                            style={{
                              ...inputBaseStyle(isDarkMode, themeColorRgb),
                              minHeight: '80px',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Additional notes..."
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </FormField>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={() => setShowOpenModal(false)}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">Cancel</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={handleOpenRegister}
                            disabled={saving}
                            style={{
                              opacity: saving ? 0.6 : 1,
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">
                                {saving ? 'Opening...' : 'Open Register'}
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Close Register Modal */}
                  {showCloseModal && currentSession && (
                    <div style={modalOverlayStyle(isDarkMode, 1000)} onClick={() => setShowCloseModal(false)}>
                      <div
                        style={modalContentStyle(isDarkMode, { padding: '30px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' })}
                        onClick={e => e.stopPropagation()}
                      >
                        <h2 style={{
                          marginTop: 0,
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Close Register
                        </h2>
                        <div style={{
                          padding: '16px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                          borderRadius: '8px',
                          marginBottom: '20px'
                        }}>
                          <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginBottom: '8px' }}>
                            Expected Cash: <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>${calculateExpectedCash().toFixed(2)}</strong>
                          </div>
                          <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666' }}>
                            Starting Cash: ${(parseFloat(currentSession?.starting_cash) || 0).toFixed(2)}
                          </div>
                        </div>
                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Cash Mode
                          </FormLabel>
                          <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="close_cash_mode"
                                value="total"
                                checked={closeRegisterForm.cash_mode === 'total'}
                                onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, cash_mode: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Total Amount</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="close_cash_mode"
                                value="denominations"
                                checked={closeRegisterForm.cash_mode === 'denominations'}
                                onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, cash_mode: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Denominations</span>
                            </label>
                          </div>
                        </FormField>
                        {closeRegisterForm.cash_mode === 'total' ? (
                          <FormField>
                            <FormLabel isDarkMode={isDarkMode}>
                              Actual Amount ($)
                            </FormLabel>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={closeRegisterForm.total_amount}
                              onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, total_amount: parseFloat(e.target.value) || 0 })}
                              style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </FormField>
                        ) : (
                          <FormField>
                            <FormLabel isDarkMode={isDarkMode}>
                              Bill and Coin Counts
                            </FormLabel>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                              gap: '12px'
                            }}>
                              {Object.entries(closeRegisterForm.denominations).map(([denom, count]) => (
                                <div key={denom}>
                                  <label style={{
                                    display: 'block',
                                    marginBottom: '4px',
                                    fontSize: '14px',
                                    color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                                  }}>
                                    ${denom}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={count}
                                    onChange={(e) => {
                                      const newDenoms = {
                                        ...closeRegisterForm.denominations,
                                        [denom]: parseInt(e.target.value) || 0
                                      }
                                      setCloseRegisterForm({
                                        ...closeRegisterForm,
                                        denominations: newDenoms,
                                        total_amount: calculateTotalFromDenominations(newDenoms)
                                      })
                                    }}
                                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                  />
                                </div>
                              ))}
                            </div>
                            <div style={{
                              marginTop: '12px',
                              padding: '12px',
                              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                              borderRadius: '6px'
                            }}>
                              <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                Calculated Total: ${calculateTotalFromDenominations(closeRegisterForm.denominations).toFixed(2)}
                              </strong>
                            </div>
                          </FormField>
                        )}

                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Adjustment
                          </FormLabel>
                          <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="close_adjustment_type"
                                value="none"
                                checked={closeRegisterForm.adjustment_type === 'none'}
                                onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>No Adjustment</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="close_adjustment_type"
                                value="add"
                                checked={closeRegisterForm.adjustment_type === 'add'}
                                onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Add Cash</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="close_adjustment_type"
                                value="take_out"
                                checked={closeRegisterForm.adjustment_type === 'take_out'}
                                onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Take Out Cash</span>
                            </label>
                          </div>
                        </FormField>

                        {closeRegisterForm.adjustment_type !== 'none' && (
                          <>
                            <FormField>
                              <FormLabel isDarkMode={isDarkMode}>
                                Adjustment Mode
                              </FormLabel>
                              <div style={{ display: 'flex', gap: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="close_adjustment_mode"
                                    value="total"
                                    checked={closeRegisterForm.adjustment_mode === 'total'}
                                    onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, adjustment_mode: e.target.value })}
                                  />
                                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Total Amount</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="close_adjustment_mode"
                                    value="denominations"
                                    checked={closeRegisterForm.adjustment_mode === 'denominations'}
                                    onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, adjustment_mode: e.target.value })}
                                  />
                                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Denominations</span>
                                </label>
                              </div>
                            </FormField>
                            {closeRegisterForm.adjustment_mode === 'total' ? (
                              <FormField>
                                <FormLabel isDarkMode={isDarkMode}>
                                  {closeRegisterForm.adjustment_type === 'add' ? 'Amount to Add ($)' : 'Amount to Take Out ($)'}
                                </FormLabel>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={closeRegisterForm.adjustment_amount}
                                  onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, adjustment_amount: parseFloat(e.target.value) || 0 })}
                                  style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                            ) : (
                              <FormField>
                                <FormLabel isDarkMode={isDarkMode}>
                                  {closeRegisterForm.adjustment_type === 'add' ? 'Bills/Coins to Add' : 'Bills/Coins to Take Out'}
                                </FormLabel>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                  gap: '12px'
                                }}>
                                  {Object.entries(closeRegisterForm.adjustment_denominations).map(([denom, count]) => (
                                    <div key={denom}>
                                      <label style={{
                                        display: 'block',
                                        marginBottom: '4px',
                                        fontSize: '14px',
                                        color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                                      }}>
                                        ${denom}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={count}
                                        onChange={(e) => {
                                          const newDenoms = {
                                            ...closeRegisterForm.adjustment_denominations,
                                            [denom]: parseInt(e.target.value) || 0
                                          }
                                          setCloseRegisterForm({
                                            ...closeRegisterForm,
                                            adjustment_denominations: newDenoms,
                                            adjustment_amount: calculateTotalFromDenominations(newDenoms)
                                          })
                                        }}
                                        style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div style={{
                                  marginTop: '12px',
                                  padding: '12px',
                                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                                  borderRadius: '6px'
                                }}>
                                  <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                    Adjustment Total: ${calculateTotalFromDenominations(closeRegisterForm.adjustment_denominations).toFixed(2)}
                                  </strong>
                                </div>
                              </FormField>
                            )}
                          </>
                        )}

                        {/* Final Ending Cash Display */}
                        <FormField>
                          <div style={{
                            padding: '12px',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                            borderRadius: '6px',
                            marginTop: '16px'
                          }}>
                            <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginBottom: '4px' }}>
                              Final Ending Cash:
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: `rgb(${themeColorRgb})` }}>
                              ${(() => {
                                const actual = closeRegisterForm.cash_mode === 'total'
                                  ? parseFloat(closeRegisterForm.total_amount) || 0
                                  : calculateTotalFromDenominations(closeRegisterForm.denominations)
                                let adjustment = 0
                                if (closeRegisterForm.adjustment_type === 'add') {
                                  adjustment = closeRegisterForm.adjustment_mode === 'total'
                                    ? parseFloat(closeRegisterForm.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(closeRegisterForm.adjustment_denominations)
                                } else if (closeRegisterForm.adjustment_type === 'take_out') {
                                  adjustment = -(closeRegisterForm.adjustment_mode === 'total'
                                    ? parseFloat(closeRegisterForm.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(closeRegisterForm.adjustment_denominations))
                                }
                                return (actual + adjustment).toFixed(2)
                              })()}
                            </div>
                            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginTop: '4px' }}>
                              Discrepancy: ${(() => {
                                const expected = calculateExpectedCash()
                                const actual = closeRegisterForm.cash_mode === 'total'
                                  ? parseFloat(closeRegisterForm.total_amount) || 0
                                  : calculateTotalFromDenominations(closeRegisterForm.denominations)
                                let adjustment = 0
                                if (closeRegisterForm.adjustment_type === 'add') {
                                  adjustment = closeRegisterForm.adjustment_mode === 'total'
                                    ? parseFloat(closeRegisterForm.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(closeRegisterForm.adjustment_denominations)
                                } else if (closeRegisterForm.adjustment_type === 'take_out') {
                                  adjustment = -(closeRegisterForm.adjustment_mode === 'total'
                                    ? parseFloat(closeRegisterForm.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(closeRegisterForm.adjustment_denominations))
                                }
                                const final = actual + adjustment
                                const discrepancy = final - expected
                                return discrepancy.toFixed(2)
                              })()}
                            </div>
                          </div>
                        </FormField>

                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Notes (optional)
                          </FormLabel>
                          <textarea
                            value={closeRegisterForm.notes}
                            onChange={(e) => setCloseRegisterForm({ ...closeRegisterForm, notes: e.target.value })}
                            style={{
                              ...inputBaseStyle(isDarkMode, themeColorRgb),
                              minHeight: '80px',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Additional notes..."
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </FormField>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={() => setShowCloseModal(false)}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">Cancel</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={handleCloseRegister}
                            disabled={saving}
                            style={{
                              opacity: saving ? 0.6 : 1,
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">
                                {saving ? 'Closing...' : 'Close Register'}
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Take Out Money Modal */}
                  {showTakeOutModal && (
                    <div style={modalOverlayStyle(isDarkMode, 1000)} onClick={() => setShowTakeOutModal(false)}>
                      <div
                        style={modalContentStyle(isDarkMode, { padding: '30px', width: '90%', maxWidth: '500px' })}
                        onClick={e => e.stopPropagation()}
                      >
                        <h2 style={{
                          marginTop: 0,
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Take Out Money
                        </h2>
                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Amount ($)
                          </FormLabel>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={takeOutForm.amount}
                            onChange={(e) => setTakeOutForm({ ...takeOutForm, amount: parseFloat(e.target.value) || 0 })}
                            style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </FormField>
                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Reason (optional)
                          </FormLabel>
                          <CustomDropdown
                            value={takeOutForm.reason}
                            onChange={(e) => setTakeOutForm({ ...takeOutForm, reason: e.target.value })}
                            options={[
                              { value: '', label: 'Select a reason...' },
                              { value: 'Bank deposit', label: 'Bank deposit' },
                              { value: 'Petty cash', label: 'Petty cash' },
                              { value: 'Change order', label: 'Change order' },
                              { value: 'Vendor payment', label: 'Vendor payment' },
                              { value: 'Employee reimbursement', label: 'Employee reimbursement' },
                              { value: 'Other', label: 'Other' }
                            ]}
                            placeholder="Select a reason..."
                            isDarkMode={isDarkMode}
                            themeColorRgb={themeColorRgb}
                            style={{ width: '100%' }}
                          />
                        </FormField>
                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Notes (optional)
                          </FormLabel>
                          <textarea
                            value={takeOutForm.notes}
                            onChange={(e) => setTakeOutForm({ ...takeOutForm, notes: e.target.value })}
                            style={{
                              ...inputBaseStyle(isDarkMode, themeColorRgb),
                              minHeight: '80px',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Additional notes..."
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </FormField>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={() => setShowTakeOutModal(false)}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">Cancel</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={handleTakeOutMoney}
                            disabled={saving || !takeOutForm.amount || takeOutForm.amount <= 0}
                            style={{
                              opacity: (saving || !takeOutForm.amount || takeOutForm.amount <= 0) ? 0.6 : 1,
                              cursor: (saving || !takeOutForm.amount || takeOutForm.amount <= 0) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">
                                {saving ? 'Processing...' : 'Take Out'}
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Count Drop Modal */}
                  {showCountDropModal && (
                    <div style={modalOverlayStyle(isDarkMode, 1000)} onClick={() => setShowCountDropModal(false)}>
                      <div
                        style={modalContentStyle(isDarkMode, { padding: '30px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' })}
                        onClick={e => e.stopPropagation()}
                      >
                        <h2 style={{
                          marginTop: 0,
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Count Drop
                        </h2>
                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Date
                          </FormLabel>
                          <input
                            type="date"
                            value={dailyCount.count_date}
                            onChange={(e) => setDailyCount({ ...dailyCount, count_date: e.target.value })}
                            style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </FormField>
                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Cash Mode
                          </FormLabel>
                          <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="drop_cash_mode"
                                value="total"
                                checked={dailyCount.total_amount > 0 && Object.values(dailyCount.denominations).every(v => v === 0)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDailyCount({
                                      ...dailyCount,
                                      denominations: {
                                        '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
                                        '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
                                      }
                                    })
                                  }
                                }}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Total Amount</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="drop_cash_mode"
                                value="denominations"
                                checked={Object.values(dailyCount.denominations).some(v => v > 0)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDailyCount({ ...dailyCount, total_amount: 0 })
                                  }
                                }}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Denominations</span>
                            </label>
                          </div>
                        </FormField>
                        {Object.values(dailyCount.denominations).every(v => v === 0) ? (
                          <FormField>
                            <FormLabel isDarkMode={isDarkMode}>
                              Drop Amount ($)
                            </FormLabel>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={dailyCount.total_amount}
                              onChange={(e) => setDailyCount({ ...dailyCount, total_amount: parseFloat(e.target.value) || 0 })}
                              style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </FormField>
                        ) : (
                          <FormField>
                            <FormLabel isDarkMode={isDarkMode}>
                              Bill and Coin Counts
                            </FormLabel>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                              gap: '12px'
                            }}>
                              {Object.entries(dailyCount.denominations).map(([denom, count]) => (
                                <div key={denom}>
                                  <label style={{
                                    display: 'block',
                                    marginBottom: '4px',
                                    fontSize: '14px',
                                    color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                                  }}>
                                    ${denom}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={count}
                                    onChange={(e) => {
                                      const newDenoms = {
                                        ...dailyCount.denominations,
                                        [denom]: parseInt(e.target.value) || 0
                                      }
                                      setDailyCount({
                                        ...dailyCount,
                                        denominations: newDenoms,
                                        total_amount: calculateTotalFromDenominations(newDenoms)
                                      })
                                    }}
                                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                  />
                                </div>
                              ))}
                            </div>
                            <div style={{
                              marginTop: '12px',
                              padding: '12px',
                              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                              borderRadius: '6px'
                            }}>
                              <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                Calculated Total: ${calculateTotalFromDenominations(dailyCount.denominations).toFixed(2)}
                              </strong>
                            </div>
                          </FormField>
                        )}

                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Adjustment
                          </FormLabel>
                          <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="drop_adjustment_type"
                                value="none"
                                checked={dailyCount.adjustment_type === 'none'}
                                onChange={(e) => setDailyCount({ ...dailyCount, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>No Adjustment</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="drop_adjustment_type"
                                value="add"
                                checked={dailyCount.adjustment_type === 'add'}
                                onChange={(e) => setDailyCount({ ...dailyCount, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Add Cash</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="drop_adjustment_type"
                                value="take_out"
                                checked={dailyCount.adjustment_type === 'take_out'}
                                onChange={(e) => setDailyCount({ ...dailyCount, adjustment_type: e.target.value })}
                              />
                              <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Take Out Cash</span>
                            </label>
                          </div>
                        </FormField>

                        {dailyCount.adjustment_type !== 'none' && (
                          <>
                            <FormField>
                              <FormLabel isDarkMode={isDarkMode}>
                                Adjustment Mode
                              </FormLabel>
                              <div style={{ display: 'flex', gap: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="drop_adjustment_mode"
                                    value="total"
                                    checked={dailyCount.adjustment_mode === 'total'}
                                    onChange={(e) => setDailyCount({ ...dailyCount, adjustment_mode: e.target.value })}
                                  />
                                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Total Amount</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="drop_adjustment_mode"
                                    value="denominations"
                                    checked={dailyCount.adjustment_mode === 'denominations'}
                                    onChange={(e) => setDailyCount({ ...dailyCount, adjustment_mode: e.target.value })}
                                  />
                                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Denominations</span>
                                </label>
                              </div>
                            </FormField>
                            {dailyCount.adjustment_mode === 'total' ? (
                              <FormField>
                                <FormLabel isDarkMode={isDarkMode}>
                                  {dailyCount.adjustment_type === 'add' ? 'Amount to Add ($)' : 'Amount to Take Out ($)'}
                                </FormLabel>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={dailyCount.adjustment_amount}
                                  onChange={(e) => setDailyCount({ ...dailyCount, adjustment_amount: parseFloat(e.target.value) || 0 })}
                                  style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                            ) : (
                              <FormField>
                                <FormLabel isDarkMode={isDarkMode}>
                                  {dailyCount.adjustment_type === 'add' ? 'Bills/Coins to Add' : 'Bills/Coins to Take Out'}
                                </FormLabel>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                  gap: '12px'
                                }}>
                                  {Object.entries(dailyCount.adjustment_denominations).map(([denom, count]) => (
                                    <div key={denom}>
                                      <label style={{
                                        display: 'block',
                                        marginBottom: '4px',
                                        fontSize: '14px',
                                        color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                                      }}>
                                        ${denom}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={count}
                                        onChange={(e) => {
                                          const newDenoms = {
                                            ...dailyCount.adjustment_denominations,
                                            [denom]: parseInt(e.target.value) || 0
                                          }
                                          setDailyCount({
                                            ...dailyCount,
                                            adjustment_denominations: newDenoms,
                                            adjustment_amount: calculateTotalFromDenominations(newDenoms)
                                          })
                                        }}
                                        style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div style={{
                                  marginTop: '12px',
                                  padding: '12px',
                                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                                  borderRadius: '6px'
                                }}>
                                  <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                    Adjustment Total: ${calculateTotalFromDenominations(dailyCount.adjustment_denominations).toFixed(2)}
                                  </strong>
                                </div>
                              </FormField>
                            )}
                          </>
                        )}

                        {/* Final Drop Amount Display */}
                        <FormField>
                          <div style={{
                            padding: '12px',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                            borderRadius: '6px',
                            marginTop: '16px'
                          }}>
                            <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginBottom: '4px' }}>
                              Final Drop Amount:
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: `rgb(${themeColorRgb})` }}>
                              ${(() => {
                                const dropAmount = Object.values(dailyCount.denominations).every(v => v === 0)
                                  ? parseFloat(dailyCount.total_amount) || 0
                                  : calculateTotalFromDenominations(dailyCount.denominations)
                                let adjustment = 0
                                if (dailyCount.adjustment_type === 'add') {
                                  adjustment = dailyCount.adjustment_mode === 'total'
                                    ? parseFloat(dailyCount.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(dailyCount.adjustment_denominations)
                                } else if (dailyCount.adjustment_type === 'take_out') {
                                  adjustment = -(dailyCount.adjustment_mode === 'total'
                                    ? parseFloat(dailyCount.adjustment_amount) || 0
                                    : calculateTotalFromDenominations(dailyCount.adjustment_denominations))
                                }
                                return (dropAmount + adjustment).toFixed(2)
                              })()}
                            </div>
                          </div>
                        </FormField>

                        <FormField>
                          <FormLabel isDarkMode={isDarkMode}>
                            Notes (optional)
                          </FormLabel>
                          <textarea
                            value={dailyCount.notes}
                            onChange={(e) => setDailyCount({ ...dailyCount, notes: e.target.value })}
                            style={{
                              ...inputBaseStyle(isDarkMode, themeColorRgb),
                              minHeight: '80px',
                              resize: 'vertical',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Additional notes..."
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </FormField>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={() => setShowCountDropModal(false)}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">Cancel</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="button-26 button-26--header"
                            role="button"
                            onClick={handleCountDrop}
                            disabled={saving || (!dailyCount.total_amount && Object.values(dailyCount.denominations).every(v => v === 0))}
                            style={{
                              opacity: (saving || (!dailyCount.total_amount && Object.values(dailyCount.denominations).every(v => v === 0))) ? 0.6 : 1,
                              cursor: (saving || (!dailyCount.total_amount && Object.values(dailyCount.denominations).every(v => v === 0))) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <div className="button-26__content">
                              <span className="button-26__text text">
                                {saving ? 'Saving...' : 'Save Drop'}
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
            borderRadius: '12px',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 10001,
            fontSize: '14px',
            fontWeight: 500,
            maxWidth: '90vw'
          }}
        >
          {toast.type === 'error' ? (
            <XCircle size={20} style={{ flexShrink: 0, color: '#d32f2f' }} />
          ) : (
            <CheckCircle size={20} style={{ flexShrink: 0, color: `rgb(${themeColorRgb})` }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}

export default Settings

