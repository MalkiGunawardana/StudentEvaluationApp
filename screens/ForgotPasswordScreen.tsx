import { FeedbackModal } from "@/components/FeedbackModal";
import { ShowModalOptions, useFeedbackModal } from "@/hooks/useFeedbackModal";
import { useResponsive } from "@/hooks/useResponsive";
import { getFriendlyErrorMessage } from "@/utils/errorUtils";
import { sendPasswordReset } from "@/utils/firebaseRest";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { AuthStackParamList } from "../navigation/types";

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null); // For inline email error
  const [loading, setLoading] = useState(false);

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

  const handleReset = async () => {
    setError(null); // Clear previous inline error
    if (!email.includes("@")) {
      setError("Enter a valid email"); // Show inline error
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email);
      displayModal("Password reset email sent! Please check your inbox.", "success", "Email Sent", {
        onCloseCallback: () => navigation.navigate("Login"),
      });
    } catch (e: any) {
      // For API errors, use the modal
      displayModal(getFriendlyErrorMessage(e.message), "error", "Error", { autoClose: false });
    }
    setLoading(false);
  };

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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: isMobile ? '#A0AEC0' : '#6B7280' }]}>Enter your email to receive a reset link</Text>
          </View>

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
            disabled={loading || modalVisible}
            error={!!error}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            mode="contained"
            onPress={handleReset}
            loading={loading}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
            disabled={loading || modalVisible}
          >
            Send Reset Email
          </Button>

          <View style={styles.centerRow}>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={[styles.centerText, { color: isMobile ? '#E2E8F0' : '#1F2937' }]}>
                Back to{' '} <Text style={styles.signInLink}>Sign In</Text>
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
    backgroundColor: "#1B263B",
  },
  containerMobile: {
    justifyContent: 'flex-start',
    padding: 24,
    flexGrow: 1,
  },
  containerWeb: {
    flexGrow: 1,
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
    color: "#111827",
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    textAlign: 'center',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
    elevation: 2,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  centerRow: {
    alignItems: "center",
    marginTop: 24,
  },
  centerText: {
    fontSize: 14,
  },
  signInLink: {
    color: "#7C3AED",
    fontWeight: "bold",
  },
  error: {
    color: "#ef4444",
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 12,
    fontSize: 12,
  },
});