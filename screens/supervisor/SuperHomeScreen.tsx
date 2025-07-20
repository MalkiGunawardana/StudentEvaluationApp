import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Button, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Import useSafeAreaInsets
import SupervisorBottomNavBar from "../../components/SupervisorBottomNavBar";
import SupervisorWebSidebar from "../../components/supervisor/SupervisorWebSideBar";
import { useAuth } from "../../utils/AuthContext";
import { EventDocument, fetchEvents, fetchStudents } from "../../utils/firebaseRest";

const NAV_BAR_CONTENT_HEIGHT = 60; // Standard height of the bottom nav bar's content area

export default function SuperHomeScreen({ navigation }: any) {
  const { auth } = useAuth();
  const idToken = auth?.idToken;
  const [userName, setUserName] = useState("Supervisor"); // For welcome message
  const [currentDate, setCurrentDate] = useState("");    // For welcome message
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [stats, setStats] = useState({ students: 0, events: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loading, setLoading] = useState(true); // Combined loading state

  const insets = useSafeAreaInsets(); // Get safe area insets
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");
  const [notificationType, setNotificationType] = useState<"success" | "error">("success");

  const showNotification = useCallback((msg: string, type: "success" | "error" = "success", autoClose = true) => {
    setNotificationMsg(msg);
    setNotificationType(type);
    setNotificationModalVisible(true);
    if (autoClose) {
      setTimeout(() => setNotificationModalVisible(false), type === "error" ? 4000 : 2500);
    }
  }, []);

  useEffect(() => {
    const today = new Date();
    setCurrentDate(today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!idToken) {
      showNotification("Authentication token is missing.", "error", false);
      setLoading(false);
      setLoadingStats(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch user profile (for supervisor's name)
      // Use names from AuthContext directly, as they should be populated on login
      if (auth?.firstName && auth?.lastName) {
        setUserName(`${auth.firstName} ${auth.lastName}`);
      } else if (auth?.firstName) {
        setUserName(auth.firstName);
      }
      // Fetch stats and events together
      const [fetchedEvents, fetchedStudents] = await Promise.all([
        fetchEvents(idToken),
        fetchStudents(idToken)
      ]);

      setEvents(fetchedEvents);
      setStats({ events: fetchedEvents.length, students: fetchedStudents.length });
      if (fetchedEvents.length === 0) {
        showNotification("No events currently available.", "success", true);
      }
    } catch (error: any) {
      showNotification(error.message || "Failed to load initial data.", "error", false);
      setEvents([]);
      setStats({ events: 0, students: 0 });
    } finally {
      setLoading(false);
      setLoadingStats(false);
    }
  }, [idToken, auth?.firstName, auth?.lastName, showNotification]); // Updated dependencies

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Top bar content, similar to AdminHomeScreen
  const TopBarContent = () => (
    <View style={styles.topBarInternal}>
      <View style={{ flexDirection: "column", flex: 1 }}>
        <Text style={styles.welcomeTitle}>Welcome</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Avatar.Text 
            size={36} 
            label={userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase() : "S"} 
            style={{ backgroundColor: "#1565c0" }} 
            color="#fff"
          />
          <View style={{ marginLeft: 10, maxWidth: Dimensions.get("window").width * 0.5 }}>
            <Text style={styles.userNameText} numberOfLines={1} ellipsizeMode="tail">{userName}</Text>
            <Text style={styles.dateText}>{currentDate}</Text>
          </View>
        </View>
      </View>
      {/* Optional: Add logo if desired, or keep it clean */}
      <Image
        source={require("../../assets/images/logobgr.png")}
        style={styles.topBarLogo}
        resizeMode="contain"
      />
    </View>
  );

  const TopShape = React.memo(() => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <TopBarContent />
      </View>
    </View>
  ));

  const StatsCard = ({ icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) => (
    <View style={styles.statCard}>
      <MaterialIcons name={icon} size={28} color={color} style={styles.statIcon} />
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color }]}>{loadingStats ? '...' : value}</Text>
      </View>
    </View>
  );

  const StatsCards = () => (
    <View style={styles.statsContainer}>
      <StatsCard icon="event" label="Total Events" value={stats.events} color="#43a047" />
      <StatsCard icon="people" label="Total Students" value={stats.students} color="#1e88e5" />
    </View>
  );

  const renderEventItem = ({ item }: { item: EventDocument }) => (
    <TouchableOpacity
      style={styles.eventItem}
      // If you want to navigate somewhere when an event item is pressed, add onPress here.
      // For example: onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}
    >
      <View style={{flex: 1}}>
        <Text style={styles.eventNameText}>{item.eventName}</Text>
        <Text style={styles.eventDetailText}>Gender: {item.gender}</Text>
      </View>
    </TouchableOpacity>
  );


  // This is the new web-specific layout. It uses the SupervisorWebSidebar
  // and a two-column layout for a better desktop experience.
  if (Platform.OS === 'web') {
      return (
        <View style={styles.webContainer}>
          <SupervisorWebSidebar navigation={navigation} />
          <ScrollView style={styles.webMainContent}>
            <View style={styles.webHeader}>
              <Text style={styles.webWelcomeTitle}>Welcome, {userName}</Text>
              <Text style={styles.webDate}>{currentDate}</Text>
            </View>
            
            <StatsCards />
            
            <Text style={styles.webSectionTitle}>Available Events</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#1565c0" style={styles.loader} />
            ) : (
              <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={renderEventItem}
                ListEmptyComponent={
                    <Text style={styles.emptyListText}>
                      No events available.
                    </Text>
                }
                style={styles.flatList}
                contentContainerStyle={{ paddingBottom: 20 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              />
            )}
          </ScrollView>
        </View>
      );
  }
  return (
    <SafeAreaView style={styles.safeArea}>
      <TopShape />
      <View style={styles.container}>
        <StatsCards />
        <Text style={styles.sectionTitle}>Available Events</Text>
        {loading ? (
        <ActivityIndicator size="large" color="#1565c0" style={styles.loader} />
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={renderEventItem}
            ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  No events available.
                </Text>
            }
            style={styles.flatList}
            contentContainerStyle={{ paddingBottom: NAV_BAR_CONTENT_HEIGHT + insets.bottom + 20 }} // Dynamic padding
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}
      </View>

      <Modal visible={notificationModalVisible} transparent animationType="fade" onRequestClose={() => setNotificationModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={notificationType === "error" ? styles.errorModalText : styles.successModalText}>{notificationMsg}</Text>
            {notificationType === "error" && (
              <Button onPress={() => setNotificationModalVisible(false)} style={styles.modalCloseButton}>
                Close
              </Button>
            )}
          </View>
        </View>
      </Modal>
      <SupervisorBottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5faff" },
  // Top Shape and Bar Styles (adapted from AdminHomeScreen)
  topShapeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150, // Matched AdminHomeScreen
    zIndex: 1,
  },
  topShape: {
    backgroundColor: "#1565c0",
    height: 150, // Matched AdminHomeScreen
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    opacity: 0.15,
  },
  topBarContainer: { // Container for the content within the shape
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110, // Matched AdminHomeScreen
    justifyContent: "flex-end", // Aligns content to bottom of this container
    paddingHorizontal: 20,
    paddingTop: 20, // For status bar space
  },
  topBarInternal: { // The actual row for welcome, name, date, logo
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // marginBottom: 10, // Removed to match AdminHomeScreen (spacing handled by topBarContainer padding)
  },
  welcomeTitle: {
    fontSize: 20, // Matched AdminHomeScreen
    color: "#1565c0",
    fontWeight: "bold",
    marginTop: 20, // Matched AdminHomeScreen
    marginBottom: 2,
    marginLeft: 45, // To align with avatar
  },
  userNameText: {
    fontWeight: "bold",
    fontSize: 18,
    color: "#1565c0",
  },
  dateText: {
    fontSize: 13,
    color: "#666",
  },
  topBarLogo: {
    width: 100, // Matched AdminHomeScreen
    height: 100, // Matched AdminHomeScreen
    marginLeft: 10,
  },
  // Main container for content below the top shape
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 160, // Push content below the larger shape (150 shape + buffer)
    paddingBottom: 10,
  },
  // Action Buttons Styles (adapted from AdminHomeScreen)
  // Event List Styles
  sectionTitle: {
    fontSize: 20, // Slightly larger
    fontWeight: "bold",
    color: "#1565c0",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  loader: { marginTop: 30, alignSelf: 'center' },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statIcon: {
    marginRight: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 2,
  },
  flatList: { marginTop: 8, flex: 1 },
  emptyListText: { color: "#777", textAlign: "center", marginTop: 30, fontSize: 16 },
  eventItem: { // Adapted from studentItem in AdminHomeScreen
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 2,
    justifyContent: "space-between",
  },
  eventNameText: {
    fontSize: 17,
    fontWeight: "600", // Semibold
    color: "#333",
    flexShrink: 1, // Allow text to shrink if too long
    marginBottom: 3,
  },
  eventDetailText: {
    fontSize: 13,
    color: "#666",
  },
  // Modal Styles (can be reused)
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 280, maxWidth: 340, marginHorizontal: 16, elevation: 5 },
  successModalText: { color: "green", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  errorModalText: { color: "red", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  modalCloseButton: { marginTop: 12 },
  // Web specific styles
  webContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f0f4f7',
  },
  webMainContent: {
    flex: 1,
    padding: 24,
  },
  webHeader: {
    marginBottom: 32,
  },
  webWelcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A202C', // Darker text for better readability
  },
  webDate: {
    fontSize: 16,
    color: '#718096',
    marginTop: 4,
  },
  webSectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4A5568',
    marginBottom: 16,
  },
});
