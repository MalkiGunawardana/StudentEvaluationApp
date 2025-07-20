import { FeedbackModal } from '@/components/FeedbackModal';
import { ShowModalOptions, useFeedbackModal } from '@/hooks/useFeedbackModal';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuth } from '@/utils/AuthContext';
import { getUserProfile, signInWithEmail } from '@/utils/firebaseRest';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { setAuthData } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    modalVisible: feedbackModalVisible,
    modalMsg: feedbackModalMsg,
    modalType: feedbackModalType,
    modalTitle: feedbackModalTitle,
    showModal: showFeedbackModalRaw,
    hideModal: hideFeedbackModal,
  } = useFeedbackModal();

  const { isMobile } = useResponsive();

  const displayModal = (
    message: string,
    type: 'success' | 'error' | 'info', // Use the correct type for displayModal
    title?: string,
    options?: ShowModalOptions
  ) => {
    const defaultTitle = type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Information';
    const effectiveTitle = title || defaultTitle;
    showFeedbackModalRaw(message, type, effectiveTitle, { autoClose: type !== 'error', ...options });
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      displayModal('Please enter both email and password.', 'error', 'Input Required');
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate user
      const authResponse = await signInWithEmail(email, password);
      const idToken = authResponse.idToken;
      const uid = authResponse.localId;

      // 2. Fetch user profile to get first and last name, and role
      const userProfile = await getUserProfile(uid, idToken);
      
      // Determine role, with a fallback
      const role = userProfile?.role || 'user'; 

      // 3. Update AuthContext with all necessary data, including firstName and lastName
      await setAuthData({
        idToken,
        uid,
        role,
        email: userProfile?.email || email, // Use email from profile if available, else from input
        firstName: userProfile?.firstName || null,
        lastName: userProfile?.lastName || null,
      });

    } catch (error: any) {
      console.error('Login error:', error);
      displayModal(error.message || 'Login failed. Please check your credentials.', 'error', 'Login Failed', { autoClose: false });
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: isMobile ? '#A0AEC0' : '#6B7280' }]}>Sign in to your account</Text>
          </View>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
            dense
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email-outline" />}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            style={styles.input}
            dense
            secureTextEntry={!isPasswordVisible}
            left={<TextInput.Icon icon="lock-outline" />}
            right={<TextInput.Icon icon={isPasswordVisible ? "eye-off" : "eye"} onPress={() => setIsPasswordVisible(!isPasswordVisible)} />}
          />

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            contentStyle={styles.buttonContent}
          >
            Sign In
          </Button>

          <View style={styles.centerRow}>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={[styles.centerText, { color: isMobile ? '#E2E8F0' : '#1F2937' }]}>
                Don't have an account?{' '} <Text style={styles.signUpLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <FeedbackModal
            visible={feedbackModalVisible}
            message={feedbackModalMsg}
            type={feedbackModalType}
            title={feedbackModalTitle}
            onClose={hideFeedbackModal}
          />
        </View>
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
    justifyContent: "flex-start", // Ensures content starts from the top
    padding: 24, // Overall padding for the screen
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
    color: "#7C3AED",
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
  forgotPasswordContainer: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: '#7C3AED', // Use the modern purple for consistency
    fontWeight: 'bold',
    fontSize: 13,
  },
  button: {
    marginTop: 8,
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
  signUpLink: {
    color: "#7C3AED",
    fontWeight: "bold",
  },
});