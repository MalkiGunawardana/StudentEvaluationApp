import { useAuth } from "@/utils/AuthContext";
import { fetchPendingEditRequestsCount } from "@/utils/firebaseRest";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useNavigationState } from "@react-navigation/native";
import React, { useCallback, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from "react-native-paper";

const menuItems = [
    { label: "Home", icon: "home", screen: "AdminHome" },
    { label: "Student", icon: "person-add", screen: "AddStudent" },
    { label: "Student List", icon: "list-alt", screen: "StudentList" },
    { label: "Event", icon: "event", screen: "AddEvent" },
    { label: "Team", icon: "group", screen: "AddTeam" },
    { label: "Results", icon: "assessment", screen: "AdminResults" },
    { label: "Notifications", icon: "notifications", screen: "NotificationScreen" },
    { label: "Profile", icon: "person", screen: "UserProfile" },
];

export default function DesktopSideBar() {
    const navigation = useNavigation();
    // The context can be null initially. Provide a fallback {} to prevent a crash.
    // Let's be extremely defensive and add logging to see what's in the context.
    const authContext = useAuth();
    const { routes, index } = useNavigationState(state => state);
    const currentRouteName = routes[index].name;
    const [pendingNotificationsCount, setPendingNotificationsCount] = useState(0);
    const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

    const loadPendingNotificationsCount = useCallback(async () => {
        // Use auth from the context directly here.
        if (!authContext?.auth?.idToken) {
            setPendingNotificationsCount(0);
            return;
        }
        try {
            const count = await fetchPendingEditRequestsCount(authContext.auth.idToken);
            setPendingNotificationsCount(count);
        } catch (error) {
            console.error("DesktopSideBar: Failed to fetch pending notifications count:", error);
            setPendingNotificationsCount(0);
        }
    }, [authContext]);

    // useFocusEffect is better than useEffect here as it refetches when the user navigates back to the admin area.
    useFocusEffect(
        useCallback(() => {
            loadPendingNotificationsCount();
        }, [loadPendingNotificationsCount])
    );

    const handleLogout = () => {
        setLogoutConfirmVisible(true);
    };

    const confirmLogout = async () => {
        setLogoutConfirmVisible(false);
        try {
            if (authContext && typeof authContext.logout === 'function') {
                await authContext.logout();
            } else {
                console.error("Could not find the logout function on the auth context. The context value is:", authContext);
            }
        } catch (error) {
            console.error("Logout failed from sidebar:", error);
        }
    };


    return (
        <View style={styles.sidebar}>
            <View style={styles.header}>
                <Image
                    source={require("@/assets/images/logobgr.png")}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>WAD Judging</Text>
            </View>
            <View style={styles.menu}>
                {menuItems.map((item) => {
                    const isActive = currentRouteName === item.screen;
                    const isNotifications = item.label === "Notifications";
                    return (
                        <TouchableOpacity
                            key={item.label}
                            style={[styles.menuItem, isActive && styles.menuItemActive]}
                            onPress={() => navigation.navigate(item.screen as never)}
                        >
                            <MaterialIcons
                                name={item.icon as any}
                                size={24}
                                color={isActive ? "#fff" : "#A0AEC0"}
                                style={styles.icon}
                            />
                            <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                                {item.label}
                            </Text>
                            {isNotifications && pendingNotificationsCount > 0 && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationBadgeText}>{pendingNotificationsCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
            <View style={styles.footer}>
                <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                    <MaterialIcons
                        name="logout"
                        size={24}
                        color="#A0AEC0"
                        style={styles.icon}
                    />
                    <Text style={styles.menuLabel}>Logout</Text>
                </TouchableOpacity>
            </View>

            {/* Logout Confirmation Modal */}
            <Modal visible={logoutConfirmVisible} transparent animationType="fade" onRequestClose={() => setLogoutConfirmVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Logout</Text>
                        <Text style={styles.modalMessage}>Are you sure you want to logout?</Text>
                        <View style={styles.modalButtonRow}>
                            <Button mode="outlined" onPress={() => setLogoutConfirmVisible(false)} style={styles.modalButton}>Cancel</Button>
                            <Button mode="contained" onPress={confirmLogout} style={[styles.modalButton, { backgroundColor: '#c62828' }]}>
                                Logout
                            </Button>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebar: { width: 260, backgroundColor: "#1A202C", padding: 16, height: "100%", flexDirection: "column" },
    header: { alignItems: "center", marginBottom: 32, paddingVertical: 20 },
    logo: { width: 80, height: 80, marginBottom: 12 },
    title: { fontSize: 20, fontWeight: "bold", color: "#fff" },
    menu: { flex: 1 },
    menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 },
    menuItemActive: { backgroundColor: "#4A5568" },
    icon: { marginRight: 16 },
    menuLabel: { fontSize: 16, color: "#E2E8F0" },
    menuLabelActive: { color: "#fff", fontWeight: "bold" },
    footer: { borderTopWidth: 1, borderTopColor: "#4A5568", paddingTop: 16 },
    // Styles for notification badge, similar to BottomNavBar
    notificationBadge: {
        position: 'absolute',
        right: 12,
        top: 12,
        backgroundColor: 'red',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    notificationBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
    modalBox: { backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 250, maxWidth: 340, marginHorizontal: 16, elevation: 5 },
    modalTitle: { fontWeight: "bold", fontSize: 18, marginBottom: 12, color: "#333" },
    modalMessage: { marginBottom: 20, fontSize: 15, textAlign: 'center', color: "#555" },
    modalButtonRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 16, gap: 16 },
    modalButton: { flex: 1 },
});
