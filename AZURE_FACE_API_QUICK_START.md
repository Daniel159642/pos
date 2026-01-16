# Azure Face API Quick Start

## 5-Minute Setup

### 1. Get Azure Credentials (2 minutes)

1. Go to https://portal.azure.com
2. Create a "Face" resource (Free tier: F0)
3. Copy your **Endpoint** and **Key** from "Keys and Endpoint"

### 2. Set Environment Variables (1 minute)

```bash
export AZURE_FACE_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
export AZURE_FACE_SUBSCRIPTION_KEY="your-key-here"
```

### 3. Run Migration (30 seconds)

```bash
python3 migrate_azure_face_api.py
```

### 4. Install Dependencies (1 minute)

```bash
pip install -r requirements.txt
```

### 5. Test Enrollment (30 seconds)

1. Start the server: `python3 web_viewer.py`
2. Log in to the system
3. Go to Profile page
4. Click "Enroll Face" (Azure Face API option)
5. Capture your face

## API Endpoints

### Enrollment
```
POST /api/azure-face/enroll
Body: { "image_data": "data:image/jpeg;base64,..." }
```

### Recognition
```
POST /api/azure-face/recognize
Body: { "image_data": "data:image/jpeg;base64,..." }
```

### Clock In/Out
```
POST /api/azure-face/clock
Body: { 
  "image_data": "data:image/jpeg;base64,...",
  "action": "clock_in" | "clock_out",
  "latitude": 0.0,
  "longitude": 0.0,
  "address": "..."
}
```

### PIN Code Fallback
```
POST /api/clock/pin
Body: {
  "pin_code": "1234",
  "action": "clock_in" | "clock_out"
}
```

## Frontend Usage

```jsx
import AzureFaceRecognition from './components/AzureFaceRecognition'

// Enrollment
<AzureFaceRecognition
  mode="enroll"
  isActive={true}
  onFaceCaptured={async (imageData) => {
    const response = await fetch('/api/azure-face/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: imageData })
    })
    const result = await response.json()
    console.log(result)
  }}
/>

// Recognition
<AzureFaceRecognition
  mode="recognize"
  isActive={true}
  onFaceCaptured={async (imageData) => {
    const response = await fetch('/api/azure-face/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: imageData })
    })
    const result = await response.json()
    console.log(result)
  }}
/>
```

## Troubleshooting

**Error: "Azure Face API not configured"**
→ Set environment variables

**Error: "Camera permission denied"**
→ Allow camera access in browser

**Error: "Face not recognized"**
→ Re-enroll with better lighting/quality

**Error: "Liveness check failed"**
→ Use live camera, not uploaded photo

## Cost

- **Free Tier**: 30,000 transactions/month
- **After Free Tier**: ~$1 per 1,000 transactions (varies by region)

## Security

- Never commit API keys to git
- Use environment variables
- Enable HTTPS in production
- Monitor usage in Azure Portal
