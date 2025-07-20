import React, { useEffect, useState } from "react";
import { Dimensions, Image, Platform, SafeAreaView, StyleSheet, View } from "react-native";
import { Avatar, Button, Text } from "react-native-paper";
import { useAuth } from "../../utils/AuthContext";
import SuperHomeScreen from "./SuperHomeScreen"; // Import the main dashboard screen

export default function PerformanceSelectionScreen({ navigation }: any) {
  const { auth } = useAuth();
  const [userName, setUserName] = useState("Supervisor");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const today = new Date();
    setCurrentDate(today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));

    if (auth?.firstName && auth?.lastName) {
      setUserName(`${auth.firstName} ${auth.lastName}`);
    } else if (auth?.firstName) {
      setUserName(auth.firstName);
    }
  }, [auth]);

  const handlePerformance1 = () => {
    navigation.navigate("SuperHome");
  };

  const handlePerformance2 = () => {
    navigation.navigate("SuperHomeScreenP2"); // Navigate to the second performance home screen
  };

  if (Platform.OS === 'web') {
    // On web, this screen is redundant. We render the main dashboard directly
    // to avoid a white screen during redirection.
    return <SuperHomeScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topShapeContainer}>
        <View style={styles.topShape} />
        <View style={styles.topBarContainer}>
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
            <Image
              source={require("../../assets/images/logobgr.png")}
              style={styles.topBarLogo}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>
      <View style={styles.container}>
        <Text style={styles.selectionTitle}>Select Performance Type</Text>
        <Button
          mode="contained"
          onPress={handlePerformance1}
          style={styles.button}
          labelStyle={styles.buttonLabel}
          buttonColor="#1565c0"
        >
          Performance 1
        </Button>
        <Button
          mode="outlined"
          onPress={handlePerformance2}
          style={[styles.button, { borderColor: '#1565c0', borderWidth: 2 }]}
          labelStyle={[styles.buttonLabel, { color: '#1565c0' }]}
        >
          Performance 2
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5faff", // Or your app's background color
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    paddingTop: 150,
  },
  topShapeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: 1,
  },
  topShape: {
    backgroundColor: "#1565c0",
    height: 150,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    opacity: 0.15,
  },
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  topBarInternal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcomeTitle: {
    fontSize: 20,
    color: "#1565c0",
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 2,
    marginLeft: 45,
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
    width: 100,
    height: 100,
    marginLeft: 10,
  },
  selectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 40,
    textAlign: 'center'
  },
  button: {
    width: "80%",
    paddingVertical: 10,
    marginBottom: 25,
    borderRadius: 8,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Web-specific styles
  webPageContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f0f4f7',
  },
  webMainContent: {
    flex: 1,
    backgroundColor: '#f0f4f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    width: '100%',
    maxWidth: 500,
  },
  webLogo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  webTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 16,
    color: '#718096',
    marginBottom: 40,
    textAlign: 'center',
  },
  webButtonContainer: {
    width: '100%',
  },
  webButton: {
    paddingVertical: 10,
    marginBottom: 16,
  },
  webButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});