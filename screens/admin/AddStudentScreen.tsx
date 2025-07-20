import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react"; // Removed useEffect
import { ActivityIndicator, Image, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import DesktopSideBar from "../../components/admin/DesktopSideBar";
import BottomNavBar from "../../components/BottomNavBar";
import { FeedbackModal } from "../../components/FeedbackModal"; // Import FeedbackModal
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal"; // Import useFeedbackModal
import { useAuth } from "../../utils/AuthContext";
import { addStudent } from "../../utils/firebaseRest";

// Cloudinary config (replace with your values)
const CLOUDINARY_UPLOAD_PRESET = "GradeMaster";
const CLOUDINARY_CLOUD_NAME = "dfucm33vd";

const provinces = [
  "Central", "Eastern", "Northern", "Southern", "Western", "North Western", "North Central", "Uva", "Sabaragamuwa"
];

const genders = ["Male", "Female", "Other"];

export default function AddStudentScreen({ navigation }: any) {
  const { auth } = useAuth();
  const isWeb = Platform.OS === 'web';
  const [fullName, setFullName] = useState("");
  const [indexNo, setIndexNo] = useState("");
  const [gender, setGender] = useState("");
  // const [phone, setPhone] = useState(""); // Phone field removed
  const [province, setProvince] = useState("");
  // const [batch, setBatch] = useState(""); // Batch part commented out
  // const [batches, setBatches] = useState<string[]>([]); // Batch part commented out
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Field-wise errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Use the centralized feedback modal
  const { modalVisible, modalMsg, modalType, modalTitle, showModal, hideModal } = useFeedbackModal();

  const displayModal = (message: string, type: "success" | "error", title?: string, options?: ShowModalOptions) => {
    showModal(message, type, title, options);
  };

  // Fetch batches on mount
  // useEffect(() => { // Batch part commented out
  //   const loadBatches = async () => {
  //     if (!auth.idToken) return;
  //     try {
  //       const batchList = await fetchBatches(auth.idToken);
  //       setBatches(batchList);
  //     } catch {
  //       setBatches([]);
  //     }
  //   };
  //   loadBatches();
  // }, [auth.idToken]);

  // Image picker and upload to Cloudinary
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      uploadToCloudinary(result.assets[0].uri);
    }
  };

  const uploadToCloudinary = async (uri: string) => {
    setUploading(true);
    try {
      const data = new FormData();
      if (Platform.OS === 'web') {
        // On web, we need to fetch the blob from the URI
        const response = await fetch(uri);
        const blob = await response.blob();
        data.append("file", blob, "student.jpg");
      } else {
        // On mobile, the { uri, type, name } object is sufficient
        data.append("file", {
          uri,
          type: "image/jpeg",
          name: "student.jpg",
        } as any);
      }
      data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: data,
      });
      const file = await res.json();
      if (file.secure_url) {
        setImage(file.secure_url);
      } else {
        displayModal("Image upload failed.", "error", "Upload Error", { autoClose: false });
      }
    } catch (e: any) {
      displayModal(e.message || "Image upload failed.", "error", "Upload Error", { autoClose: false });
    }
    setUploading(false);
  };

  // Save student (add to Firestore)
  const handleSave = async () => {
    setErrors({});
    let newErrors: { [key: string]: string } = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required";
    if (!indexNo.trim()) newErrors.indexNo = "Index number is required";
    // if (!batch) newErrors.batch = "Batch is required"; // Batch part commented out
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
      await addStudent(
        {
          fullName,
          indexNo,
          //batch: "N/A", // Default batch or handle as needed since it's removed from UI
          //birthday: "", // Not used, but keep for compatibility
          gender,
          phone: "", // Phone field removed, send empty or remove from payload
          province,
          image: image || "",
        },
        auth.idToken
      );
      setFullName("");
      setIndexNo("");
      // setBatch(""); // Batch part commented out
      setGender("");
      // setPhone(""); // Phone field removed
      setProvince("");
      setImage(null);
      displayModal("Student added successfully!", "success", "Success", {
        autoCloseDelay: 1500,
        onCloseCallback: () => {
          // Use navigation.popToTop() as a potentially more reliable way
          // to return to the root of the stack (AdminHome) after modal closes.
          // This clears all screens above the root.
          navigation.popToTop();
        }
      });
    } catch (e: any) {
      displayModal(e.message || "Failed to save student.", "error", "Save Error", { autoClose: false });
    }
  };

  // Top shape and bar with logo, title, subtitle
  const TopShape = () => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Create Student</Text>
            <Text style={styles.pageSubtitle}>Add student details here</Text>
          </View>
          <Image
            source={require("../../assets/images/logobgr.png")}
            style={styles.topBarLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <ScrollView style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Create Student</Text>
            <Text style={styles.webPageSubtitle}>Add student details here</Text>
          </View>

          <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.imageUploadButton}>
            <View style={styles.imageUploadContainer}>
              {uploading ? (
                <ActivityIndicator size="large" color="#1565c0" />
              ) : image ? (
                <Image source={{ uri: image }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imageUploadPlaceholder}>
                  <MaterialIcons name="add-a-photo" size={48} color="#a0aec0" />
                  <Text style={styles.imageUploadText}>Upload Photo</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.webFormContainer}>
            <TextInput
              label="ID"
              value={indexNo}
              onChangeText={setIndexNo}
              style={styles.input}
              mode="outlined"
              left={<TextInput.Icon icon="identifier" />}
            />
            {errors.indexNo ? <Text style={styles.error}>{errors.indexNo}</Text> : null}

            <TextInput
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
              mode="outlined"
              left={<TextInput.Icon icon="account" />}
            />
            {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}

            <Text style={styles.webLabel}>Gender</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={gender} onValueChange={setGender} style={styles.picker}>
                <Picker.Item label="Select Gender" value="" />
                {genders.map((g) => (<Picker.Item key={g} label={g} value={g} />))}
              </Picker>
            </View>
            {errors.gender ? <Text style={styles.error}>{errors.gender}</Text> : null}

            <Text style={styles.webLabel}>Province</Text>
            <View style={styles.pickerContainer}>
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
              labelStyle={{ color: "#fff", fontWeight: "bold", fontSize: 17 }}
            >
              Save Student
            </Button>
          </View>
        </ScrollView>
        {/* Notification Modal - Placed outside the main content for web */}
        <FeedbackModal
          visible={modalVisible}
          message={modalMsg}
          type={modalType}
          title={modalTitle}
          onClose={hideModal}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5faff" }}>
      <TopShape />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Modern Image Uploader */}
          <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.imageUploadButton}>
            <View style={styles.imageUploadContainer}>
              {uploading ? (
                <ActivityIndicator size="large" color="#1565c0" />
              ) : image ? (
                <Image source={{ uri: image }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imageUploadPlaceholder}>
                  <MaterialIcons name="add-a-photo" size={48} color="#a0aec0" />
                  <Text style={styles.imageUploadText}>Upload Photo</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          {/* Extra space between shape and first field */}
          <View style={{ height: 32 }} />
          <TextInput
            label="ID"
            value={indexNo}
            onChangeText={setIndexNo}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="identifier" />}
          />
          {errors.indexNo ? <Text style={styles.error}>{errors.indexNo}</Text> : null}

          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="account" />}
          />
          {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}

          {/* Batch Dropdown */}
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
          {/* {batches.length === 0 && ( // Batch part commented out
            <Text style={styles.error}>No batches found. Please add a batch first.</Text>
          )} */}
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
            keyboardType="phone-pad"
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="phone" />}
          /> */}
          {/* {errors.phone ? <Text style={styles.error}>{errors.phone}</Text> : null} */}

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

          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.button}
            buttonColor="#1565c0"
            labelStyle={{ color: "#fff", fontWeight: "bold", fontSize: 17 }}
            // disabled={batches.length === 0} // Batch part commented out
          >
            Save Student
          </Button>
        </View>
      </ScrollView>
      {/* Notification Modal */}
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
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  topBarLogo: {
    width: 100,
    height: 100,
    marginLeft: 10,
    marginTop: -10,
  },
  pageTitle: {
    fontWeight: "bold",
    fontSize: 24,
    color: "#1565c0",
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 15,
    color: "#444",
    marginBottom: 2,
    marginTop: 2,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: 160, // Increased to avoid overlap with shape
    paddingBottom: 80, // Adjusted padding
  },
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: "#f5faff",
  },
  input: {
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
    justifyContent: 'center', // Added for consistency
  },
  picker: { height: 48, width: "100%", color: '#333' },
  imageUploadButton: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  imageUploadContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#cbd5e0',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  imageUploadPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageUploadText: {
    marginTop: 8,
    color: '#a0aec0',
    fontSize: 14,
  },
  imagePreview: {
    width: '100%', height: '100%',
  },
  button: {
    marginTop: 12,
    marginBottom: 12,
  },
  error: {
    color: "red",
    marginBottom: 2,
    marginLeft: 4,
    textAlign: "left",
    fontSize: 14,
  },
  success: {
    color: "green",
    marginBottom: 8,
    textAlign: "center",
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 250,
    maxWidth: 340,
    marginHorizontal: 16,
    elevation: 5,
  },
  errorTitle: { color: "red", fontWeight: "bold", fontSize: 18, textAlign: "center", marginBottom: 6 },
  errorModal: { color: "red", fontSize: 15, textAlign: "center", marginBottom: 4 },
  // Web-specific styles
  webContainer: {
    flexDirection: 'row',
    height: '100%',
    backgroundColor: '#f8f9fa',
  },
  webMainContent: {
    flex: 1,
    padding: 32,
  },
  webHeader: {
    marginBottom: 32,
  },
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
  webFormContainer: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  webLabel: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 4,
  },
});