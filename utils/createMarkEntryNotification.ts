// Create a Mark Entry Notification (REST API, like createEditRequest)
// Usage: await createMarkEntryNotification(notificationData, idToken)
// notificationData: { studentId, studentName, eventId, eventName, province, D, finalMark }

const FIREBASE_PROJECT_ID = "grademaster-93820"; // Use your actual project ID

export const createMarkEntryNotification = async (
  notificationData: {
    studentId: string;
    studentName: string;
    eventId: string;
    eventName: string;
    province: string;
    D: string | number;
    finalMark: string | number;
  },
  idToken: string
): Promise<void> => {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/notifications`;
  const payload = {
    fields: {
      studentId: { stringValue: notificationData.studentId },
      studentName: { stringValue: notificationData.studentName },
      eventId: { stringValue: notificationData.eventId },
      eventName: { stringValue: notificationData.eventName },
      province: { stringValue: notificationData.province },
      D: { stringValue: String(notificationData.D) },
      finalMark: { stringValue: String(notificationData.finalMark) },
      type: { stringValue: 'marks_entry' },
      timestamp: { timestampValue: new Date().toISOString() },
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to create mark entry notification.');
  }
};
