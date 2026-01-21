# Google Maps Address Autocomplete Setup

The onboarding form now includes Google Maps Places Autocomplete for the address field. As users type their street address, they'll see suggestions and can select from the dropdown.

## Features

- **Address Autocomplete**: Suggestions appear as you type
- **Auto-fill City, State, ZIP**: Selecting an address automatically fills in the city, state, and ZIP code fields
- **US Addresses**: Restricted to US addresses for better accuracy

## Setup Instructions

### 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Places API"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key

### 2. Add API Key to Environment

Create a `.env` file in the `frontend/` directory (if it doesn't exist):

```bash
cd frontend
touch .env
```

Add your API key to the `.env` file:

```
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Important**: Replace `your_api_key_here` with your actual API key.

### 3. Restart Development Server

After adding the API key, restart your development server:

```bash
npm run dev
```

### 4. (Optional) Restrict API Key

For security, restrict your API key in Google Cloud Console:

1. Go to "APIs & Services" > "Credentials"
2. Click on your API key
3. Under "API restrictions", select "Restrict key"
4. Choose "Places API"
5. Under "Application restrictions", you can restrict by HTTP referrer (for production)

## How It Works

1. User starts typing in the "Street Address" field
2. Google Maps Places API provides suggestions
3. User selects an address from the dropdown
4. The system automatically extracts and fills:
   - Street address (number + route)
   - City
   - State (2-letter code)
   - ZIP code

## Fallback Behavior

If the Google Maps API key is not configured:
- The address field still works normally
- Users can manually type their address
- City, State, and ZIP fields must be filled manually

## Cost

Google Maps Places API has a free tier:
- **$200 free credit per month**
- After free tier: $17 per 1,000 autocomplete sessions
- For most small businesses, this is free

## Security Notes

- Never commit your `.env` file to git (it should already be in `.gitignore`)
- For production, set the environment variable on your hosting platform
- Consider restricting your API key to specific domains in Google Cloud Console

## Troubleshooting

### Autocomplete not working
- Check that `REACT_APP_GOOGLE_MAPS_API_KEY` is set correctly
- Verify the Places API is enabled in Google Cloud Console
- Check browser console for error messages
- Restart the development server after adding the key

### API key errors
- Ensure your API key has Places API enabled
- Check that billing is enabled on your Google Cloud project (required even for free tier)
- Verify the API key restrictions allow your domain

### Suggestions not appearing
- Check browser console for JavaScript errors
- Verify network requests to `maps.googleapis.com` are not blocked
- Ensure the input field is properly rendered before the autocomplete initializes
