import AddBatchScreen from "@/screens/admin/AddBatchScreen";
import AddEventScreen from "@/screens/admin/AddEventScreen";
import AddStudentScreen from "@/screens/admin/AddStudentScreen";
import AddTeamScreen from "@/screens/admin/AddTeamScreen";
import AdminHomeScreen from "@/screens/admin/AdminHomeScreen";
import AdminResultsScreen from "@/screens/admin/AdminResultsScreen";
import EditStudentScreen from "@/screens/admin/EditStudentScreen";
import NotificationScreen from "@/screens/admin/NotificationScreen";
import StudentDetailScreen from "@/screens/admin/StudentDetailScreen";
import StudentListScreen from "@/screens/admin/StudentListScreen";
import UserProfileScreen from "@/screens/common/UserProfileScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import SplashScreen from "@/screens/SplashScreen";
import AddMarksScreen from "@/screens/supervisor/AddMarksScreen";
import AddMarksScreenP2 from "@/screens/supervisor/AddMarksScreenP2";
import Performance1ResultsScreen from "@/screens/supervisor/Performance1ResultsScreen";
import Performance2ResultsScreen from "@/screens/supervisor/Performance2ResultsScreen";
import PerformanceSelectionScreen from "@/screens/supervisor/PerformanceSelectionScreen";
import SuperHomeScreen from "@/screens/supervisor/SuperHomeScreen";
import SuperHomeScreenP2 from "@/screens/supervisor/SuperHomeScreenP2";
import SupervisorUserProfileScreen from "@/screens/supervisor/SupervisorUserProfileScreen";
import WelcomeScreen from "@/screens/WelcomeScreen";
import { useAuth } from "@/utils/AuthContext";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

const Stack = createNativeStackNavigator();

// Define screen options to hide the header for all stacks
const screenOptions = { headerShown: false };

// Navigator for unauthenticated users
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

// Navigator for Admin users
function AdminStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
      <Stack.Screen name="AddStudent" component={AddStudentScreen} />
      <Stack.Screen name="BatchScreen" component={AddBatchScreen} />
      {/* Note: AdminStudentList and StudentList point to the same component, ensure one is canonical if needed */}
      <Stack.Screen name="StudentDetails" component={StudentDetailScreen} />
      <Stack.Screen name="StudentList" component={StudentListScreen} />
      <Stack.Screen name="EditStudent" component={EditStudentScreen} />
      <Stack.Screen name="AddEvent" component={AddEventScreen} />
      <Stack.Screen name="AddTeam" component={AddTeamScreen} />
      <Stack.Screen name="AdminResults" component={AdminResultsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
      
    </Stack.Navigator>
  );
}

// Navigator for Supervisor users
function SupervisorStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="PerformanceSelection" component={PerformanceSelectionScreen} />
      <Stack.Screen name="SuperHome" component={SuperHomeScreen} />
      <Stack.Screen name="AddMarks" component={AddMarksScreen} />
      <Stack.Screen name="Performance1Results" component={Performance1ResultsScreen} />
      <Stack.Screen name="SuperHomeScreenP2" component={SuperHomeScreenP2} />
      <Stack.Screen name="AddMarksScreenP2" component={AddMarksScreenP2} />
      <Stack.Screen name="Performance2Results" component={Performance2ResultsScreen} />
      <Stack.Screen name="SupervisorUserProfile" component={SupervisorUserProfileScreen} />
      <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { auth } = useAuth();

  // Show a loading screen or splash screen while auth state is being determined
  if (auth.isLoading) {
    // You might want a dedicated loading screen component here
    // For simplicity, returning Splash, but a distinct loading indicator is better.
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  if (auth.idToken && auth.role) {
    if (auth.role === 'admin') {
      return <AdminStack />;
    } else if (auth.role === 'supervisor') {
      return <SupervisorStack />;
    }
    // Fallback for other authenticated roles, or if role logic needs expansion
    // For now, defaulting to AuthStack if role is unrecognized but token exists.
    // Consider a dedicated "role selection" or "error" screen.
    return <AuthStack />; 
  }

  // User is not authenticated
  return <AuthStack />;
}