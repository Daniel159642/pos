from notification_service import send_register_notification
res = send_register_notification(1, 4, "Test User", "test@example.com", "open", 100.0, "Test notes")
print("Response:", res)
