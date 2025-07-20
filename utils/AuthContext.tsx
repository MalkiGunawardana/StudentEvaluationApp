import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

// Define the shape of your authentication state
interface AuthState {
  idToken: string | null;
  uid: string | null;
  role: string | null; // e.g., 'admin', 'supervisor'
  email: string | null; // Add email to AuthState
  firstName: string | null; // Added for user's first name
  lastName: string | null;  // Added for user's last name
  isLoading: boolean; // To track if auth state is being loaded from storage
}

// Define the shape of your context
type AuthContextType = {
  logout: () => Promise<void>;
  auth: AuthState; // Current authentication state
  setAuthData: (data: { idToken: string | null; uid: string | null; role: string | null; email: string | null; firstName: string | null; lastName: string | null; }) => Promise<void>; // Updated to include first/last name and allow null for idToken/uid
  clearAuthData: () => Promise<void>; // Removed email from setAuthData params for now, will be added in LoginScreen
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'appAuthState';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    idToken: null,
    uid: null,
    role: null,
    email: null, // Initialize email
    firstName: null, // Initialize first name
    lastName: null,  // Initialize last name
    isLoading: true, // Start with loading true
  });

  // Load auth state from AsyncStorage when the app starts
  useEffect(() => {
    const loadAuthFromStorage = async () => {
      try {
        const storedAuth = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth) {
          const parsedAuth = JSON.parse(storedAuth);
          setAuth({ ...parsedAuth, isLoading: false });
        } else {
          setAuth(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("Failed to load auth state from storage", error);
        setAuth(prev => ({ ...prev, isLoading: false })); // Ensure loading is set to false on error
      }
    };
    loadAuthFromStorage();
  }, []);

  // Function to set auth data (e.g., after login) and save to AsyncStorage
  const setAuthData = async (data: { idToken: string | null; uid: string | null; role: string | null; email: string | null; firstName: string | null; lastName: string | null; }) => {
    const newAuthState = { ...data, isLoading: false };
    setAuth(newAuthState);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
  };

  // Function to clear auth data (e.g., after logout) and remove from AsyncStorage
  const clearAuthData = async () => {
    const clearedState: AuthState = { idToken: null, uid: null, role: null, email: null, firstName: null, lastName: null, isLoading: false };
    setAuth(clearedState);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Alias clearAuthData to logout for clarity in components
  const logout = async () => {
    await clearAuthData();
  };

  return (
    <AuthContext.Provider value={{ auth, setAuthData, clearAuthData, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}