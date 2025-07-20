// Fetch all mark entry notifications (type = 'marks_entry') for admin view
export const fetchAllMarkEntryNotifications = async (idToken: string): Promise<any[]> => {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'notifications' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'type' },
          op: 'EQUAL',
          value: { stringValue: 'marks_entry' }
        }
      },
      orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }]
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    // Try to provide more debug info
    let errorText = '';
    try { errorText = await res.text(); } catch {}
    throw new Error(`Failed to fetch mark entry notifications.\nStatus: ${res.status}\n${errorText}`);
  }

  const data = await res.json();
  // Map Firestore REST API response to flat objects
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);
  return documents.map((doc: any) => {
    const fields = doc.fields || {};
    return {
      id: doc.name.split('/').pop(),
      studentName: fields.studentName?.stringValue || '',
      studentId: fields.studentId?.stringValue || '',
      province: fields.province?.stringValue || '',
      eventId: fields.eventId?.stringValue || '',
      eventName: fields.eventName?.stringValue || '',
      D: fields.D?.stringValue || '',
      finalMark: fields.finalMark?.stringValue || fields.finalMark?.doubleValue || fields.finalMark?.integerValue || '',
      timestamp: fields.timestamp?.timestampValue || '',
    };
  });
};

const FIREBASE_API_KEY = "AIzaSyB3i4auGweMNag_9BCjiTGWZeSLpykyRtY";
const FIREBASE_PROJECT_ID = "grademaster-93820";
// const API_URL = ""; // Removed as we're not using a custom Cloud Function API for edit requests in this "simple" approach



// Signup with email and password
export async function signUpWithEmail(email: string, password: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Signup failed");
  }
  return data;
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Login failed");
  }
  return data;
}

// Update Firebase Auth user profile (displayName and/or photoURL) using REST API
export async function updateAuthUserProfile(idToken: string, profileUpdates: { displayName?: string; photoUrl?: string }) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${FIREBASE_API_KEY}`;

  const payload: any = { idToken, returnSecureToken: false };
  if (profileUpdates.displayName !== undefined) { // Allow setting to empty string
    payload.displayName = profileUpdates.displayName;
  }
  if (profileUpdates.photoUrl !== undefined) { // Allow setting to empty string or null
    payload.photoUrl = profileUpdates.photoUrl;
  }

  if (profileUpdates.displayName === undefined && profileUpdates.photoUrl === undefined) {
    console.warn("updateAuthUserProfile called without displayName or photoUrl.");
    return;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
     const errorData = await res.json().catch(() => ({}));
     throw new Error(errorData.error?.message || "Failed to update Firebase Auth user profile");
  }
  return await res.json();
}

// Send verification email
export async function sendEmailVerification(idToken: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "VERIFY_EMAIL",
      idToken,
    }),
  });
   if (!res.ok) {
     const errorData = await res.json().catch(() => ({}));
     throw new Error(errorData.error?.message || "Failed to send verification email");
  }
  return await res.json();
}

// Check email verification status
export async function checkEmailVerificationStatus(idToken: string): Promise<boolean> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: idToken }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || "Failed to check email verification status.");
  }

  return data.users && data.users.length > 0 && data.users[0]?.emailVerified === true;
}

// Send password reset email
export async function sendPasswordReset(email: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestType: "PASSWORD_RESET",
      email,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Failed to send reset email");
  }
  return data;
}

// --- User Profile Functions (Firestore REST API) ---

// Define the UserProfile interface
export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl?: string;
  role?: string;
  phone?: string; // Added phone as it's in createUserDoc
  createdAt?: string; // Added createdAt
  // Add any other fields you store in the userProfiles document
}

// Get user role from Firestore using REST API
export async function getUserRole(uid: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/userProfiles/${uid}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
     if (res.status === 404) return null; // Document not found
     const errorData = await res.json().catch(() => ({}));
     throw new Error(errorData.error?.message || "Failed to fetch user role");
  }
  const data = await res.json();
  return data.fields?.role?.stringValue || null;
}

// Get user profile from Firestore
export async function getUserProfile(uid: string, idToken: string): Promise<UserProfile | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/userProfiles/${uid}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null; // User profile document doesn't exist
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to fetch user profile");
  }
  const data = await res.json();
  if (!data.fields) return null; // Document exists but has no fields (unlikely for profiles)

  return {
    firstName: data.fields?.firstName?.stringValue || "",
    lastName: data.fields?.lastName?.stringValue || "",
    email: data.fields?.email?.stringValue || "",
    profilePictureUrl: data.fields?.profilePictureUrl?.stringValue || undefined,
    role: data.fields?.role?.stringValue || undefined,
    phone: data.fields?.phone?.stringValue || undefined,
    createdAt: data.fields?.createdAt?.timestampValue || undefined,
  };
}

// Create user document in Firestore
export async function createUserDoc(
  uid: string,
  idToken: string,
  data: { role: string; firstName: string; lastName: string; phone: string; email?: string } // Made email optional
) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/userProfiles?documentId=${uid}`;
  
  const firestoreFields: any = {
    role: { stringValue: data.role },
    firstName: { stringValue: data.firstName },
    lastName: { stringValue: data.lastName },
    phone: { stringValue: data.phone },
    createdAt: { timestampValue: new Date().toISOString() },
  };

  if (data.email) { // Only add email if it's provided
    firestoreFields.email = { stringValue: data.email };
  }

  const body = { fields: firestoreFields };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to create user profile");
  }
  return await res.json();
}

