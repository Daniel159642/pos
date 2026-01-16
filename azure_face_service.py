"""
Azure Face API Service for Employee Time Clock
Handles face enrollment, recognition, and liveness detection
"""

import os
import base64
import requests
import json
from typing import Dict, Optional, List, Tuple
from io import BytesIO
from PIL import Image

class AzureFaceService:
    """Service for interacting with Microsoft Azure Face API"""
    
    def __init__(self):
        self.endpoint = os.getenv('AZURE_FACE_ENDPOINT', '')
        self.subscription_key = os.getenv('AZURE_FACE_SUBSCRIPTION_KEY', '')
        self.person_group_id = os.getenv('AZURE_FACE_PERSON_GROUP_ID', 'pos_employees')
        self.detection_model = 'detection_03'  # Latest detection model
        self.recognition_model = 'recognition_04'  # Latest recognition model
        
        if not self.endpoint or not self.subscription_key:
            raise ValueError(
                "Azure Face API credentials not configured. "
                "Please set AZURE_FACE_ENDPOINT and AZURE_FACE_SUBSCRIPTION_KEY environment variables."
            )
        
        # Ensure person group exists
        self._ensure_person_group()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with subscription key"""
        return {
            'Ocp-Apim-Subscription-Key': self.subscription_key,
            'Content-Type': 'application/octet-stream'
        }
    
    def _get_json_headers(self) -> Dict[str, str]:
        """Get request headers for JSON content"""
        return {
            'Ocp-Apim-Subscription-Key': self.subscription_key,
            'Content-Type': 'application/json'
        }
    
    def _ensure_person_group(self) -> None:
        """Create person group if it doesn't exist"""
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}"
        headers = self._get_json_headers()
        
        try:
            # Try to get person group
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                return  # Person group exists
        except:
            pass
        
        # Create person group if it doesn't exist
        try:
            data = {
                "name": "POS Employees",
                "recognitionModel": self.recognition_model
            }
            response = requests.put(url, headers=headers, json=data)
            if response.status_code not in [200, 201]:
                if response.status_code != 409:  # Already exists
                    print(f"Warning: Could not create person group: {response.text}")
        except Exception as e:
            print(f"Warning: Error ensuring person group exists: {e}")
    
    def _prepare_image(self, image_data: bytes) -> bytes:
        """Prepare image for Azure Face API (convert to JPEG if needed)"""
        try:
            img = Image.open(BytesIO(image_data))
            # Convert to RGB if necessary
            if img.mode != 'RGB':
                img = img.convert('RGB')
            # Resize if too large (Azure has size limits)
            max_size = 4096
            if img.width > max_size or img.height > max_size:
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            # Convert to bytes
            output = BytesIO()
            img.save(output, format='JPEG', quality=95)
            return output.getvalue()
        except Exception as e:
            raise ValueError(f"Error preparing image: {str(e)}")
    
    def detect_face(self, image_data: bytes) -> Optional[Dict]:
        """
        Detect face in image and return face ID
        Returns face_id if detected, None otherwise
        """
        url = f"{self.endpoint}/face/v1.0/detect"
        headers = self._get_headers()
        params = {
            'detectionModel': self.detection_model,
            'recognitionModel': self.recognition_model,
            'returnFaceId': 'true',
            'returnFaceLandmarks': 'false',
            'returnFaceAttributes': 'age,gender,headPose,smile,facialHair,glasses,emotion,hair,makeup,occlusion,accessories,blur,exposure,noise'
        }
        
        try:
            prepared_image = self._prepare_image(image_data)
            response = requests.post(url, headers=headers, data=prepared_image, params=params)
            response.raise_for_status()
            
            faces = response.json()
            if faces and len(faces) > 0:
                return faces[0]  # Return first face detected
            return None
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error detecting face: {str(e)}")
    
    def create_person(self, employee_id: int, employee_name: str) -> str:
        """
        Create a person in the person group
        Returns person_id
        """
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}/persons"
        headers = self._get_json_headers()
        data = {
            "name": f"{employee_name} (ID: {employee_id})",
            "userData": json.dumps({"employee_id": employee_id})
        }
        
        try:
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            result = response.json()
            return result['personId']
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error creating person: {str(e)}")
    
    def add_face_to_person(self, person_id: str, image_data: bytes) -> str:
        """
        Add a face to a person (for enrollment)
        Returns persisted_face_id
        """
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}/persons/{person_id}/persistedFaces"
        headers = self._get_headers()
        params = {
            'detectionModel': self.detection_model
        }
        
        try:
            prepared_image = self._prepare_image(image_data)
            response = requests.post(url, headers=headers, data=prepared_image, params=params)
            response.raise_for_status()
            result = response.json()
            return result['persistedFaceId']
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error adding face to person: {str(e)}")
    
    def train_person_group(self) -> None:
        """Train the person group after adding faces"""
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}/train"
        headers = self._get_json_headers()
        
        try:
            response = requests.post(url, headers=headers)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error training person group: {str(e)}")
    
    def get_training_status(self) -> Dict:
        """Get training status of person group"""
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}/training"
        headers = self._get_json_headers()
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error getting training status: {str(e)}")
    
    def identify_face(self, face_id: str, max_candidates: int = 1, confidence_threshold: float = 0.5) -> Optional[Dict]:
        """
        Identify a face against the person group
        Returns person_id and confidence if match found
        """
        url = f"{self.endpoint}/face/v1.0/identify"
        headers = self._get_json_headers()
        data = {
            "faceIds": [face_id],
            "personGroupId": self.person_group_id,
            "maxNumOfCandidatesReturned": max_candidates,
            "confidenceThreshold": confidence_threshold
        }
        
        try:
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            results = response.json()
            
            if results and len(results) > 0:
                result = results[0]
                if result.get('candidates') and len(result['candidates']) > 0:
                    candidate = result['candidates'][0]
                    return {
                        'person_id': candidate['personId'],
                        'confidence': candidate['confidence']
                    }
            return None
        except requests.exceptions.RequestException as e:
            raise Exception(f"Error identifying face: {str(e)}")
    
    def get_person(self, person_id: str) -> Optional[Dict]:
        """Get person details by person_id"""
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}/persons/{person_id}"
        headers = self._get_json_headers()
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if response.status_code == 404:
                return None
            raise Exception(f"Error getting person: {str(e)}")
    
    def delete_person(self, person_id: str) -> None:
        """Delete a person from the person group"""
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}/persons/{person_id}"
        headers = self._get_json_headers()
        
        try:
            response = requests.delete(url, headers=headers)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            if response.status_code != 404:  # Ignore if already deleted
                raise Exception(f"Error deleting person: {str(e)}")
    
    def delete_persisted_face(self, person_id: str, persisted_face_id: str) -> None:
        """Delete a specific face from a person"""
        url = f"{self.endpoint}/face/v1.0/persongroups/{self.person_group_id}/persons/{person_id}/persistedFaces/{persisted_face_id}"
        headers = self._get_json_headers()
        
        try:
            response = requests.delete(url, headers=headers)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            if response.status_code != 404:
                raise Exception(f"Error deleting persisted face: {str(e)}")
    
    def verify_liveness(self, image_data: bytes) -> Dict:
        """
        Perform liveness detection to prevent photo spoofing
        This is a simplified check - Azure Face API doesn't have built-in liveness detection
        in the free tier, so we implement basic checks
        """
        # Basic liveness checks:
        # 1. Check for face detection
        # 2. Check face attributes for signs of liveness (blur, exposure, etc.)
        
        face = self.detect_face(image_data)
        if not face:
            return {
                'is_live': False,
                'reason': 'No face detected'
            }
        
        attributes = face.get('faceAttributes', {})
        blur = attributes.get('blur', {})
        exposure = attributes.get('exposure', {})
        noise = attributes.get('noise', {})
        
        # Check if image quality suggests it's a photo of a photo
        blur_level = blur.get('blurLevel', 'low')
        exposure_level = exposure.get('exposureLevel', 'goodExposure')
        noise_level = noise.get('noiseLevel', 'low')
        
        is_live = True
        reasons = []
        
        if blur_level == 'high':
            is_live = False
            reasons.append('Image is too blurry')
        
        if exposure_level == 'overExposure' or exposure_level == 'underExposure':
            is_live = False
            reasons.append(f'Poor exposure: {exposure_level}')
        
        if noise_level == 'high':
            is_live = False
            reasons.append('Image has too much noise')
        
        return {
            'is_live': is_live,
            'reason': ', '.join(reasons) if reasons else 'Face appears live',
            'attributes': {
                'blur': blur_level,
                'exposure': exposure_level,
                'noise': noise_level
            }
        }
    
    def enroll_employee(self, employee_id: int, employee_name: str, image_data: bytes) -> Dict:
        """
        Complete enrollment process: create person, add face, and train
        Returns enrollment result with person_id and persisted_face_id
        """
        # Detect face first
        face = self.detect_face(image_data)
        if not face:
            raise ValueError("No face detected in image")
        
        # Create person
        person_id = self.create_person(employee_id, employee_name)
        
        # Add face to person
        persisted_face_id = self.add_face_to_person(person_id, image_data)
        
        # Train person group (async, but we trigger it)
        try:
            self.train_person_group()
        except:
            pass  # Training is async, continue
        
        return {
            'person_id': person_id,
            'persisted_face_id': persisted_face_id,
            'face_id': face['faceId']
        }
    
    def recognize_employee(self, image_data: bytes, confidence_threshold: float = 0.5) -> Optional[Dict]:
        """
        Recognize employee from image
        Returns employee_id and confidence if match found
        """
        # Detect face
        face = self.detect_face(image_data)
        if not face:
            return None
        
        # Identify face
        identification = self.identify_face(face['faceId'], confidence_threshold=confidence_threshold)
        if not identification:
            return None
        
        # Get person details to extract employee_id
        person = self.get_person(identification['person_id'])
        if not person:
            return None
        
        # Extract employee_id from userData
        user_data = person.get('userData', '{}')
        try:
            user_data_dict = json.loads(user_data)
            employee_id = user_data_dict.get('employee_id')
        except:
            return None
        
        return {
            'employee_id': employee_id,
            'confidence': identification['confidence'],
            'person_id': identification['person_id']
        }
