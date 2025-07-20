import { Picker } from "@react-native-picker/picker";
import React, { useState } from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, View } from "react-native"; // Removed Modal
import { Avatar, Button, Text, TextInput } from "react-native-paper";
import DesktopSideBar from "../../components/admin/DesktopSideBar";
import BottomNavBar from "../../components/BottomNavBar";
import { FeedbackModal } from "../../components/FeedbackModal"; // Import FeedbackModal
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal"; // Import useFeedbackModal
import { useAuth } from "../../utils/AuthContext";
import { updateStudent } from "../../utils/firebaseRest"; // Removed fetchBatches

const provinces = [
  "Central", "Eastern", "Northern", "Southern", "Western", "North Western", "North Central", "Uva", "Sabaragamuwa"
];
const genders = ["Male", "Female", "Other"];

export default function EditStudentScreen({ route, navigation }: any) {
  const { student } = route.params;
  const { auth } = useAuth();
  const isWeb = Platform.OS === 'web';

  const [fullName, setFullName] = useState(student.fullName);
  const [indexNo, setIndexNo] = useState(student.indexNo);
  // const [batch, setBatch] = useState(student.batch); // Batch functionality removed
  const [gender, setGender] = useState(student.gender || "");
  // const [phone, setPhone] = useState(student.phone); // Phone field removed
  const [province, setProvince] = useState(student.province);
  const [image, setImage] = useState(student.image);

  // const [batches, setBatches] = useState<string[]>([]); // Batch functionality removed
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Use the centralized feedback modal
  const { modalVisible, modalMsg, modalType, modalTitle, showModal, hideModal } = useFeedbackModal();

  const displayModal = (message: string, type: "success" | "error", title?: string, options?: ShowModalOptions) => {
    showModal(message, type, title, options);
  };

  // useEffect(() => { // Batch functionality removed
  //   const loadBatches = async () => {
  //     if (auth.idToken) {
  //       const batchList = await fetchBatches(auth.idToken);
  //       setBatches(batchList);
  //     }
  //   };
  //   loadBatches();
  // }, [auth.idToken]);

  const handleSave = async () => {
    setErrors({});
    let newErrors: { [key: string]: string } = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required";
    if (!indexNo.trim()) newErrors.indexNo = "Index number is required";
    // if (!batch) newErrors.batch = "Batch is required"; // Batch functionality removed
    if (!gender) newErrors.gender = "Gender is required";
    // if (!phone.trim()) newErrors.phone = "Phone number is required"; // Phone field removed
    if (!province) newErrors.province = "Province is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      if (!auth.idToken) {
        displayModal("Authentication error. Please log in again.", "error", "Auth Error", { autoClose: false });
        return;
      }
      await updateStudent(
        student.id,
        {
          fullName,
          indexNo,
          // batch, // Batch functionality removed
          gender,
          //birthday: "", // keep for compatibility, but not used
          phone: "", // Phone field removed, send empty or remove from payload
          province,
          image: image || "",
        },
        auth.idToken
      );
      displayModal("Student updated successfully!", "success", "Success", {
        autoCloseDelay: 1500,
        onCloseCallback: () => {
          navigation.navigate("StudentList"); // Navigate to StudentListScreen
        },
      });
    } catch (e: any) {
      displayModal(e.message || "Failed to update student.", "error", "Update Error", { autoClose: false });
    }
  };

  const getInitials = (name: string) => name ? name.split(" ").map((n) => n[0]).join("").toUpperCase() : "?";

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <ScrollView style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Edit Student</Text>
            <Text style={styles.webPageSubtitle}>Update details for {student.fullName}</Text>
          </View>

          <View style={styles.webFormContainer}>
            <View style={styles.webAvatarContainer}>
              {image ? (
                <Avatar.Image source={{ uri: image }} size={100} style={styles.avatar} />
              ) : (
                <Avatar.Text size={100} label={getInitials(fullName)} style={styles.avatar} />
              )}
            </View>

            <TextInput
              label="ID"
              value={indexNo}
              onChangeText={setIndexNo}
              style={styles.input}
              mode="outlined"
              error={!!errors.indexNo}
              left={<TextInput.Icon icon="identifier" />}
            />
            {errors.indexNo ? <Text style={styles.error}>{errors.indexNo}</Text> : null}

            <TextInput
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
              mode="outlined"
              error={!!errors.fullName}
              left={<TextInput.Icon icon="account" />}
            />
            {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}

            <Text style={styles.webLabel}>Gender</Text>
            <View style={[styles.pickerContainer, errors.gender ? styles.errorBorder : {}]}>
              <Picker selectedValue={gender} onValueChange={setGender} style={styles.picker}>
                <Picker.Item label="Select Gender" value="" />
                {genders.map((g) => (<Picker.Item key={g} label={g} value={g} />))}
              </Picker>
            </View>
            {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}

            <Text style={styles.webLabel}>Province</Text>
            <View style={[styles.pickerContainer, errors.province ? styles.errorBorder : {}]}>
              <Picker selectedValue={province} onValueChange={setProvince} style={styles.picker}>
                <Picker.Item label="Select Province" value="" />
                {provinces.map((prov) => (<Picker.Item key={prov} label={prov} value={prov} />))}
              </Picker>
            </View>
            {errors.province ? <Text style={styles.error}>{errors.province}</Text> : null}

            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.button}
              buttonColor="#1565c0"
            >
              Save Changes
            </Button>
          </View>
        </ScrollView>
        <FeedbackModal visible={modalVisible} message={modalMsg} type={modalType} title={modalTitle} onClose={hideModal} />
      </View>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5faff" }}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            {image ? (
              <Avatar.Image source={{ uri: image }} size={100} style={styles.avatar} />
            ) : (
              <Avatar.Text
                size={100}
                label={fullName ? fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase() : "?"}
                style={styles.avatar}
              />
            )}
          </View>
          <TextInput
            label="ID"
            value={indexNo}
            onChangeText={setIndexNo}
            style={styles.input}
            mode="outlined"
            error={!!errors.indexNo}
          />
          {errors.indexNo ? <Text style={styles.error}>{errors.indexNo}</Text> : null}

          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            mode="outlined"
            error={!!errors.fullName}
          />
          {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}

          {/* <View style={styles.pickerContainer}>
            <Picker
              selectedValue={batch}
              onValueChange={setBatch}
              style={styles.picker}
            >
              <Picker.Item label="Select Batch" value="" />
              {batches.map((b) => (
                <Picker.Item key={b} label={b} value={b} />
              ))}
            </Picker>
          </View> */}
          {/* {errors.batch ? <Text style={styles.error}>{errors.batch}</Text> : null} */}

          {/* Gender Dropdown */}
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={gender}
              onValueChange={setGender}
              style={styles.picker}
            >
              <Picker.Item label="Select Gender" value="" />
              {genders.map((g) => (
                <Picker.Item key={g} label={g} value={g} />
              ))}
            </Picker>
          </View>
          {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}

          {/* <TextInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            mode="outlined"
            error={!!errors.phone}
            keyboardType="phone-pad"
          /> */}
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={province}
              onValueChange={setProvince}
              style={styles.picker}
            >
              <Picker.Item label="Select Province" value="" />
              {provinces.map((prov) => (
                <Picker.Item key={prov} label={prov} value={prov} />
              ))}
            </Picker>
          </View>
          {errors.province ? <Text style={styles.error}>{errors.province}</Text> : null}
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              style={[styles.button, { backgroundColor: "#1565c0" }]}
              onPress={handleSave}
            >
              Save
            </Button>
            <Button
              mode="outlined"
              style={[styles.button, { borderColor: "#888" }]}
              onPress={() => navigation.goBack()}
            >
              Cancel
            </Button>
          </View>
        </View>
      </ScrollView>
      {/* Modal notification */}
      <FeedbackModal
        visible={modalVisible}
        message={modalMsg}
        type={modalType}
        title={modalTitle}
        onClose={hideModal}
      />
      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingTop: 40, paddingBottom: 80 }, // Adjusted paddingBottom
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
  input: { width: "100%", marginBottom: 12, backgroundColor: "#fff" },
  pickerContainer: { width: "100%", borderWidth: 1, borderColor: "#bbb", borderRadius: 8, marginBottom: 12, backgroundColor: "#fff", overflow: "hidden", justifyContent: 'center' }, // Added justifyContent
  picker: { height: 48, width: "100%", color: '#333' }, // Ensure selected item text (including placeholder) is visible
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
  error: { color: "red", marginBottom: 2, marginLeft: 4, textAlign: "left", fontSize: 14 },
  // Web-specific styles
  webContainer: { flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' },
  webMainContent: { flex: 1, padding: 32 },
  webHeader: { marginBottom: 32 },
  webPageTitle: { fontSize: 32, fontWeight: 'bold', color: '#1A202C' },
  webPageSubtitle: { fontSize: 16, color: '#718096', marginTop: 4 },
  webFormContainer: {
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
  webAvatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  webLabel: { fontSize: 14, color: '#4A5568', marginBottom: 4, marginTop: 8 },
  errorBorder: { borderColor: 'red' },
});