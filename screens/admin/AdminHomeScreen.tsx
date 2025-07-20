import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Image, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Import useSafeAreaInsets
import BottomNavBar from "../../components/BottomNavBar";
import DesktopSideBar from "../../components/admin/DesktopSideBar";
import { useAuth } from "../../utils/AuthContext";
import { fetchEvents, fetchPendingEditRequestsCount, fetchStudents } from "../../utils/firebaseRest";

type AdminStackParamList = {
  AddStudent: undefined;
  StudentList: undefined;
  Notification: undefined;
  Profile: undefined;
  AdminHomeScreen: undefined;
  StudentDetails: { student: any };
  AddEvent: undefined;
  AddTeam: undefined;
  AdminResults: undefined;
};

const BOTTOM_NAV_BAR_FIXED_HEIGHT = 60; // Matches the height in BottomNavBar.tsx

export default function AdminHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  // Safely access the auth context to prevent errors on initial render
  const authContext = useAuth();
  const idToken = authContext?.auth?.idToken;
  const uid = authContext?.auth?.uid;
  const isWeb = Platform.OS === 'web';

  const [userName, setUserName] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [stats, setStats] = useState({ students: 0, events: 0, requests: 0 });
  const insets = useSafeAreaInsets(); // Get safe area insets

  useEffect(() => {
    const today = new Date();
    setCurrentDate(today.toLocaleDateString());

    // Fetch user profile once
    async function loadProfile() {
      if (idToken && uid) {
        setLoadingProfile(true);
        try {
          // Use names from AuthContext directly, as they should be populated on login
          if (authContext?.auth?.firstName && authContext?.auth?.lastName) {
            setUserName(`${authContext.auth.firstName} ${authContext.auth.lastName}`);
          } else if (authContext?.auth?.firstName) {
            setUserName(authContext.auth.firstName);
          } else { // Fallback if names are not in auth context
            setUserName("User");
          }
        } catch (e) {
          console.error("Failed to load profile:", e);
          setUserName("User"); // Default on error
        } finally {
          setLoadingProfile(false);
        }
      } else {
        setLoadingProfile(false); // No token/uid, not loading
      }
    }
    loadProfile();
  }, [idToken, uid, authContext?.auth?.firstName, authContext?.auth?.lastName]); // Updated dependencies for profile loading

  // Use useFocusEffect to load recent students every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function loadRecentStudents() {
        if (idToken) {
          setLoadingStudents(true);
          try {
            const allStudents = await fetchStudents(idToken);
            const sortedStudents = allStudents.sort((a, b) => {
              // Safely convert Firestore Timestamps (live or serialized) to JS Date objects
              const getSafeDate = (timestamp: any): Date => {
                if (!timestamp) return new Date(0); // Default for sorting
                // Case 1: Firestore Timestamp object from the SDK
                if (typeof timestamp.toDate === 'function') return timestamp.toDate();
                // Case 2: Serialized Timestamp object (from JSON.parse)
                if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000);
                // Case 3: ISO string or other parsable format
                return new Date(timestamp);
              };
              const dateA = getSafeDate(a.createdAt);
              const dateB = getSafeDate(b.createdAt);
              return dateB.getTime() - dateA.getTime();
            });
            const recent = sortedStudents.slice(0, 8);
            if (isMounted) {
              setStudents(recent);
            }
          } catch (e) {
            console.error("Failed to load recent students:", e);
            if (isMounted) setStudents([]); // Clear students on error
          } finally {
            if (isMounted) setLoadingStudents(false);
          }
        }
      }
      loadRecentStudents();
      return () => { isMounted = false; };
    }, [idToken]) // Dependency for fetching students
  );

  // Fetch dashboard stats for web view
  useFocusEffect(
    useCallback(() => {
      if (!isWeb || !idToken) return;
      let isMounted = true;
      const loadStats = async () => {
        try {
          const [studentsData, eventsData, requestsCount] = await Promise.all([
            fetchStudents(idToken),
            fetchEvents(idToken),
            fetchPendingEditRequestsCount(idToken),
          ]);
          if (isMounted) setStats({ students: studentsData.length, events: eventsData.length, requests: requestsCount });
        } catch (error) {
          console.error("Failed to load dashboard stats:", error);
        }
      };
      loadStats();
      return () => { isMounted = false; };
    }, [idToken, isWeb])
  );


  // Top bar inside the shape
  const TopBar = () => (
    <View style={styles.topBar}>
      <View style={{ flexDirection: "column", flex: 1 }}>
        <Text style={styles.welcomeTitle}>Welcome</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Avatar.Text size={36} label={userName ? userName.split(" ").map(n => n[0]).join("").toUpperCase() : ""} style={{ backgroundColor: "#1565c0" }} />
          <View style={{ marginLeft: 10, maxWidth: Dimensions.get("window").width * 0.4 }}>
            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{userName}</Text>
            <Text style={styles.date}>{currentDate}</Text>
          </View>
        </View>
      </View>
      <Image
        source={require("../../assets/images/logobgr.png")}
        style={styles.topBarLogo}
        resizeMode="contain"
      />
    </View>
  );

  // Decorative top shape
  const TopShape = () => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <TopBar />
      </View>
    </View>
  );

  // Stat cards for the web dashboard
  const StatsCard = ({ icon, label, value, color }: { icon: any, label: string, value: number, color: string }) => (
    <View style={styles.statCard}>
      <MaterialIcons name={icon} size={32} color={color} style={styles.statIcon} />
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
    </View>
  );

  const StatsCards = () => (
    <View style={styles.statsContainer}>
      <StatsCard icon="people" label="Total Students" value={stats.students} color="#1e88e5" />
      <StatsCard icon="event" label="Total Events" value={stats.events} color="#43a047" />
      <StatsCard icon="notifications-active" label="Pending Requests" value={stats.requests} color="#f4511e" />
    </View>
  );

  // Recently added students
  const RecentStudents = ({ isWeb }: { isWeb: boolean }) => (
    <View style={styles.recentContainer}>
      <Text style={isWeb ? styles.webSectionTitle : styles.sectionTitle}>Recently Added Students</Text>
      {loadingStudents ? (
        <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.studentCard}
              onPress={() => navigation.navigate("StudentDetails", { student: item })}
            >
              {item.image ? (
                <Avatar.Image
                  size={48}
                  source={{ uri: item.image }}
                  style={{ backgroundColor: "#e0e0e0", marginBottom: 8 }}
                />
              ) : (
                <Avatar.Text
                  size={48}
                  label={item.fullName ? item.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase() : "?"}
                  style={{ backgroundColor: "#90caf9", marginBottom: 8 }}
                />
              )}
              <Text style={styles.studentCardName} numberOfLines={1}>{item.fullName || "-"}</Text>
              <Text style={styles.studentCardIndex}>{item.indexNo || "-"}</Text>
            </TouchableOpacity>
          )}
          numColumns={isWeb ? 4 : 2}
          key={isWeb ? 'web-columns' : 'mobile-columns'} // Key to force re-render on layout change
          showsVerticalScrollIndicator={false}
          // The contentContainerStyle for paddingBottom is only needed for mobile.
          contentContainerStyle={!isWeb ? { paddingBottom: BOTTOM_NAV_BAR_FIXED_HEIGHT + insets.bottom + 10, paddingHorizontal: 4 } : { paddingHorizontal: 4 }}
          columnWrapperStyle={!isWeb ? { justifyContent: 'space-between' } : undefined} // Add space between cards on mobile
        />
      )}
    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <ScrollView style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webWelcomeTitle}>Welcome, {userName || 'Admin'}</Text>
            <Text style={styles.webDate}>{currentDate}</Text>
          </View>
          <StatsCards />
          <View style={{ marginTop: 24 }}>
            <RecentStudents isWeb={true} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5faff" }}>
      <TopShape />
      <View style={styles.container}>
        <RecentStudents isWeb={false} />
      </View>
      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topShapeContainer: {
    position: "absolute",
    top: 0, 
    left: 0,
    right: 0,
    height: 150, // Increased height
    zIndex: 1,
  },
  topShape: {
    backgroundColor: "#1565c0",
    height: 150, // Increased height
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    opacity: 0.15,
  },
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110, // Adjusted height to fit within the new shape height
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 18, // This can remain or be adjusted if content alignment changes
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // marginTop: 10, // Removed to allow TopBar to sit higher
    //marginBottom: 15, // Changed from marginTop to marginBottom to lift content
  },
  welcomeTitle: {
    fontSize: 20,
    color: "#1565c0",
    fontWeight: "bold",
    marginTop: 20, // Added space above "Welcome"
    marginBottom: 2, // Kept existing marginBottom
    marginLeft: 45,
  },
  userName: {
    fontWeight: "bold",
    fontSize: 18,
    color: "#1565c0",
    maxWidth: Dimensions.get("window").width * 0.4,
  },
  date: {
    fontSize: 13,
    color: "#888",
  },
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 160, // push content below the larger shape (150 shape + buffer)
    paddingBottom: 10,
    marginTop: 0,
  },
  recentContainer: {
    flex: 1,
    marginTop: 15, // Keep some space from the top shape
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1565c0",
    marginBottom: 8,
    paddingHorizontal: 4, // Align with card margins
  },
  studentCard: {
    flex: 1,
    margin: 4,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minHeight: 160, // Ensure a consistent card height
  },
  studentCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  studentCardIndex: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  topBarLogo: {
    width: 100,
    height: 100,
    // marginLeft: 10, // Add if more spacing is needed from the left content
  },
  // Web-specific styles
  webContainer: {
    flexDirection: 'row',
    height: '100%',
    backgroundColor: '#f8f9fa', // A light grey background for the main content area
  },
  webMainContent: {
    flex: 1,
    padding: 32,
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
  webActionRow: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginLeft: -8, // Counteract margin on buttons
    marginRight: -8,
  },
  webActionButton: {
    width: 'auto',
    minWidth: 160,
    margin: 8,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statIcon: {
    marginRight: 16,
  },
  statLabel: {
    fontSize: 16,
    color: '#6c757d',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
});