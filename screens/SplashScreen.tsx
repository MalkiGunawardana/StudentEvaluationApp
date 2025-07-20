import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";

// Define your stack param list
type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

export default function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  useEffect(() => {
    // On web, navigate instantly. On mobile, keep the splash for a moment.
    const delay = Platform.OS === 'web' ? 0 : 2000;
    const timer = setTimeout(() => {
      navigation.replace("Welcome");
    }, delay);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/logobgr.png")}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1B263B" },
  logo: { width: 300, height: 300 },
});