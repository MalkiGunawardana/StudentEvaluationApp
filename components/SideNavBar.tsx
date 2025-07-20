import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native"; // Ensure TouchableOpacity is imported

const menuItems = [
  { label: "Event", icon: "event", screen: "AddEvent" },
  { label: "Team", icon: "group", screen: "AddTeam" },
  { label: "Student", icon: "school", screen: "AddStudent" },
  { label: "Results", icon: "assessment", screen: "AdminResults" }, // Changed screen name
  { label: "User", icon: "person", screen: "UserProfile" },
];

export default function SideNavBar({ navigation, onClose }: { navigation: any; onClose: () => void }) {
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1} />
      <View style={styles.drawer}>
        <Text style={styles.drawerTitle}>Menu</Text>
        {menuItems.map((item) => {
          // console.log(`SideNavBar: Rendering menu item - ${item.label}`); // Can be verbose
          return (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={() => {
              onClose();
              navigation.navigate(item.screen);
            }}
          >
            <MaterialIcons name={item.icon as any} size={26} color="#1565c0" style={{ marginRight: 18 }} />
            <Text style={styles.menuLabel}>{item.label}</Text>
          </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(width * 0.7, 280);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: "#fff",
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 0 },
    justifyContent: "flex-start",
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1565c0",
    marginBottom: 28,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  menuLabel: {
    fontSize: 17,
    color: "#222",
  },
});
