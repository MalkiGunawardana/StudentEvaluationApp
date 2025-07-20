import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Platform, SafeAreaView, StyleSheet, TouchableOpacity, View } from "react-native"; // Changed Avatar to Image
import { Avatar, Text, TextInput } from "react-native-paper"; // Kept Avatar for student list items
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Import useSafeAreaInsets
import BottomNavBar from "../../components/BottomNavBar";
import DesktopSideBar from "../../components/admin/DesktopSideBar";
import { useAuth } from "../../utils/AuthContext";
import { fetchStudents } from "../../utils/firebaseRest"; // Removed fetchBatches

const provinces = [
  "Central", "Eastern", "Northern", "Southern", "Western", "North Western", "North Central", "Uva", "Sabaragamuwa"
];

const BOTTOM_NAV_BAR_FIXED_HEIGHT = 60; // Matches the height in BottomNavBar.tsx

export default function StudentListScreen({ navigation }: any) {
  const { auth } = useAuth();
  const isWeb = Platform.OS === 'web';
  const [students, setStudents] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  // const [batch, setBatch] = useState(""); // Batch functionality removed
  const [province, setProvince] = useState("");
  // const [batches, setBatches] = useState<string[]>([]); // Batch functionality removed
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets(); // Get safe area insets

  // Modal notification state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [modalType, setModalType] = useState<"success" | "error">("success");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (auth.idToken) {
          const all = await fetchStudents(auth.idToken);
          setStudents(all);
          setFiltered(all);
          // const batchList = await fetchBatches(auth.idToken); // Batch functionality removed
          // setBatches(batchList); // Batch functionality removed
        }
      } catch {
        setStudents([]);
        setFiltered([]);
        // setBatches([]); // Batch functionality removed
      }
      setLoading(false);
    };
    load();
  }, [auth.idToken]);

  // Reactive search/filter logic
  useEffect(() => {
    let result = students;
    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      result = result.filter(
        s =>
          s.fullName.toLowerCase().includes(searchTerm) ||
          s.indexNo.toLowerCase().includes(searchTerm)
      );
    }
    if (province) result = result.filter(s => s.province === province);
    setFiltered(result);
  }, [search, province, students]);

  // Clear search input only
  const handleClearSearch = () => {
    setSearch("");
  };

  // Modal notification logic
  const showModal = (msg: string, type: "success" | "error" = "success") => {
    setModalMsg(msg);
    setModalType(type);
    setModalVisible(true);
    setTimeout(() => setModalVisible(false), 1500);
  };

  // Top shape and bar with logo, title, subtitle
  const TopShape = () => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Student Details</Text>
            <Text style={styles.pageSubtitle}>Search and filter students</Text>
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

  const renderStudentItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={isWeb ? styles.webStudentCard : styles.studentRow}
      onPress={() => navigation.navigate("StudentDetails", { student: item })}
    >
      <Avatar.Text
        size={isWeb ? 48 : 36}
        label={item.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || '?'}
        style={{ backgroundColor: "#90caf9" }}
      />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={isWeb ? styles.webStudentName : styles.studentName} numberOfLines={1}>{item.fullName}</Text>
        <Text style={isWeb ? styles.webStudentIndex : styles.studentIndexNo}>{item.indexNo}</Text>
      </View>
    </TouchableOpacity>
  );

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <View style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Student List</Text>
            <Text style={styles.webPageSubtitle}>Search and manage student records</Text>
          </View>

          {/* Web Controls */}
          <View style={styles.webControlsContainer}>
            <TextInput
              label="Search by Name or ID"
              value={search}
              onChangeText={setSearch}
              style={[styles.webInput, { flex: 1 }]}
              mode="outlined"
              left={<TextInput.Icon icon="magnify" />}
              right={search.length > 0 ? <TextInput.Icon icon="close" onPress={handleClearSearch} /> : null}
            />
            <View style={[styles.webPickerContainer, { flex: 0.5, marginLeft: 16 }]}>
              <Picker selectedValue={province} onValueChange={setProvince} style={styles.picker}>
                <Picker.Item label="All Provinces" value="" />
                {provinces.map(p => (<Picker.Item key={p} label={p} value={p} />))}
              </Picker>
            </View>
          </View>

          {/* Web Student List */}
          {loading ? (
            <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={filtered}
              renderItem={renderStudentItem}
              keyExtractor={(item) => item.id}
              numColumns={4}
              key={'web-list'} // Key is important for layout changes
              columnWrapperStyle={{ justifyContent: 'space-between' }} // Distribute items evenly
              contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 8 }} // Add container padding
              ListEmptyComponent={<Text style={styles.emptyText}>No students found.</Text>}
            />
          )}
        </View>
        {/* Modal */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalContainer}>
            <View style={styles.modalBox}>
              <Text style={modalType === "error" ? styles.errorTitle : styles.success}>{modalMsg}</Text>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5faff" }}>
      <TopShape />
      {/* This View is the main content area, ensuring content starts below TopShape */}
      <View style={styles.mainContentWrapper}>
        <View style={styles.fixedControlsContainer}>
          <View style={styles.row}>
            <TextInput
              placeholder="Search by Name or ID"
              value={search}
              onChangeText={setSearch}
              style={[styles.input, { flex: 1 }]}
              mode="outlined"
              left={<TextInput.Icon icon="magnify" />}
              right={search.length > 0 ? <TextInput.Icon icon="close" onPress={handleClearSearch} /> : null}
            />
          </View>
          <View style={[styles.row, { marginBottom: 0 }]}>
            <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={province}
                  onValueChange={setProvince}
                  style={styles.picker}
                >
                  <Picker.Item label="All Provinces" value="" />
                  {provinces.map(p => (
                    <Picker.Item key={p} label={p} value={p} />
                  ))}
                </Picker>
            </View>
          </View>
        </View>

        <FlatList
          data={filtered}
          renderItem={renderStudentItem}
          keyExtractor={(item) => item.id}
          key={'mobile-list'}
          contentContainerStyle={{ paddingBottom: BOTTOM_NAV_BAR_FIXED_HEIGHT + insets.bottom + 20, paddingHorizontal: 8, paddingTop: 16 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No students found.</Text>}
        />
      </View>
      {/* Modal notification */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={modalType === "error" ? styles.errorTitle : styles.success}>{modalMsg}</Text>
          </View>
        </View>
      </Modal>
      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topShapeContainer: { // Fixed height for visual shape
    position: "absolute", top: 0, left: 0, right: 0, height: 150, zIndex: 1,
  },
  topShape: {
    backgroundColor: "#1565c0", height: 150, borderBottomLeftRadius: 60, borderBottomRightRadius: 60, opacity: 0.15,
  },
  topBarContainer: {
    position: "absolute", top: 0, left: 0, right: 0, height: 110, justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 18,
  },
  topBar: { // Added alignItems to 'center' for better vertical alignment if content heights differ
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, 
  },
  topBarLogo: { // Styles similar to AddStudentScreen logo
    width: 100,
    height: 100,
    marginLeft: 10, // Space from the text content to its left
    marginTop: -10, // To pull it up slightly if needed, adjust as per visual requirement
   },
  pageTitle: { fontWeight: "bold", fontSize: 24, color: "#1565c0", marginBottom: 2 },
  pageSubtitle: { fontSize: 15, color: "#444", marginBottom: 2, marginTop: 2 },
  mainContentWrapper: { // New wrapper for ScrollView
    flex: 1,
    paddingTop: 150, // Height of TopShapeContainer
    backgroundColor: "#f5faff", // Background for the area under TopShape
  },
  fixedControlsContainer: { // Container for search and filter rows
    paddingHorizontal: 8, // Consistent padding
    paddingTop: 16,       // Space from the top of the mainContentWrapper
    backgroundColor: "#f5faff", // Match background to avoid visual breaks if content scrolls under
  },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 }, // Added paddingHorizontal
  input: { backgroundColor: "#fff", marginRight: 8 },
  pickerContainer: { // Matched AddEventScreen pickerContainer
    flex: 1, // Make it take full width in the row
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
    height: 48, // Added height
    justifyContent: 'center', // Added justifyContent
  },
  picker: { height: 48, width: "100%", color: '#333' }, // Ensure selected item text (including placeholder) is visible
  studentRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 10, elevation: 1, marginBottom: 10,
  },
  studentName: { fontSize: 16, fontWeight: "bold", color: "#222" },
  studentIndexNo: { // New style for Index No
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  modalContainer: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 250, maxWidth: 340, marginHorizontal: 16, elevation: 5,
  },
  errorTitle: { color: "red", fontWeight: "bold", fontSize: 18, textAlign: "center", marginBottom: 6 }, // Style for error title in modal
  success: { color: "green", fontWeight: "bold", fontSize: 16, textAlign: "center" },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  // Web-specific styles
  webContainer: { flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' },
  webMainContent: { flex: 1, padding: 32 },
  webHeader: { marginBottom: 32 },
  webPageTitle: { fontSize: 32, fontWeight: 'bold', color: '#1A202C' },
  webPageSubtitle: { fontSize: 16, color: '#718096', marginTop: 4 },
  webControlsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  webInput: { backgroundColor: '#fff' },
  webPickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    height: 56,
    justifyContent: 'center',
  },
  webStudentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8, // Use vertical margin; horizontal space is now handled by columnWrapperStyle
    elevation: 2,
    width: '24%', // Set a percentage width, allowing space for gaps
  },
  webStudentName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  webStudentIndex: { fontSize: 14, color: '#666', marginTop: 2 },
});