// Update user's first and last name in their Firestore 'userProfiles' document using REST API
export async function updateUserName(uid: string, firstName: string, lastName: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/userProfiles/${uid}?updateMask.fieldPaths=firstName&updateMask.fieldPaths=lastName`;
  const body = {
    fields: {
      firstName: { stringValue: firstName },
      lastName: { stringValue: lastName },
    },
  };
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
     const errorData = await res.json().catch(() => ({}));
     throw new Error(errorData.error?.message || "Failed to update user name in Firestore");
  }
  return await res.json();
}

// Update user's profile picture URL in their Firestore 'userProfiles' document using REST API
export async function updateUserProfilePicture(uid: string, photoURL: string, idToken: string) {
   const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/userProfiles/${uid}?updateMask.fieldPaths=profilePictureUrl`;
   const body = {
     fields: {
       profilePictureUrl: { stringValue: photoURL },
     },
   };
   const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
     const errorData = await res.json().catch(() => ({}));
     throw new Error(errorData.error?.message || "Failed to update profile picture URL in Firestore");
  }
  return await res.json();
}

// --- Event Functions (Firestore REST API) ---

// Event data structure
export interface EventData {
  // batch: string; // Batch functionality removed from event data
  gender: string;
  eventName: string;
}

export interface EventDocument extends EventData {
  id: string;
  createdAt: string;
}

// Helper to parse Firestore document response for a list of documents
const parseFirestoreDocuments = (data: any): any[] => {
  if (!data || !data.documents) return [];
  return data.documents.map((doc: any) => {
    const fields: any = {};
    for (const key in doc.fields) {
      const value = doc.fields[key];
      if (value.stringValue !== undefined) fields[key] = value.stringValue;
      else if (value.integerValue !== undefined) fields[key] = parseInt(value.integerValue, 10);
      else if (value.doubleValue !== undefined) fields[key] = value.doubleValue;
      else if (value.booleanValue !== undefined) fields[key] = value.booleanValue;
      else if (value.timestampValue !== undefined) fields[key] = value.timestampValue;
      // Add other types as needed (arrayValue, mapValue, etc.)
    }
    return { id: doc.name.split('/').pop(), ...fields };
  });
};

