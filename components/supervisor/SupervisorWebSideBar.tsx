import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button } from 'react-native-paper';
import { useAuth } from "../../utils/AuthContext";

// Define menu items with sections
const menuSections = [
  {
    title: "Performance 1",
    items: [
      { label: "Home", icon: "home", screen: "SuperHome" },
      { label: "Marks", icon: "playlist-add-check", screen: "AddMarks" },
      { label: "Results", icon: "assessment", screen: "Performance1Results" },
    ],
  },
  {
    title: "Performance 2",
    items: [
      { label: "Home", icon: "home", screen: "SuperHomeScreenP2" },
      { label: "Marks", icon: "playlist-add-check", screen: "AddMarksScreenP2" },
      { label: "Results", icon: "assessment", screen: "Performance2Results" },
    ],
  },
  {
    title: "General",
    items: [
        // { label: "Select Performance", icon: "swap-horiz", screen: "PerformanceSelection" },
        { label: "Profile", icon: "person", screen: "SupervisorUserProfile" },
    ],
  },
];

export default function SupervisorWebSidebar({ navigation }: { navigation: any }) {
  const { auth, clearAuthData } = useAuth();
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  const handleLogout = () => setLogoutConfirmVisible(true);
  const confirmLogout = async () => {
    setLogoutConfirmVisible(false);
    await clearAuthData();
  };

  const currentRoute = navigation.getState()?.routes[navigation.getState()?.index]?.name;
  const isActive = (screenName: string) => currentRoute === screenName;

  return (
    <View style={styles.sidebarContainer}>
      <View>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/logobgr.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>WAD Judging</Text>
        </View>

        {menuSections.map((section) => (
          <View key={section.title} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, isActive(item.screen) && styles.activeMenuItem]}
                onPress={() => navigation.navigate(item.screen)}
              >
                <MaterialIcons
                  name={item.icon as any}
                  size={22}
                  color={isActive(item.screen) ? "#fff" : "#a0aec0"}
                  style={styles.icon}
                />
                <Text style={[styles.menuLabel, isActive(item.screen) && styles.activeMenuLabel]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <MaterialIcons name="logout" size={22} color="#a0aec0" style={styles.icon} />
        <Text style={styles.menuLabel}>Logout</Text>
      </TouchableOpacity>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutConfirmVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtonRow}>
              <Button mode="outlined" onPress={() => setLogoutConfirmVisible(false)} style={styles.modalButton}>Cancel</Button>
              <Button mode="contained" onPress={confirmLogout} style={[styles.modalButton, { backgroundColor: '#c62828' }]}>Logout</Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebarContainer: {
    width: 260,
    backgroundColor: "#1A202C",
    paddingVertical: 20,
    justifyContent: "space-between",
    height: "100%",
  },
  logoContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2D3748",
  },
  logo: {
    width: 80,
    height: 80,
  },
  appName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
  },
  sectionContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#718096",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    borderRadius: 8,
  },
  activeMenuItem: {
    backgroundColor: "#2D3748",
  },
  icon: {
    marginRight: 15,
  },
  menuLabel: {
    color: "#E2E8F0",
    fontSize: 16,
  },
  activeMenuLabel: {
    color: "#fff",
    fontWeight: "bold",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    borderRadius: 8,
    borderTopWidth: 1,
    borderTopColor: "#2D3748",
    marginTop: 20,
  },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 250, maxWidth: 340, marginHorizontal: 16, elevation: 5 },
  modalTitle: { fontWeight: "bold", fontSize: 18, marginBottom: 12, color: "#333" },
  modalMessage: { marginBottom: 20, fontSize: 15, textAlign: 'center', color: "#555" },
  modalButtonRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 16, gap: 16 },
  modalButton: { flex: 1 },
});
