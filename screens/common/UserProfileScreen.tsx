import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, Button, IconButton, Text, TextInput } from 'react-native-paper';
import DesktopSideBar from '../../components/admin/DesktopSideBar';
import BottomNavBar from '../../components/BottomNavBar';
import { FeedbackModal } from '../../components/FeedbackModal';
import { ShowModalOptions, useFeedbackModal } from '../../hooks/useFeedbackModal';
import { useAuth } from '../../utils/AuthContext';
import { getUserProfile, updateAuthUserProfile, updateUserName, updateUserProfilePicture, UserProfile as UserProfileType } from '../../utils/firebaseRest';

// Cloudinary config (ensure these are correct for your Cloudinary account)
const CLOUDINARY_UPLOAD_PRESET = "GradeMaster"; 
const CLOUDINARY_CLOUD_NAME = "dfucm33vd";    

// Re-declaring UserProfile interface locally if not directly importing UserProfileType everywhere
interface UserProfile extends UserProfileType {}

const BOTTOM_NAV_BAR_FIXED_HEIGHT = 60; 

export default function UserProfileScreen({ navigation }: any) {
  const authContext = useAuth(); 
  const isWeb = Platform.OS === 'web';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  const [uploadingPicture, setUploadingPicture] = useState(false);

  const {
    modalVisible: notificationModalVisible,
    modalMsg: notificationMsg,
    modalType: notificationType, 
    modalTitle: notificationTitle,
    showModal: showNotificationModal,
    hideModal: hideNotificationModal
  } = useFeedbackModal();

  const displayNotification = useCallback(
    (message: string, type: "success" | "error", title?: string, options?: ShowModalOptions) => {
      showNotificationModal(message, type, title, options);
    },
    [showNotificationModal] 
  );

  const safeText = (text?: string | null): string => {
    const str = String(text || '').trim(); 
    if (str === '' || str === '.') {
      return 'N/A'; 
    }
    return str;
  };

  if (!authContext || !authContext.auth) {
    useEffect(() => {
      console.error("UserProfileScreen: AuthContext or authContext.auth is not available.");
    }, []); 

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredLoader}>
          <Text style={{ textAlign: 'center', fontSize: 16, color: '#555' }}>
            Authentication service is initializing or unavailable. Please wait or restart the app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { auth } = authContext; 
  const { idToken, uid } = auth; 

  useEffect(() => {
    const fetchProfile = async () => {
      if (!idToken || !uid) {
        displayNotification("Authentication error. Please log in again.", "error", "Auth Error", { autoClose: false });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const userProfile = await getUserProfile(uid, idToken); // No need to cast if UserProfileType is used
        if (userProfile) {
          setProfile(userProfile);
          setNewFirstName(userProfile.firstName || '');
          setNewLastName(userProfile.lastName || '');
        } else {
          setProfile({ 
            firstName: '', lastName: '', 
            email: auth.email || 'N/A', 
            role: 'N/A' 
          }); 
          setNewFirstName('');
          setNewLastName('');
          displayNotification("User profile data not found. Please update your details.", "error", "Profile Missing", { autoClose: false });
        }
      } catch (error: any) {
        displayNotification("Failed to load profile: " + safeText(error.message), "error", "Load Error", { autoClose: false });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [idToken, uid, displayNotification, auth.email]); 

  const handleSaveName = async () => {
    if (!idToken || !uid) {
      displayNotification("Authentication error. Cannot save name.", "error", "Auth Error", { autoClose: false });
      return;
    }
    if (!newFirstName.trim() || !newLastName.trim()) {
      displayNotification("First name and last name cannot be empty.", "error", "Input Error");
      return;
    }

    setSavingName(true);
    try {
      await updateAuthUserProfile(idToken, { displayName: `${newFirstName.trim()} ${newLastName.trim()}` });
      await updateUserName(uid, newFirstName.trim(), newLastName.trim(), idToken);
      setProfile(prev => prev ? { ...prev, firstName: newFirstName.trim(), lastName: newLastName.trim() } : null);
      setIsEditingName(false);
      displayNotification("Name updated successfully!", "success", "Update Success");
    } catch (error: any) {
      displayNotification("Failed to update name: " + safeText(error.message), "error", "Update Error", { autoClose: false });
    } finally { 
      setSavingName(false);
    }
  };

  const handlePickImage = async () => {
    if (!idToken || !uid) {
      displayNotification("Authentication error. Cannot upload picture.", "error", "Auth Error", { autoClose: false });
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      displayNotification('Permission to access media library is required!', 'error', "Permission Denied");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, 
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setUploadingPicture(true);
      displayNotification("Uploading profile picture...", "success", "Uploading", { autoClose: false });
      try {
        const data = new FormData();
        if (isWeb) {
          const response = await fetch(uri);
          const blob = await response.blob();
          data.append("file", blob, "profile.jpg");
        } else {
          data.append("file", { uri, type: "image/jpeg", name: "profile.jpg" } as any);
        }

        data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: data,
        });
        const cloudinaryFile = await cloudinaryResponse.json();

        if (cloudinaryFile.secure_url) {
          const downloadURL = cloudinaryFile.secure_url;
          await updateUserProfilePicture(uid, downloadURL, idToken);
          await updateAuthUserProfile(idToken, { photoUrl: downloadURL });
          setProfile(prev => prev ? { ...prev, profilePictureUrl: downloadURL } : null);
          displayNotification("Profile picture updated successfully!", "success", "Upload Complete");
        } else {
          throw new Error(cloudinaryFile.error?.message || "Cloudinary upload failed");
        }
      } catch (error: any) {
        console.error("Profile picture upload error:", error); 
        displayNotification("Failed to upload picture: " + safeText(error.message), "error", "Upload Error", { autoClose: false });
      } finally {
        setUploadingPicture(false);
      }
    }
  };

  const isValidHttpUrl = (string?: string): boolean => {
    if (!string) return false;
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
  };

  const capitalizeRole = (role?: string): string => {
    if (!role || role.toLowerCase() === 'n/a') return 'N/A'; 
    if (role.toLowerCase() === 'admin') return 'Admin'; 
    if (role.toLowerCase() === 'supervisor') return 'Supervisor';
    return role.charAt(0).toUpperCase() + role.slice(1); 
  };

  const handleLogout = () => {
    setLogoutConfirmVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutConfirmVisible(false);
    try {
      if (typeof authContext.logout !== 'function') {
        displayNotification("Logout service is currently unavailable. Please try again later.", "error", "Logout Error", { autoClose: false });
        console.error("UserProfileScreen: authContext.logout method is not a function.", authContext);
        return;
      }
      await authContext.logout();
      displayNotification("You have been logged out.", "success", "Logged Out");
    } catch (error: any) {
      displayNotification("Logout failed: " + safeText(error.message), "error", "Logout Error", { autoClose: false });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color="#1565c0" />
          <Text style={{ marginTop: 10, fontSize: 16, color: '#555' }}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <ScrollView style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>User Profile</Text>
            <Text style={styles.webPageSubtitle}>Manage your profile details</Text>
          </View>

          <View style={styles.webCard}>
            <TouchableOpacity onPress={handlePickImage} disabled={uploadingPicture} style={styles.webAvatarButton}>
              <View style={styles.avatarWrapper}>
                {uploadingPicture ? (
                  <View style={styles.avatarPlaceholder}>
                    <ActivityIndicator size="large" color="#1565c0" />
                  </View>
                ) : (
                  <Avatar.Image
                    size={120}
                    source={isValidHttpUrl(profile?.profilePictureUrl)
                      ? { uri: profile!.profilePictureUrl }
                      : require('../../assets/images/profile.png')}
                    style={styles.avatarImage}
                  />
                )}
                {!uploadingPicture && (
                  <View style={styles.webProfileEditOverlay}>
                    <IconButton
                      icon="pencil"
                      iconColor="#fff"
                      size={20}
                      onPress={handlePickImage}
                      disabled={uploadingPicture}
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {isEditingName ? (
              <View style={styles.webFormSection}>
                <TextInput
                  label="First Name"
                  value={newFirstName}
                  onChangeText={setNewFirstName}
                  mode="outlined"
                  style={styles.input}
                  disabled={savingName}
                />
                <TextInput
                  label="Last Name"
                  value={newLastName}
                  onChangeText={setNewLastName}
                  mode="outlined"
                  style={styles.input}
                  disabled={savingName}
                />
                <View style={styles.webButtonRow}>
                  <Button mode="outlined" onPress={() => setIsEditingName(false)} disabled={savingName} style={{ marginRight: 16 }}>Cancel</Button>
                  <Button mode="contained" onPress={handleSaveName} loading={savingName} disabled={savingName} buttonColor="#1565c0">Save</Button>
                </View>
              </View>
            ) : (
              <View style={styles.webDetailsSection}>
                <View style={styles.webDetailItem}>
                  <Text style={styles.webLabel}>Name</Text>
                  <View style={styles.profileDetailRow}>
                    <Text style={styles.webValue}>{profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : (profile?.firstName || 'N/A')}</Text>
                    <IconButton icon="pencil" size={20} iconColor="#6c757d" onPress={() => setIsEditingName(true)} style={styles.inlineEditIcon} />
                  </View>
                </View>
                <View style={styles.webDetailItem}>
                  <Text style={styles.webLabel}>Email</Text>
                  <Text style={styles.webValue}>{safeText(profile?.email && profile.email !== 'N/A' ? profile.email : (auth.email || 'N/A'))}</Text>
                </View>
                <View style={styles.webDetailItem}>
                  <Text style={styles.webLabel}>Role</Text>
                  <Text style={styles.webValue}>{capitalizeRole(profile?.role)}</Text>
                </View>
              </View>
            )}

            <View style={styles.webLogoutButtonContainer}>
              <Button mode="contained" onPress={handleLogout} style={styles.logoutButton} icon="logout" buttonColor="#c62828">
                Logout
              </Button>
            </View>
          </View>
        </ScrollView>
        <FeedbackModal visible={notificationModalVisible} message={safeText(notificationMsg)} type={notificationType} title={notificationTitle} onClose={hideNotificationModal} />
        {/* Logout Confirmation Modal for Web */}
        <Modal visible={logoutConfirmVisible} transparent animationType="fade" onRequestClose={() => setLogoutConfirmVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalBox}>
              <Text style={styles.deleteModalTitle}>Logout</Text>
              <Text style={styles.deleteModalMessage}>Are you sure you want to logout?</Text>
              <View style={styles.modalButtonRow}><Button mode="outlined" onPress={() => setLogoutConfirmVisible(false)} style={styles.modalButton}>Cancel</Button><Button mode="contained" onPress={confirmLogout} style={[styles.modalButton, { backgroundColor: '#c62828' }]}>Logout</Button></View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_BAR_FIXED_HEIGHT + 20 }} 
      >
        <FeedbackModal
          visible={notificationModalVisible}
          message={safeText(notificationMsg)} 
          type={notificationType} 
          title={notificationTitle}
          onClose={hideNotificationModal}
        />

        <View style={styles.profilePictureContainer}>
          <TouchableOpacity onPress={handlePickImage} disabled={uploadingPicture}>
            <View style={styles.avatarWrapper}> 
              {uploadingPicture ? (
                <View style={styles.avatarPlaceholder}>
                  <ActivityIndicator size="large" color={styles.editIcon.color} />
                </View>
              ) : (
                <Avatar.Image
                  size={120}
                  source={isValidHttpUrl(profile?.profilePictureUrl)
                            ? { uri: profile!.profilePictureUrl } 
                            : require('../../assets/images/profile.png')}
                  style={styles.avatarImage}
                />
              )}
              {!uploadingPicture && (
                <IconButton
                  icon="pencil"
                  style={styles.profileEditIcon}
                  iconColor={styles.editIcon.color}
                  size={20}
                  onPress={handlePickImage}
                  disabled={uploadingPicture}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Name</Text>
          <View style={styles.nameSectionContentContainer}> 
            {isEditingName ? (
              <View>
                <View> 
                  <TextInput
                    label="First Name"
                    value={newFirstName}
                    onChangeText={setNewFirstName}
                    mode="outlined"
                    dense
                    style={styles.input}
                    disabled={savingName}
                  />
                  <TextInput
                    label="Last Name"
                    value={newLastName}
                    onChangeText={setNewLastName}
                    mode="outlined"
                    dense
                    style={styles.input}
                    disabled={savingName}
                  />
                  <View style={styles.buttonRow}>
                    <Button mode="outlined" onPress={() => setIsEditingName(false)} disabled={savingName} style={{ marginRight: 10 }}>Cancel</Button>
                    <Button mode="contained" onPress={handleSaveName} loading={savingName} disabled={savingName}>Save Name</Button>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.profileDetailRow}>
                  <Text style={styles.profileDetailText}>
                    {profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : (profile?.firstName || 'N/A')}
                  </Text>
                  <IconButton
                    icon="pencil"
                    size={20}
                    iconColor={styles.editIcon.color}
                    onPress={() => setIsEditingName(true)}
                    style={styles.inlineEditIcon}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

         <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email</Text>
           <Text style={styles.profileDetailText}>
            {safeText(profile?.email && profile.email !== 'N/A' ? profile.email : (auth.email || 'N/A'))}
           </Text>
        </View>

         <View style={styles.section}>
          <Text style={styles.sectionTitle}>Role</Text>
           <Text style={styles.profileDetailText}>{capitalizeRole(profile?.role)}</Text>
        </View>

        {/* Button to navigate to Performance Selection - Commented out as per request
        <Button
          mode="outlined" // Changed to outlined
          onPress={() => navigation.navigate('PerformanceSelection')}
          style={styles.performanceButton}
          icon="format-list-bulleted-type" // Example icon
          labelStyle={styles.performanceButtonLabel} // Added for text color
        >
          Select Performance Type
        </Button>
        */}
        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          icon="logout"
        >
          Logout
        </Button>

      </ScrollView>
      <BottomNavBar navigation={navigation} />

      {/* Logout Confirmation Modal for Mobile */}
      <Modal visible={logoutConfirmVisible} transparent animationType="fade" onRequestClose={() => setLogoutConfirmVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={styles.deleteModalTitle}>Logout</Text>
            <Text style={styles.deleteModalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtonRow}>
              <Button mode="outlined" onPress={() => setLogoutConfirmVisible(false)} style={styles.modalButton}>Cancel</Button>
              <Button mode="contained" onPress={confirmLogout} style={[styles.modalButton, { backgroundColor: '#c62828' }]}>Logout</Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5faff' },
  container: { flex: 1, padding: 20 },
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20, 
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  nameSectionContentContainer: {
    minHeight: 160, 
    justifyContent: 'center', 
  },
  avatarWrapper: { 
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: { 
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    backgroundColor: '#e0e0e0',
  },
  profileEditIcon: {
    position: 'absolute', 
    right: -15, 
    bottom: -15, 
    backgroundColor: 'rgba(245, 250, 255, 0.9)', 
    borderRadius: 15, 
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  profileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineEditIcon: {
    margin: 0, 
  },
  profileDetailText: {
    fontSize: 16,
    color: '#333',
    flex: 1, 
    marginRight: 10, 
  },
  input: {
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  editIcon: { 
    color: '#757575', 
  },
  performanceButton: {
    marginTop: 15,
    marginBottom: 15, // Space before logout button
    // backgroundColor: '#00796b', // Removed background for outlined style
    borderColor: '#1565c0', // Blue border color
    borderWidth: 1.5, // Standard border width for outlined buttons
    paddingVertical: 8,
    borderRadius: 8,
  },
  performanceButtonLabel: { // Style for the button text
    color: '#1565c0', // Blue text color
  },
  logoutButton: {
    marginTop: 15, 
    backgroundColor: '#c62828', 
    paddingVertical: 8,
    borderRadius: 8,
  },
  // Web-specific styles
  webContainer: { flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' },
  webMainContent: { flex: 1, padding: 32 },
  webHeader: { marginBottom: 32 },
  webPageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A202C',
  },
  webPageSubtitle: {
    fontSize: 16,
    color: '#718096',
    marginTop: 4,
  },
  webCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  webAvatarButton: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  webProfileEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
  },
  webFormSection: {
    width: '100%',
  },
  webDetailsSection: {
    width: '100%',
  },
  webDetailItem: {
    marginBottom: 24,
  },
  webLabel: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '600',
    marginBottom: 4,
  },
  webValue: {
    fontSize: 18,
    color: '#1A202C',
  },
  webButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  webLogoutButtonContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 32,
    paddingTop: 24,
    alignItems: 'center',
  },
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 250, maxWidth: 340, marginHorizontal: 16, elevation: 5 },
  deleteModalTitle: { fontWeight: "bold", fontSize: 18, marginBottom: 12, color: "#333" },
  deleteModalMessage: { marginBottom: 20, fontSize: 15, textAlign: 'center', color: "#555" },
  modalButtonRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 16, gap: 16 },
  modalButton: { flex: 1 },
});