// Fetch events from Firestore
export async function fetchEvents(idToken: string, batchFilter?: string, genderFilter?: string): Promise<EventDocument[]> {
  let url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/events`;
  let query: any = {
    structuredQuery: {
      from: [{ collectionId: 'events' }],
      // orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], // Order by creation date - REMOVED
    }
  };

  const filters: any[] = [];
  if (batchFilter) {
    filters.push({
      fieldFilter: { field: { fieldPath: 'batch' }, op: 'EQUAL', value: { stringValue: batchFilter } }
    });
  }
  if (genderFilter) {
    filters.push({
      fieldFilter: { field: { fieldPath: 'gender' }, op: 'EQUAL', value: { stringValue: genderFilter } }
    });
  }

  if (filters.length > 0) {
    if (filters.length === 1) {
      query.structuredQuery.where = filters[0];
    } else {
      query.structuredQuery.where = { compositeFilter: { op: 'AND', filters: filters } };
    }
  }

  const fetchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;

  const res = await fetch(fetchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("Firestore Query Error:", JSON.stringify(errorData, null, 2)); // Log the detailed error
    throw new Error(errorData.error?.message || "Failed to fetch events. Check console for details from Firestore.");
  }

  const data = await res.json();
  // The response for runQuery is an array, where each item might be a 'document' or 'readTime'
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);
  return parseFirestoreDocuments({ documents }) as EventDocument[];
}


// Add a new event to Firestore
export async function addEvent(eventData: EventData, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/events`;
  const body = {
    fields: {
      // batch: { stringValue: eventData.batch }, // Batch field removed
      gender: { stringValue: eventData.gender },
      eventName: { stringValue: eventData.eventName },
      createdAt: { timestampValue: new Date().toISOString() }, // Add creation timestamp
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to add event");
  }
  return await res.json();
}

// Update an existing event in Firestore
export async function updateEvent(eventId: string, eventData: EventData, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/events/${eventId}`;
  const body = {
    fields: {
      // batch: { stringValue: eventData.batch }, // Batch field removed
      gender: { stringValue: eventData.gender },
      eventName: { stringValue: eventData.eventName },
      // createdAt is typically not updated
    },
  };
  const res = await fetch(url, {
    method: "PATCH", // Use PATCH for partial update
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to update event");
  }
  return await res.json();
}

// Delete an event from Firestore
export async function deleteEvent(eventId: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/events/${eventId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to delete event");
  }
  // Successful DELETE returns an empty body with 200 status
  return true;
}


// --- Student Functions (Firestore REST API) ---

// Student data structure
export interface StudentDocument {
  id: string;
  fullName: string;
  indexNo: string;
  // batch: string; // Batch functionality removed
  gender: string;
  phone: string;
  province: string;
  image: string; // URL or path to image
  createdAt?: string;
  team?: 'A' | 'B' | null; // Added team field
}

// Fetch all students from Firestore
export async function fetchStudents(idToken: string): Promise<StudentDocument[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/students`;
   const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) return []; // Collection might not exist yet
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to fetch students");
  }

  const data = await res.json();
  return parseFirestoreDocuments(data) as StudentDocument[];
}

// Fetch students by criteria (gender, province, batch)
export async function fetchStudentsByCriteria(idToken: string, gender?: string, province?: string, batch?: string): Promise<StudentDocument[]> {
  let query: any = {
    structuredQuery: {
      from: [{ collectionId: 'students' }],
      // orderBy: [{ field: { fieldPath: 'fullName' }, direction: 'ASCENDING' }], // Order by name - REMOVED
    }
  };

  const filters: any[] = [];
  if (gender) {
    filters.push({
      fieldFilter: { field: { fieldPath: 'gender' }, op: 'EQUAL', value: { stringValue: gender } }
    });
  }
  if (province) {
    filters.push({
      fieldFilter: { field: { fieldPath: 'province' }, op: 'EQUAL', value: { stringValue: province } }
    });
  }
   if (batch) {
    filters.push({
      fieldFilter: { field: { fieldPath: 'batch' }, op: 'EQUAL', value: { stringValue: batch } }
    });
  }


  if (filters.length > 0) {
    if (filters.length === 1) {
      query.structuredQuery.where = filters[0];
    } else {
      query.structuredQuery.where = { compositeFilter: { op: 'AND', filters: filters } };
    }
  }

  const fetchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;

  const res = await fetch(fetchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to fetch students by criteria");
  }

  const data = await res.json();
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);
  return parseFirestoreDocuments({ documents }) as StudentDocument[];
}


// Fetch recent students (e.g., last 10 added)
export async function fetchRecentStudents(idToken: string): Promise<StudentDocument[]> {
   let query: any = {
    structuredQuery: {
      from: [{ collectionId: 'students' }],
      orderBy: [{ field: { fieldPath: 'fullName' }, direction: 'ASCENDING' }], // Order by full name alphabetically
      limit: 6, // Limit to 6 students
    }
  };

  const fetchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;

  const res = await fetch(fetchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to fetch recent students");
  }

  const data = await res.json();
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);
  return parseFirestoreDocuments({ documents }) as StudentDocument[];
}


