import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SupervisorBottomNavBarP2({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();

  // Helper to determine if a route is active
  // This is a simple example; for more complex navigation, consider using useRoute from @react-navigation/native
  const isActive = (routeName: string) => {
    // This logic might need adjustment based on your navigation state structure
    const currentRoute = navigation.getState()?.routes[navigation.getState()?.index]?.name;
    return currentRoute === routeName;
  };

  return (
    <View 
      style={[
        styles.navBar, 
        { height: styles.navBar.height + insets.bottom, paddingBottom: insets.bottom }
      ]}
    >
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("SuperHomeScreenP2")} // Ensure this route name matches your navigator
      >
        <MaterialIcons name="home" size={28} color={isActive("SuperHome") ? "#1565c0" : "#757575"} />
        <Text style={[styles.navLabel, isActive("SuperHome") && styles.activeLabel]}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Performance2Results")} // Ensure this route name matches your navigator
      >
        <MaterialIcons name="assessment" size={28} color={isActive("Results") ? "#1565c0" : "#757575"} />
        <Text style={[styles.navLabel, isActive("Results") && styles.activeLabel]}>Results</Text>
      </TouchableOpacity>
       <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("AddMarksScreenP2")} // Ensure this route name matches your navigator
      >
        <MaterialIcons name="edit" size={28} color={isActive("AddMarksScreenP2") ? "#1565c0" : "#757575"} />
        <Text style={[styles.navLabel, isActive("AddMarksScreenP2") && styles.activeLabel]}>Marks</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("SupervisorUserProfile", { performance: 'performance2' })} // Ensure this route name matches your navigator
      >
        <MaterialIcons name="person" size={28} color={isActive("UserProfile") ? "#1565c0" : "#757575"} />
        <Text style={[styles.navLabel, isActive("UserProfile") && styles.activeLabel]}>Profile</Text>
      </TouchableOpacity>

      </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start", // Align items to the top to make space for paddingBottom
    height: 60, // Base height for the content area
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 5, // Add some padding at the top of the icons/text
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navLabel: {
    fontSize: 12,
    color: "#757575", // Default color for inactive tabs
    marginTop: 2,
  },
  activeLabel: {
    color: "#1565c0", // Active tab color
    fontWeight: "bold",
  },
});