# Frontend Barcode Scanning Integration

The POS system now supports barcode scanning with three methods:
1. **Hardware Scanner** - USB/wireless barcode scanners that act as keyboard input
2. **Camera Scanner** - Real-time barcode scanning using device camera
3. **Image Scanner** - Take a photo and use AI image matching + barcode detection

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install
```

This will install:
- `html5-qrcode` - For camera-based barcode scanning

### 2. Build or Run Development Server

```bash
# Development mode
npm run dev

# Production build
npm run build
```

## Usage

### Hardware Scanner

1. Connect your USB or wireless barcode scanner to the device
2. Click "Scan Barcode" button in the POS interface
3. Select "Hardware Scanner" mode
4. Point scanner at barcode and scan
5. Product is automatically added to cart if found

**Note**: Hardware scanners typically send barcode data as keyboard input followed by Enter. The system automatically detects and processes this.

### Camera Scanner

1. Click "Scan Barcode" button
2. Select "Camera Scanner" mode
3. Grant camera permissions when prompted
4. Point camera at barcode
5. Product is automatically identified and added to cart

**Requirements**:
- Device with camera
- HTTPS connection (required for camera access in browsers)
- Camera permissions granted

### Image Scanner (AI-Powered)

1. Click "Scan Barcode" button
2. Select "Take Photo" mode
3. Take a photo of the product
4. System uses:
   - Barcode detection (if visible)
   - AI image matching (if barcode not found)
5. Product is identified and added to cart

**Benefits**:
- Works even if barcode is damaged or missing
- Can identify products by appearance
- Shows confidence score

## Features

### Automatic Product Lookup

The system tries multiple methods to find products:
1. Search by barcode (if product has barcode in database)
2. Search by SKU (fallback if barcode not found)
3. AI image matching (if barcode/SKU not found and image provided)

### User Feedback

- Success messages when product is added
- Error messages if product not found
- Loading indicators during processing
- Auto-dismissing notifications

### Integration with POS

- Scanned products automatically added to cart
- Quantity can be adjusted after scanning
- Works seamlessly with existing search functionality

## Browser Compatibility

### Camera Access
- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 11+)
- **Mobile browsers**: Full support

### Hardware Scanners
- Works on all browsers
- Requires scanner to be configured as keyboard input device

## Troubleshooting

### Camera Not Working

1. **Check permissions**: Browser must have camera access
2. **HTTPS required**: Camera access requires secure connection
3. **Try different browser**: Some browsers have better camera support
4. **Check device**: Ensure camera is not in use by another app

### Hardware Scanner Not Working

1. **Check connection**: Ensure scanner is connected and powered
2. **Test in text field**: Try scanning in a text input to verify scanner works
3. **Scanner mode**: Some scanners need to be in "keyboard" mode
4. **Focus**: Ensure search/scan input field has focus

### Product Not Found

1. **Add barcode to product**: Update product in database with barcode value
2. **Check SKU**: System also searches by SKU
3. **Try image scanning**: Use "Take Photo" mode for AI-powered identification
4. **Manual search**: Fall back to text search if scanning fails

## API Integration

The frontend uses these API endpoints:

- `GET /api/inventory` - Get all products for local lookup
- `POST /api/identify_product` - Smart identification (barcode + image matching)

## Development

### Component Structure

- `BarcodeScanner.jsx` - Main scanner component
- `POS.jsx` - POS component with scanner integration

### Adding New Scanner Types

To add a new scanning method:

1. Add mode to `scanMode` state
2. Add UI button in mode selection
3. Implement scanning logic
4. Call `onScan` or `onImageScan` callback with result

## Best Practices

1. **Add barcodes to products**: Update inventory with barcode values for faster lookup
2. **Use hardware scanners**: Fastest and most reliable for high-volume scanning
3. **Camera for mobile**: Use camera scanner on tablets/mobile devices
4. **Image scanning fallback**: Use when barcode is damaged or missing
5. **Error handling**: Always provide user feedback on scan results

## Security Notes

- Camera access requires user permission
- Images are processed server-side for AI matching
- No images are stored permanently (processed and discarded)
- HTTPS required for camera access in production

