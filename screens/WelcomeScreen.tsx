import { useResponsive } from "@/hooks/useResponsive";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Image, Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";

// Define your stack param list
type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { isMobile } = useResponsive();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Image
            source={require("../assets/images/logobgr.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome to WAD Judging</Text>
          <Text style={styles.subtitle}>
            The ultimate tool for streamlined student evaluations and performance tracking.
          </Text>
        </View>
        <View style={[styles.buttonContainer, !isMobile && styles.buttonContainerWeb]}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate("Signup")}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
            buttonColor="#7C3AED"
          >
            Create an Account
          </Button>
          <Button
            mode="text"
            onPress={() => navigation.navigate("Login")}
            style={styles.button}
            labelStyle={[styles.buttonLabel, styles.signInLabel]}
            contentStyle={styles.buttonContent}
            textColor="#7C3AED"
          >
            Sign In
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA', // A light, clean background color
  },
  container: {
    flex: 1,
    justifyContent: 'space-between', // Pushes content to top and buttons to bottom
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: Platform.OS === 'android' ? 40 : 20,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 40,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937', // Dark slate gray for better readability
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563', // A softer gray for the subtitle
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  buttonContainerWeb: {
    maxWidth: 360,
  },
  button: {
    width: '100%',
    marginVertical: 8,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  signInLabel: {
    color: '#7C3AED',
  },
});