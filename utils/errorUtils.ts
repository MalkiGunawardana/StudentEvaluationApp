// Firebase Error Codes Constants
export const FIREBASE_ERRORS = {
  EMAIL_NOT_FOUND: "EMAIL_NOT_FOUND",
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_LOGIN_CREDENTIALS: "INVALID_LOGIN_CREDENTIALS",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  TOO_MANY_ATTEMPTS_TRY_LATER: "TOO_MANY_ATTEMPTS_TRY_LATER",
  EMAIL_EXISTS: "EMAIL_EXISTS",
  WEAK_PASSWORD: "WEAK_PASSWORD",
  NETWORK_REQUEST_FAILED: "NETWORK_REQUEST_FAILED",
  // Add other Firebase error codes as needed
};

export const getFriendlyErrorMessage = (errorCode: string): string => {
  if (typeof errorCode !== 'string') {
    return "An unexpected error occurred. Please try again.";
  }
  if (errorCode.includes(FIREBASE_ERRORS.NETWORK_REQUEST_FAILED)) {
    return "Network error. Please check your connection and try again.";
  }
  if (errorCode.includes(FIREBASE_ERRORS.INVALID_LOGIN_CREDENTIALS) || errorCode.includes(FIREBASE_ERRORS.INVALID_PASSWORD)) {
    return "Incorrect email or password.";
  }
  if (errorCode.includes(FIREBASE_ERRORS.EMAIL_NOT_FOUND)) {
    return "No account found with this email.";
  }
  if (errorCode.includes(FIREBASE_ERRORS.INVALID_EMAIL)) {
    return "The email address is invalid.";
  }
  if (errorCode.includes(FIREBASE_ERRORS.TOO_MANY_ATTEMPTS_TRY_LATER)) {
    return "Too many attempts. Please try again later.";
  }
  if (errorCode.includes(FIREBASE_ERRORS.EMAIL_EXISTS)) {
    return "This email is already registered. Please use another email or log in.";
  }
  if (errorCode.includes(FIREBASE_ERRORS.WEAK_PASSWORD)) {
    return "Password should be at least 6 characters.";
  }
  return errorCode || "An unexpected error occurred. Please try again."; // Return original error if not mapped
};