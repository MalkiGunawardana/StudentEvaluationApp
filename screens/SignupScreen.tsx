import { FeedbackModal } from "@/components/FeedbackModal";
import { ShowModalOptions, useFeedbackModal } from "@/hooks/useFeedbackModal";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuth } from "@/utils/AuthContext"; // Import useAuth
import { getFriendlyErrorMessage } from "@/utils/errorUtils";
import { createUserDoc, sendEmailVerification, signUpWithEmail } from "@/utils/firebaseRest";
import { Picker } from "@react-native-picker/picker"; // This is fine, but we'll style its container
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native"; // Corrected import order
import { Button, Text, TextInput } from "react-native-paper";

type AuthStackParamList = { Login: undefined; Signup: undefined; AdminHome: undefined; PerformanceSelection: undefined; }; // Simplified for this screen
export default function SignupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState(""); // "admin" or "supervisor"
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const { setAuthData } = useAuth(); // Get setAuthData from context
  const { isMobile } = useResponsive();

  const { modalVisible, modalMsg, modalType, modalTitle, showModal, hideModal } = useFeedbackModal();

  const displayModal = (
    message: string,
    type: "success" | "error",
    title?: string,
    options?: ShowModalOptions
  ) => {
    showModal(message, type, title, options);
  };

  const handleSignup = async () => {
    setErrors({});
    let newErrors: { [key: string]: string } = {};
    if (!firstName.trim()) newErrors.firstName = "Enter first name";
    if (!lastName.trim()) newErrors.lastName = "Enter last name";
    if (!phone.trim()) newErrors.phone = "Enter phone number";
    if (!email.includes("@")) newErrors.email = "Enter a valid email";
    if (password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (!role) newErrors.role = "Select a role";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      // Register user with Firebase Auth REST API
      const authResponse = await signUpWithEmail(email, password);
      const { localId: uid, idToken } = authResponse;

      // Save all info including selected role to Firestore
      await createUserDoc(uid, idToken, {
        role,
        firstName,
        lastName,
        phone,
        email // Add email to the user document
      });

      // Update AuthContext to log the user in immediately
      await setAuthData({
        idToken,
        uid,
        role,
        email,
        firstName,
        lastName,
      });

      // Send Verification Email
      await sendEmailVerification(idToken);
      displayModal(
        "Signup successful! Please check your email to verify your account.",
        "success",
        "Welcome!",
        {
          autoCloseDelay: 2500,
          onCloseCallback: () => {
            // Navigation will be handled by AppNavigator based on auth context change
            // No explicit navigation.replace needed here.
          },
        }
      );
    } catch (e: any) {
      displayModal(getFriendlyErrorMessage(e.message), "error", "Signup Error", { autoClose: false });
    }
    setLoading(false);
  };

  // Conditionally apply styles based on the screen size from our hook
  const containerStyle = isMobile ? styles.containerMobile : styles.containerWeb;
  const formStyle = isMobile ? {} : styles.formWeb;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
    >
      <ScrollView
        style={styles.pageContainer}
        contentContainerStyle={containerStyle}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formContainer, formStyle]}>
          <View style={styles.headerContainer}>
            <Image source={require("@/assets/images/logobgr.png")} style={isMobile ? styles.logoMobile : styles.logoWeb} resizeMode="contain" />
            <Text style={styles.title}>Get Started</Text>
            <Text style={[styles.subtitle, { color: isMobile ? '#A0AEC0' : '#6B7280' }]}>Create your account to continue</Text>
          </View>

          {/* Modern layout for First and Last Name */}
          <View style={!isMobile ? styles.row : {}}>
            <View style={!isMobile ? styles.inputRow : {}}>
              <TextInput
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                style={styles.input}
                mode="outlined"
                dense
                left={<TextInput.Icon icon="account-outline" />}
              />
              {errors.firstName && <Text style={styles.error}>{errors.firstName}</Text>}
            </View>
            {!isMobile && <View style={{ width: 16 }} />}
            <View style={!isMobile ? styles.inputRow : {}}>
              <TextInput
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                style={styles.input}
                mode="outlined"
                dense
                left={<TextInput.Icon icon="account-outline" />}
              />
              {errors.lastName && <Text style={styles.error}>{errors.lastName}</Text>}
            </View>
          </View>

          <TextInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
            mode="outlined"
            dense
            left={<TextInput.Icon icon="phone-outline" />}
          />
          {errors.phone && <Text style={styles.error}>{errors.phone}</Text>}
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            mode="outlined"
            dense
            left={<TextInput.Icon icon="email-outline" />}
          />
          {errors.email && <Text style={styles.error}>{errors.email}</Text>}
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            mode="outlined"
            dense
            left={<TextInput.Icon icon="lock-outline" />}
          />
          {errors.password && <Text style={styles.error}>{errors.password}</Text>}
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={styles.input}
            mode="outlined"
            dense
            left={<TextInput.Icon icon="lock-check-outline" />}
          />
          {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword}</Text>}

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={role}
              onValueChange={(itemValue) => setRole(itemValue)}
              style={[styles.picker, Platform.OS === 'web' && { color: role ? '#000' : '#6e6e6e' }]}
            >
              <Picker.Item label="Choose Role" value="" />
              <Picker.Item label="Admin" value="admin" />
              <Picker.Item label="Supervisor" value="supervisor" />
            </Picker>
          </View>
          {errors.role && <Text style={styles.error}>{errors.role}</Text>}

          <Button
            mode="contained"
            onPress={handleSignup}
            loading={loading}
            style={styles.button} // Use new button styles
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
          >
            Sign Up
          </Button>
          <View style={styles.centerRow}>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={[styles.centerText, { color: isMobile ? '#E2E8F0' : '#1F2937' }]}>
                Already have an account?{' '} <Text style={styles.signInLink}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <FeedbackModal
          visible={modalVisible}
          message={modalMsg}
          type={modalType}
          title={modalTitle}
          onClose={hideModal}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: "#1B263B", // A modern, dark blue
  },
  containerMobile: {
    justifyContent: 'flex-start',
    padding: 24,
    flexGrow: 1, // Ensures the container can scroll if content is long
  },
  containerWeb: {
    flexGrow: 1, // Use flexGrow to allow scrolling and centering
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  formContainer: {
    width: '100%',
  },
  formWeb: {
    maxWidth: 400,
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoMobile: {
    width: 100,
    height: 100,
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: -10,
  },
  logoWeb: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    color: "#1B263B", // Modern black color
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    textAlign: 'center',
  },
  input: { 
    backgroundColor: '#fff', // Ensure input background is white
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputRow: {
    flex: 1,
  },
  button: { 
    marginTop: 16, 
    borderRadius: 8, // Modern rounded corners
    elevation: 2,
  },
  buttonContent: {
    paddingVertical: 6, // Reduced padding for a shorter button
  },
  buttonLabel: {
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 15,
    letterSpacing: 0.5,
  },
  centerRow: { alignItems: 'center', marginTop: 24 },
  centerText: { fontSize: 14 }, // Base style, color is applied conditionally
  signInLink: {
    color: "#7C3AED", // A modern purple color
    fontWeight: "bold",
  },
  error: { 
    color: "#ef4444", // A modern red for errors
    marginTop: -8, // Pull error message closer to the dense input
    marginBottom: 8, 
    marginLeft: 12,
    fontSize: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.54)", // Match react-native-paper's outlined input
    borderRadius: 4, // Match react-native-paper's outlined input
    marginBottom: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
    justifyContent: 'center',
  },
  picker: {
    height: 48, // Reduced height to be more compact
    width: "100%",
    backgroundColor: 'transparent', // Make it transparent to see the container
    borderWidth: 0, // Remove default picker border on some platforms
  },
});