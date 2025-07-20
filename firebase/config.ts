import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyB3i4auGweMNag_9BCjiTGWZeSLpykyRtY",
  authDomain: "grademaster-93820.firebaseapp.com",
  projectId: "grademaster-93820",
  storageBucket: "grademaster-93820.appspot.com",
  // Add other config properties if needed, but NOT auth-specific ones that require the SDK
};

const app = initializeApp(firebaseConfig);

// Do NOT initialize or export getAuth() here if you are using REST API for auth

// You can export the initialized app if needed for other SDKs (like Firestore SDK if you use it)
// export default app;