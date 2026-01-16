# Azure Face API Time Clock Setup Guide

This guide will help you set up the Azure Face API facial recognition time clock system for your POS software.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Azure Face API Setup](#azure-face-api-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Migration](#database-migration)
5. [Employee Enrollment](#employee-enrollment)
6. [Using the Time Clock](#using-the-time-clock)
7. [Admin Dashboard](#admin-dashboard)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Python 3.6 or higher
- Active internet connection
- Webcam/camera for face capture
- Microsoft Azure account (free tier available)

## Azure Face API Setup

### Step 1: Create Azure Account

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign up for a free account if you don't have one
3. Azure provides $200 free credit for new accounts

### Step 2: Create Face API Resource

1. In Azure Portal, click "Create a resource"
2. Search for "Face"
3. Select "Face" from the results
4. Click "Create"
5. Fill in the form:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or use existing
   - **Region**: Choose closest region (e.g., `eastus`, `westus2`)
   - **Name**: Choose a name (e.g., `pos-face-api`)
   - **Pricing Tier**: Select "Free F0" (30,000 transactions/month)
6. Click "Review + create", then "Create"

### Step 3: Get API Credentials

1. After the resource is created, go to the resource
2. Click on "Keys and Endpoint" in the left menu
3. Copy:
   - **KEY 1** (or KEY 2) - This is your subscription key
   - **Endpoint** - This is your API endpoint URL

**Important**: Keep these credentials secure and never commit them to version control!

## Environment Configuration

### Option 1: Environment Variables (Recommended)

Create a `.env` file in the project root (or add to existing `.env`):

```bash
AZURE_FACE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
AZURE_FACE_SUBSCRIPTION_KEY=your-subscription-key-here
AZURE_FACE_PERSON_GROUP_ID=pos_employees
```

### Option 2: System Environment Variables

**Linux/Mac:**
```bash
export AZURE_FACE_ENDPOINT="https://your-resource-name.cognitiveservices.azure.com/"
export AZURE_FACE_SUBSCRIPTION_KEY="your-subscription-key-here"
export AZURE_FACE_PERSON_GROUP_ID="pos_employees"
```

**Windows (PowerShell):**
```powershell
$env:AZURE_FACE_ENDPOINT="https://your-resource-name.cognitiveservices.azure.com/"
$env:AZURE_FACE_SUBSCRIPTION_KEY="your-subscription-key-here"
$env:AZURE_FACE_PERSON_GROUP_ID="pos_employees"
```

**Windows (Command Prompt):**
```cmd
set AZURE_FACE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
set AZURE_FACE_SUBSCRIPTION_KEY=your-subscription-key-here
set AZURE_FACE_PERSON_GROUP_ID=pos_employees
```

### Option 3: Modify azure_face_service.py (Not Recommended)

You can hardcode values in `azure_face_service.py`, but this is not recommended for security reasons.

## Database Migration

Run the migration script to create the necessary database tables:

```bash
python3 migrate_azure_face_api.py
```

This will create:
- `employee_azure_faces` - Stores Azure person IDs for enrolled employees
- `face_enrollment_log` - Logs enrollment attempts
- `face_recognition_log` - Logs recognition attempts

## Employee Enrollment

### For Employees (Self-Enrollment)

1. Log in to the POS system
2. Go to Profile page
3. Click "Enroll Face" button
4. Allow camera access when prompted
5. Position face in the center of the frame
6. Click "Capture Face" button
7. Wait for enrollment confirmation

**Tips for best results:**
- Use good lighting
- Face the camera directly
- Remove glasses if possible (or ensure no glare)
- Keep a neutral expression
- Ensure face is clearly visible

### For Admins (Enroll Employees)

1. Go to Employee Management
2. Select an employee
3. Click "Enroll Face" or "Manage Face Enrollment"
4. Follow the same enrollment process

## Using the Time Clock

### Face Recognition Clock In/Out

1. Go to Profile page
2. Click "Clock In" or "Clock Out" button
3. Select "Use Face Recognition"
4. Position face in camera frame
5. Click "Recognize Face"
6. System will identify you and clock you in/out

### PIN Code Fallback

If face recognition fails:

1. Click "Use PIN Code" option
2. Enter your PIN code
3. Click "Clock In" or "Clock Out"

**Note**: PIN codes must be set up in employee management. Contact your administrator.

## Admin Dashboard

### View Enrolled Employees

1. Go to Settings or Employee Management
2. Navigate to "Face Recognition" tab
3. View list of all enrolled employees
4. See enrollment date and status

### View Recognition Statistics

1. Go to Face Recognition dashboard
2. View:
   - Total recognition attempts
   - Success rate
   - Average confidence
   - Failed attempts breakdown

### Delete Face Enrollment

1. Go to employee's profile
2. Click "Delete Face Enrollment"
3. Confirm deletion
4. Employee will need to re-enroll

## Troubleshooting

### "Azure Face API not configured" Error

**Solution**: Ensure environment variables are set correctly:
```bash
# Check if variables are set
echo $AZURE_FACE_ENDPOINT
echo $AZURE_FACE_SUBSCRIPTION_KEY
```

### "Camera permission denied" Error

**Solution**: 
- Check browser camera permissions
- Allow camera access in browser settings
- Try a different browser
- Ensure no other application is using the camera

### "Face not recognized" Error

**Possible causes:**
- Poor lighting
- Face not clearly visible
- Employee not enrolled
- Confidence threshold too high

**Solutions:**
- Improve lighting
- Ensure face is centered and clearly visible
- Re-enroll employee with better quality image
- Lower confidence threshold (admin setting)

### "Liveness check failed" Error

**Possible causes:**
- Photo of a photo (spoofing attempt)
- Poor image quality
- Blurry image

**Solutions:**
- Use live camera feed (not uploaded photo)
- Improve image quality
- Ensure good lighting

### High API Costs

**Solution**: 
- Use Free tier (F0) - 30,000 transactions/month
- Monitor usage in Azure Portal
- Set up usage alerts
- Consider caching recognition results

### Training Status Issues

**Solution**:
- Person group training happens automatically after enrollment
- Training can take a few seconds to minutes
- Check training status in admin dashboard
- Re-train if needed (admin function)

## Security Best Practices

1. **Never commit credentials**: Keep API keys in environment variables only
2. **Use HTTPS**: Always use HTTPS in production
3. **Rate limiting**: Implement rate limiting to prevent abuse
4. **Monitor usage**: Regularly check Azure Portal for unusual activity
5. **PIN code security**: Ensure PIN codes are strong and not shared
6. **Access control**: Limit admin access to face recognition settings

## Cost Considerations

### Free Tier (F0)
- **30,000 transactions/month** free
- Suitable for small businesses (< 50 employees)
- Perfect for testing and development

### Standard Tier (S0)
- Pay per transaction after free tier
- Pricing varies by region
- Check Azure pricing page for current rates

### Cost Optimization Tips
1. Use free tier for development
2. Monitor usage regularly
3. Implement caching for repeated recognitions
4. Use PIN code fallback to reduce API calls
5. Batch enrollments during off-peak hours

## Support and Resources

- **Azure Face API Documentation**: https://docs.microsoft.com/azure/cognitive-services/face/
- **API Reference**: https://westus.dev.cognitive.microsoft.com/docs/services/563879b61984550e40cbbe8d/operations/563879b61984550f30395236
- **Pricing**: https://azure.microsoft.com/pricing/details/cognitive-services/face-api/

## Next Steps

1. Complete Azure Face API setup
2. Run database migration
3. Configure environment variables
4. Enroll test employee
5. Test clock in/out functionality
6. Enroll all employees
7. Train staff on using the system

## FAQ

**Q: Can I use this without Azure Face API?**
A: No, this system requires Azure Face API. However, you can use PIN code fallback for clock in/out.

**Q: Is my face data stored locally?**
A: No, face data is stored in Azure. Only Azure person IDs are stored locally in the database.

**Q: Can I use this offline?**
A: No, Azure Face API requires internet connection. Use PIN code fallback for offline scenarios.

**Q: How accurate is the recognition?**
A: Azure Face API has high accuracy (typically >95% with good conditions). Confidence threshold can be adjusted.

**Q: Can I enroll multiple faces for one employee?**
A: Yes, you can add multiple face images to improve recognition accuracy. This is done automatically during enrollment.

**Q: What happens if I delete an employee?**
A: The face enrollment is automatically deleted when an employee is removed from the system.