// Add a new student to Firestore
export async function addStudent(studentData: Omit<StudentDocument, 'id' | 'createdAt'>, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/students`;
  const body = {
    fields: {
      fullName: { stringValue: studentData.fullName },
      indexNo: { stringValue: studentData.indexNo },
      // batch: { stringValue: studentData.batch }, // Batch functionality removed
      gender: { stringValue: studentData.gender },
      phone: { stringValue: studentData.phone },
      province: { stringValue: studentData.province },
      image: { stringValue: studentData.image || "" }, // Ensure image is saved as stringValue
      createdAt: { timestampValue: new Date().toISOString() }, // Add creation timestamp
      team: studentData.team ? { stringValue: studentData.team } : { nullValue: null }, // Save team, allow null
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to add student");
  }
  return await res.json();
}

// Update an existing student in Firestore
export async function updateStudent(studentId: string, studentData: Omit<StudentDocument, 'id' | 'createdAt'>, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/students/${studentId}`;
  const body = {
    fields: {
      fullName: { stringValue: studentData.fullName },
      indexNo: { stringValue: studentData.indexNo },
      // batch: { stringValue: studentData.batch }, // Batch functionality removed
      gender: { stringValue: studentData.gender },
      phone: { stringValue: studentData.phone },
      province: { stringValue: studentData.province },
      image: { stringValue: studentData.image || "" },
      team: studentData.team ? { stringValue: studentData.team } : { nullValue: null },
    },
  };
  const res = await fetch(url, {
    method: "PATCH", // Use PATCH for partial update
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to update student");
  }
  return await res.json();
}

// Delete a student from Firestore
export async function deleteStudent(studentId: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/students/${studentId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to delete student");
  }
  return true;
}

// Update a student's team in Firestore
export async function updateStudentTeam(studentId: string, team: 'A' | 'B' | null, idToken: string) {
  // Use updateMask to explicitly specify that ONLY the 'team' field should be updated
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/students/${studentId}?updateMask.fieldPaths=team`;
  const body = {
    fields: {
      team: team ? { stringValue: team } : { nullValue: null },
    },
  };
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to update student team");
  }
  return await res.json();
}


// --- Batch Functions (Firestore REST API) ---

// Fetch all batches from Firestore (as strings)
export async function fetchBatches(idToken: string): Promise<string[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'batches' }],
      orderBy: [{ field: { fieldPath: 'batch' }, direction: 'ASCENDING' }], // Order alphabetically
      select: { fields: [{ fieldPath: 'batch' }] } // Only select the 'batch' field
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to fetch batches");
  }

  const data = await res.json();
  // runQuery response format is different; extract field values
  const batches: string[] = [];
  data.forEach((item: any) => {
    if (item.document && item.document.fields?.batch?.stringValue) {
      batches.push(item.document.fields.batch.stringValue);
    }
  });
  return batches;
}

// Fetch all batches from Firestore (with IDs)
export async function fetchBatchesWithIds(idToken: string): Promise<{ id: string; batch: string }[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'batches' }],
      orderBy: [{ field: { fieldPath: 'batch' }, direction: 'ASCENDING' }], // Order alphabetically
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to fetch batches with IDs");
  }

  const data = await res.json();
  const batchesWithIds: { id: string; batch: string }[] = [];
   data.forEach((item: any) => {
    if (item.document && item.document.fields?.batch?.stringValue) {
       batchesWithIds.push({
         id: item.document.name.split('/').pop(),
         batch: item.document.fields.batch.stringValue
       });
    }
  });
  return batchesWithIds;
}


// Add a new batch to Firestore
export async function addBatch(batchData: { batch: string }, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/batches`;
  const body = {
    fields: {
      batch: { stringValue: batchData.batch },
      createdAt: { timestampValue: new Date().toISOString() }, // Add creation timestamp
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to add batch");
  }
  return await res.json();
}

// Update an existing batch in Firestore
export async function updateBatch(batchId: string, batchValue: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/batches/${batchId}`;
  const body = {
    fields: {
      batch: { stringValue: batchValue },
    },
  };
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to update batch");
  }
  return await res.json();
}

// Delete a batch from Firestore
export async function deleteBatch(batchId: string, idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/batches/${batchId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to delete batch");
  }
  return true;
}


// --- Marks Functions (Firestore REST API) ---

// Marks data structure
// Updated to include supervisor fields for each mark
export interface MarksEntryData {
  D?: string;
  D_sup?: string;
  E1?: string;
  E1_sup?: string;
  E2?: string;
  E2_sup?: string;
  E3?: string;
  E3_sup?: string;
  E4?: string;
  E4_sup?: string;
  P?: string;
  P_sup?: string;
}

export interface StudentMarksPayload {
  studentId: string;
  eventId: string;
  supervisorId: string;
  rounds: {
    round1: MarksEntryData; // Now includes _sup fields
    round2?: MarksEntryData; // Now includes _sup fields
  };
  performance: string; // e.g., "performance 1", "performance 2"
  timestamp: string; // ISO string
}

// Interface for the fetched marks document, including its ID
// Updated to reflect the new MarksEntryData structure
export interface FetchedStudentMarks extends StudentMarksPayload {
  markId: string; // The Firestore document ID of the marks entry
}

// Helper to convert MarksEntryData to Firestore fields format
const marksEntryToFirestoreFields = (marks: MarksEntryData) => {
  const fields: any = {};
  // Iterate over all possible mark and supervisor fields
  const markFields: Array<keyof MarksEntryData> = ['D', 'D_sup', 'E1', 'E1_sup', 'E2', 'E2_sup', 'E3', 'E3_sup', 'E4', 'E4_sup', 'P', 'P_sup'];
  markFields.forEach(field => {
    const value = marks[field];
    if (value !== undefined) {
      fields[field] = { stringValue: value };
    }
  });
  return fields;
};

// Helper to convert Firestore fields format to MarksEntryData
const firestoreFieldsToMarksEntry = (fields: any): MarksEntryData => {
  const marks: MarksEntryData = {};
  // Iterate over all possible mark and supervisor fields
  const markFields: Array<keyof MarksEntryData> = ['D', 'D_sup', 'E1', 'E1_sup', 'E2', 'E2_sup', 'E3', 'E3_sup', 'E4', 'E4_sup', 'P', 'P_sup'];
  markFields.forEach(field => {
    if (fields?.[field]?.stringValue !== undefined) {
      marks[field] = fields[field].stringValue;
    }
  });
  return marks;
};


// Save student marks (add or update)
// This function assumes you are either creating a new marks document
// or updating an existing one based on studentId, eventId, and supervisorId.
// A more robust approach might involve querying first to see if a document exists.
// For simplicity here, we'll assume a new document is created each time,
// or you handle updates by providing a document ID if it exists.
// Let's adjust this to find and update if exists, otherwise create.

export async function saveOrUpdateStudentMarks(marksPayload: StudentMarksPayload, idToken: string, markId?: string) {
  if (markId) {
    // Update existing marks document
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/student_marks/${markId}`;
     const body = {
      fields: {
        studentId: { stringValue: marksPayload.studentId },
        eventId: { stringValue: marksPayload.eventId },
        supervisorId: { stringValue: marksPayload.supervisorId },
        rounds: {
          mapValue: {
            fields: {
              round1: { mapValue: { fields: marksEntryToFirestoreFields(marksPayload.rounds.round1) } },
              ...(marksPayload.rounds.round2 && { round2: { mapValue: { fields: marksEntryToFirestoreFields(marksPayload.rounds.round2) } } }),
            }
          }
        },
        performance: { stringValue: marksPayload.performance },
        timestamp: { timestampValue: marksPayload.timestamp },
      },
    };
     const res = await fetch(url, {
      method: "PATCH", // Use PATCH for update
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
     if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Failed to update student marks");
    }
    return await res.json();

  } else {
    // Create new marks document
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/student_marks`;
    const body = {
      fields: {
        studentId: { stringValue: marksPayload.studentId },
        eventId: { stringValue: marksPayload.eventId },
        supervisorId: { stringValue: marksPayload.supervisorId },
        rounds: {
          mapValue: {
            fields: {
              round1: { mapValue: { fields: marksEntryToFirestoreFields(marksPayload.rounds.round1) } },
              ...(marksPayload.rounds.round2 && { round2: { mapValue: { fields: marksEntryToFirestoreFields(marksPayload.rounds.round2) } } }),
            }
          }
        },
        performance: { stringValue: marksPayload.performance },
        timestamp: { timestampValue: marksPayload.timestamp },
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Failed to save student marks");
    }
    return await res.json();
  }
}

// --- Wrapper Functions for Save and Update ---

/**
 * Saves new student marks to Firestore.
 * This is a wrapper around saveOrUpdateStudentMarks for clarity and screen component compatibility.
 */
export async function saveStudentMarks(payload: StudentMarksPayload, idToken: string): Promise<{ markId: string }> {
  // Call the existing saveOrUpdateStudentMarks function without providing a markId
  const response = await saveOrUpdateStudentMarks(payload, idToken, undefined);

  // The POST response for creating a document includes the document's full name.
  // We need to extract the document ID from this name.
  // Example name: projects/YOUR_PROJECT_ID/databases/(default)/documents/student_marks/DOCUMENT_ID
  const nameParts = response.name.split('/');
  const markId = nameParts[nameParts.length - 1];

  return { markId }; // Return the ID of the newly created document
}

/**
 * Updates existing student marks in Firestore.
 * This is a wrapper around saveOrUpdateStudentMarks for clarity and screen component compatibility.
 */
export async function updateStudentMarks(markId: string, payload: StudentMarksPayload, idToken: string): Promise<void> {
  // Call the existing saveOrUpdateStudentMarks function with the provided markId
  await saveOrUpdateStudentMarks(payload, idToken, markId);
  // The update operation doesn't typically return the document body on success with PATCH,
  // and the screen components don't seem to expect a return value other than successful completion.
}


// Fetch student marks for a specific student and event
export async function fetchStudentMarksForEvent(studentId: string, eventId: string, idToken: string): Promise<FetchedStudentMarks | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'student_marks' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'studentId' }, op: 'EQUAL', value: { stringValue: studentId } } },
            { fieldFilter: { field: { fieldPath: 'eventId' }, op: 'EQUAL', value: { stringValue: eventId } } },
          ]
        }
      },
      limit: 1, // Assuming only one marks document per student/event
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to fetch student marks for event");
  }

  const data = await res.json();
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);

  if (documents.length === 0) {
    return null; // No marks found
  }

  const doc = documents[0]; // Get the first (and should be only) document
  const fields = doc.fields;

  return {
    markId: doc.name.split('/').pop(),
    studentId: fields?.studentId?.stringValue || '',
    eventId: fields?.eventId?.stringValue || '',
    supervisorId: fields?.supervisorId?.stringValue || '',
    rounds: {
      round1: firestoreFieldsToMarksEntry(fields?.rounds?.mapValue?.fields?.round1?.mapValue?.fields),
      round2: firestoreFieldsToMarksEntry(fields?.rounds?.mapValue?.fields?.round2?.mapValue?.fields),
    },
    performance: fields?.performance?.stringValue || '',
    timestamp: fields?.timestamp?.timestampValue || '',
  };
}

// --- Edit Request Functions (Firestore REST API via Custom Backend) ---

// Define the EditRequest interface
export interface EditRequest {
  id?: string; // The Firestore document ID (name)
  studentId: string;
  studentName: string;
  eventId: string;
  eventName: string;
  markId: string; // The ID of the marks document being requested to edit
  supervisorId: string;
  supervisorName: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: { timestampValue: string }; // Firestore timestamp format
  updatedAt?: { timestampValue: string }; // Firestore timestamp format
}

// Helper to convert Firestore fields to EditRequest interface
const firestoreFieldsToEditRequest = (doc: any): EditRequest => {
  const fields = doc.fields;
  return {
    id: doc.name.split('/').pop(),
    studentId: fields?.studentId?.stringValue || '',
    studentName: fields?.studentName?.stringValue || '',
    eventId: fields?.eventId?.stringValue || '',
    eventName: fields?.eventName?.stringValue || '',
    markId: fields?.markId?.stringValue || '',
    supervisorId: fields?.supervisorId?.stringValue || '',
    supervisorName: fields?.supervisorName?.stringValue || '',
    status: fields?.status?.stringValue as 'pending' | 'approved' | 'rejected' | 'completed' || 'pending',
    createdAt: { timestampValue: fields?.createdAt?.timestampValue || new Date().toISOString() },
    updatedAt: fields?.updatedAt?.timestampValue ? { timestampValue: fields.updatedAt.timestampValue } : undefined,
  };
};

// Create an Edit Request (Supervisor)
export const createEditRequest = async (requestData: Omit<EditRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>, idToken: string): Promise<void> => {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/editRequests`;
  const payload = {
    fields: {
      studentId: { stringValue: requestData.studentId },
      studentName: { stringValue: requestData.studentName },
      eventId: { stringValue: requestData.eventId },
      eventName: { stringValue: requestData.eventName },
      markId: { stringValue: requestData.markId },
      supervisorId: { stringValue: requestData.supervisorId },
      supervisorName: { stringValue: requestData.supervisorName },
      status: { stringValue: 'pending' },
      createdAt: { timestampValue: new Date().toISOString() },
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
    throw new Error(errorData.error?.message || 'Failed to create edit request.');
  }
};

// Fetch Pending Edit Requests (Admin)
export const fetchPendingEditRequests = async (idToken: string): Promise<EditRequest[]> => {
// This uses a structured query to filter by status
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'editRequests' }],
      where: {
        fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } }
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Failed to fetch pending requests.');
  }

  const data = await res.json();
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);
  return documents.map(firestoreFieldsToEditRequest);
};

