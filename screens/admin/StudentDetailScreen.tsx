import React, { useState } from "react";
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, View } from "react-native"; // Removed Alert, Image
import { Avatar, Button, Text } from "react-native-paper";
import BottomNavBar from "../../components/BottomNavBar";
import DesktopSideBar from "../../components/admin/DesktopSideBar";
import { useAuth } from "../../utils/AuthContext";
import { deleteStudent } from "../../utils/firebaseRest";

export default function StudentDetailsScreen({ route, navigation }: any) {
  const { student } = route.params;
  const { auth } = useAuth();
  const isWeb = Platform.OS === 'web';

  // Modal notification state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [modalType, setModalType] = useState<"success" | "error">("success");

  // State for delete confirmation modal
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  // No need for deleteStudentId here as 'student' object is already in scope

  const showModal = (msg: string, type: "success" | "error" = "success", autoClose = true) => {
    setModalMsg(msg);
    setModalType(type);
    setModalVisible(true);
    if (autoClose) {
      setTimeout(() => {
        setModalVisible(false);
        if (type === "success") {
          navigation.goBack();
        }
      }, 1500);
    }
  };

  const openDeleteConfirmModal = () => {
    setDeleteConfirmModalVisible(true);
  };

  const confirmDeleteStudent = async () => {
    setDeleteConfirmModalVisible(false); // Close the confirmation modal first
    try {
      if (!auth.idToken) {
        showModal("Authentication token is missing.", "error", false);
        return;
      }
      await deleteStudent(student.id, auth.idToken);
      showModal("Student deleted successfully!", "success", true); // This will navigate back on success
    } catch (e: any) {
      showModal(e.message || "Failed to delete student.", "error", false);
    }
  };

  // const handleDelete = async () => { // Original Alert.alert based delete
  //   Alert.alert("Delete Student", "Are you sure you want to delete this student?", [
  //     { text: "Cancel", style: "cancel" },
  //     {
  //       text: "Delete", style: "destructive", onPress: confirmDeleteStudent
  //     }
  //   ]);
  // };

  // Helper for initials
  const getInitials = (name: string) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "?";

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <ScrollView style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>{student.fullName}</Text>
            <Text style={styles.webPageSubtitle}>Student Profile Details</Text>
          </View>

          <View style={styles.webCard}>
            <View style={styles.webAvatarContainer}>
              {student.image ? (
                <Avatar.Image source={{ uri: student.image }} size={120} style={styles.avatar} />
              ) : (
                <Avatar.Text size={120} label={getInitials(student.fullName)} style={styles.avatar} />
              )}
            </View>
            <View style={styles.webDetailsGrid}>
              <View style={styles.webDetailsRow}>
                <View style={styles.webDetailsCol}>
                  <Text style={styles.webLabel}>Full Name</Text>
                  <Text style={styles.webValue}>{student.fullName || "-"}</Text>
                </View>
                <View style={styles.webDetailsCol}>
                  <Text style={styles.webLabel}>ID</Text>
                  <Text style={styles.webValue}>{student.indexNo || "-"}</Text>
                </View>
              </View>
              <View style={styles.webDetailsRow}>
                <View style={styles.webDetailsCol}>
                  <Text style={styles.webLabel}>Gender</Text>
                  <Text style={styles.webValue}>{student.gender || "-"}</Text>
                </View>
                <View style={styles.webDetailsCol}>
                  <Text style={styles.webLabel}>Province</Text>
                  <Text style={styles.webValue}>{student.province || "-"}</Text>
                </View>
              </View>
            </View>
            <View style={styles.webButtonRow}>
              <Button mode="contained" onPress={() => navigation.navigate("EditStudent", { student })} style={styles.webButton} buttonColor="#1565c0">
                Edit Student
              </Button>
              <Button mode="outlined" onPress={openDeleteConfirmModal} style={[styles.webButton, styles.webDeleteButton]} textColor="#e53935">
                Delete Student
              </Button>
            </View>
          </View>
        </ScrollView>
        {/* Modals */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalContainer}><View style={styles.modalBox}><Text style={modalType === "error" ? styles.errorTitle : styles.success}>{modalMsg}</Text></View></View>
        </Modal>
        <Modal visible={deleteConfirmModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalBox}>
              <Text style={styles.deleteModalTitle}>Delete Student</Text>
              <Text style={styles.deleteModalMessage}>Are you sure you want to delete this student?</Text>
              <View style={styles.modalButtonRow}><Button mode="outlined" onPress={() => setDeleteConfirmModalVisible(false)} style={styles.modalButton}>Cancel</Button><Button mode="contained" onPress={confirmDeleteStudent} style={[styles.modalButton, styles.modalDeleteButton]}>Delete</Button></View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5faff" }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            {student.image ? (
              <Avatar.Image source={{ uri: student.image }} size={100} style={styles.avatar} />
            ) : (
              <Avatar.Text
                size={100}
                label={getInitials(student.fullName)}
                style={styles.avatar}
              />
            )}
          </View>
          {/* Row 1 */}
          <View style={styles.detailsRow}>
            <View style={styles.detailsCol}>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Full Name</Text>
                <Text style={styles.value}>{student.fullName || "-"}</Text>
              </View>
            </View>
            <View style={styles.detailsCol}>
              <View style={styles.detailItem}>
                <Text style={styles.label}>ID</Text>
                <Text style={styles.value}>{student.indexNo || "-"}</Text>
              </View>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.detailsRow}>
            <View style={styles.detailsCol}>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Gender</Text>
                <Text style={styles.value}>{student.gender || "-"}</Text>
              </View>
            </View>
            <View style={styles.detailsCol}>
              <View style={styles.detailItem}>
                <Text style={styles.label}>Province</Text>
                <Text style={styles.value}>{student.province || "-"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              style={styles.button}
              buttonColor="#1565c0"
              onPress={() => navigation.navigate("EditStudent", { student })}
            >
              Edit
            </Button>
            <Button
              mode="contained"
              style={styles.button}
              buttonColor="#e53935"
              onPress={openDeleteConfirmModal} // Changed to open custom modal
            >
              Delete
            </Button>
          </View>
        </View>
      </ScrollView>
      {/* Modal notification */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={modalType === "error" ? styles.errorTitle : styles.success}>{modalMsg}</Text>
          </View>
        </View>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal visible={deleteConfirmModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={styles.deleteModalTitle}>Delete Student</Text>
            <Text style={styles.deleteModalMessage}>Are you sure you want to delete this student?</Text>
            <View style={styles.modalButtonRow}>
              <Button mode="outlined" onPress={() => setDeleteConfirmModalVisible(false)} style={styles.modalButton}>
                Cancel
              </Button>
              <Button mode="contained" onPress={confirmDeleteStudent} style={[styles.modalButton, styles.modalDeleteButton]}>
                Delete
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40, paddingBottom: 80 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    width: "92%",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarContainer: { alignItems: "center", marginBottom: 18 },
  avatar: { backgroundColor: "#90caf9" },
  detailsRow: { flexDirection: "row", width: "100%", marginTop: 8, marginBottom: 18 },
  detailsCol: { flex: 1, paddingHorizontal: 8 },
  detailItem: { marginBottom: 12 },
  label: { fontWeight: "bold", fontSize: 15, color: "#1565c0" },
  value: { fontSize: 15, color: "#222", marginTop: 2 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 10 },
  button: { flex: 1, marginHorizontal: 8, marginTop: 8 },
  modalContainer: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 250, maxWidth: 340, marginHorizontal: 16, elevation: 5,
  },
  errorTitle: { color: "red", fontWeight: "bold", fontSize: 18, textAlign: "center", marginBottom: 6 },
  success: { color: "green", fontWeight: "bold", fontSize: 16, textAlign: "center" },
  // Styles for Delete Confirmation Modal (similar to AddEventScreen)
  deleteModalTitle: { fontWeight: "bold", fontSize: 18, marginBottom: 12, color: "#333" },
  deleteModalMessage: { marginBottom: 20, fontSize: 15, textAlign: 'center', color: "#555" },
  modalButtonRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 16 },
  modalButton: { flex: 1, marginHorizontal: 8 },
  modalDeleteButton: { backgroundColor: "#e53935" },
  // Web-specific styles
  webContainer: { flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' },
  webMainContent: { flex: 1, padding: 32 },
  webHeader: { marginBottom: 32 },
  webPageTitle: { fontSize: 32, fontWeight: 'bold', color: '#1A202C' },
  webPageSubtitle: { fontSize: 16, color: '#718096', marginTop: 4 },
  webCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxWidth: 700, // Set a max-width for the card
    width: '100%',   // Ensure it takes up available width up to max-width
    alignSelf: 'center', // Center the card within the main content area
  },
  webAvatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  webDetailsGrid: {
    width: '100%',
  },
  webDetailsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  webDetailsCol: {
    flex: 1,
    paddingHorizontal: 8,
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
    justifyContent: 'center',
    marginTop: 16,
  },
  webButton: { marginRight: 16 },
  webDeleteButton: { borderColor: '#e53935' },
});