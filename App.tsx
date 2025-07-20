import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import "./firebase/config"; // Import Firebase config to initialize app
import AppNavigator from "./navigation/AppNavigation";
import { AuthProvider } from "./utils/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer
        documentTitle={{
          formatter: (options, route) =>
            `WAD Judging - ${options?.title ?? route?.name}`,
        }}
      >
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}