// Fetch All Edit Requests for Admin view (pending, approved, rejected)
export const fetchAllAdminRequests = async (idToken: string): Promise<EditRequest[]> => {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'editRequests' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'IN',
          value: {
            arrayValue: {
              values: [
                { stringValue: 'pending' },
                { stringValue: 'approved' },
                { stringValue: 'rejected' },
              ]
            }
          }
        }
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }]
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Failed to fetch admin requests. A Firestore index might be required.');
  }

  const data = await res.json();
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);
  return documents.map(firestoreFieldsToEditRequest);
};

// Fetch Pending Edit Requests Count (Admin)
export const fetchPendingEditRequestsCount = async (idToken: string): Promise<number> => {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'editRequests' }],
      where: {
        fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } }
      },
      // We don't need orderBy or limit if we just want the count of all matching documents
      // However, Firestore's runQuery returns documents, so we'll count them.
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Failed to fetch pending requests count.');
  }

  const data = await res.json();
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);
  return documents.length;
};
// Update Edit Request Status (Admin)
export const updateEditRequestStatus = async (requestId: string, status: 'approved' | 'rejected' | 'completed', idToken: string): Promise<void> => {
// This uses a PATCH request to update a specific document
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/editRequests/${requestId}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`;
  const payload = {
    fields: {
      status: { stringValue: status },
      updatedAt: { timestampValue: new Date().toISOString() },
    }
  };

  const response = await fetch(url, {
    method: 'PATCH', // Use PATCH for partial updates
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to update request status.');
  }
};

// Fetch Edit Request for a specific Mark ID (Supervisor)
export const fetchEditRequestForMark = async (markId: string, idToken: string): Promise<EditRequest | null> => {
// This uses a structured query to find requests by markId
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'editRequests' }],
      where: {
        fieldFilter: { field: { fieldPath: 'markId' }, op: 'EQUAL', value: { stringValue: markId } }
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], // Get the most recent
      limit: 1 // Only need the latest one
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error?.message || 'Failed to fetch edit request for the mark.');
  }

  const data = await res.json();
  const documents = data.filter((item: any) => item.document).map((item: any) => item.document);

  if (documents.length === 0) {
    return null; // No request found
  }
  return firestoreFieldsToEditRequest(documents[0]);
};

// Create a Mark Entry Notification (REST API, like createEditRequest)
// Usage: await createMarkEntryNotification(notificationData, idToken)
// notificationData: { studentId, studentName, eventId, eventName, province, D, finalMark }

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
  const message = `Marks entered: ${notificationData.studentName} (ID: ${notificationData.studentId}, Province: ${notificationData.province}), Event: ${notificationData.eventName}, D: ${notificationData.D}, Final Mark: ${notificationData.finalMark}`;
  const payload = {
    fields: {
      studentId: { stringValue: notificationData.studentId },
      studentName: { stringValue: notificationData.studentName },
      eventId: { stringValue: notificationData.eventId },
      eventName: { stringValue: notificationData.eventName },
      province: { stringValue: notificationData.province },
      D: { stringValue: String(notificationData.D) },
      finalMark: { stringValue: String(notificationData.finalMark) },
      message: { stringValue: message },
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