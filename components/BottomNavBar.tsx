import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Import useSafeAreaInsets
import { useAuth } from "../utils/AuthContext";
import { fetchPendingEditRequestsCount } from "../utils/firebaseRest";
import SideNavBar from "./SideNavBar";

export default function BottomNavBar({ navigation }: { navigation: any }) {
  const { auth } = useAuth();
  const [sideNavVisible, setSideNavVisible] = useState(false);
  const insets = useSafeAreaInsets(); // Get safe area insets
  const [pendingNotificationsCount, setPendingNotificationsCount] = useState(0);

  const loadPendingNotificationsCount = useCallback(async () => {
    if (!auth.idToken) {
      setPendingNotificationsCount(0);
      return;
    }
    try {
      const count = await fetchPendingEditRequestsCount(auth.idToken);
      setPendingNotificationsCount(count);
    } catch (error) {
      console.error("Failed to fetch pending notifications count:", error);
      setPendingNotificationsCount(0);
    }
  }, [auth.idToken]);

  // Fetch count when the component mounts or auth token changes
  // Also refetch when the screen containing this nav bar comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPendingNotificationsCount();
      // You might want to set up a polling mechanism here for real-time-ish updates
      // if the screen stays focused for a long time, but for now, on-focus is sufficient.
      return () => {
        // Cleanup if needed
      };
    }, [loadPendingNotificationsCount])
  );

  return (
    <>
      {/* Apply paddingBottom based on the device's bottom inset */}
      <View 
        style={[
          styles.navBar, 
          { height: styles.navBar.height + insets.bottom, paddingBottom: insets.bottom }
        ]}
      >
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate("AdminHome")}>
          <MaterialIcons name="home" size={28} color="#1565c0" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate("StudentList")}>
          <MaterialIcons name="search" size={28} color="#1565c0" />
          <Text style={styles.navLabel}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {
          navigation.navigate("NotificationScreen");
          // Optionally, refresh count immediately after navigating to clear the badge
          // if the user is expected to clear notifications on that screen.
          // loadPendingNotificationsCount(); 
        }}>
          <MaterialIcons name="notifications" size={28} color="#1565c0" />
          <Text style={styles.navLabel}>Notification</Text>
          {pendingNotificationsCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{pendingNotificationsCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setSideNavVisible(true)}>
          <MaterialIcons name="menu" size={28} color="#1565c0" />
          <Text style={styles.navLabel}>Menu</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={sideNavVisible} transparent animationType="slide" onRequestClose={() => setSideNavVisible(false)}>
        {/* Correct way to log during render if needed for debugging:
          Call console.log and then return the component.
          Or, for cleaner temporary logging, log before the return statement of the Modal's content.
        */}
        {/* {(() => { console.log("BottomNavBar: Rendering SideNavBar in Modal. Visible:", sideNavVisible); return null; })()} */}
        <SideNavBar navigation={navigation} onClose={() => setSideNavVisible(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center", // This ensures items are centered vertically within the navBar's height
    height: 60, // This is the height for the content (icons and labels)
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0"
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navLabel: {
    fontSize: 12,
    color: "#1565c0",
    marginTop: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5, // Adjust position as needed
    right: 15, // Adjust position as needed
    backgroundColor: 'red',
    borderRadius: 10, // Half of width/height for a circle
    minWidth: 20, // Minimum width
    height: 20, // Height
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4, // Add some padding for numbers > 9
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
