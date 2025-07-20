import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Platform, SafeAreaView, StyleSheet, View } from "react-native";
import { Button, IconButton, Text } from "react-native-paper";
import DesktopSideBar from "../../components/admin/DesktopSideBar";
import BottomNavBar from "../../components/BottomNavBar";
import { FeedbackModal } from "../../components/FeedbackModal"; // Import FeedbackModal
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal"; // Import useFeedbackModal
import { useAuth } from "../../utils/AuthContext";
import { fetchStudentsByCriteria, StudentDocument, updateStudentTeam } from "../../utils/firebaseRest"; // Removed fetchBatches

// Static list for gender dropdown
const staticGenders = ["Male", "Female", "Other"];
// Hardcoded provinces list
const staticProvinces = ["Central", "Eastern", "Northern", "Southern", "Western", "North Western", "North Central", "Uva", "Sabaragamuwa"];


export default function AddTeamScreen({ navigation }: any) {
  const { auth } = useAuth();
  const isWeb = Platform.OS === 'web';

  const [filterGender, setFilterGender] = useState("");
  const [filterProvince, setFilterProvince] = useState("");
  // const [filterBatch, setFilterBatch] = useState(""); // Batch filter removed

  // const [provinces, setProvinces] = useState<string[]>([]); // Using staticProvinces for now
  // const [batches, setBatches] = useState<string[]>([]); // Batch list removed
  
  const [students, setStudents] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(false);
  // const [loadingDropdowns, setLoadingDropdowns] = useState(true); // Not needed if only static dropdowns
  const [hasSearched, setHasSearched] = useState(false); // To track if a search has been performed

  // Use the centralized feedback modal
  const { modalVisible: feedbackModalVisible, modalMsg: feedbackModalMsg, modalType: feedbackModalType, modalTitle: feedbackModalTitle, showModal: showFeedbackModal, hideModal: hideFeedbackModal } = useFeedbackModal();

  const displayModal = useCallback((
    message: string,
    type: "success" | "error",
    title?: string,
    options?: ShowModalOptions
  ) => {
    const defaultTitle = type === "success" ? "Success" : "Error";
    const effectiveTitle = title || defaultTitle;

    let defaultOptions: ShowModalOptions = {
      autoClose: type === "success",
      autoCloseDelay: type === "success" ? 2000 : 4000,
    };
    if (type === "error") defaultOptions.autoClose = false;

    const finalOptions = { ...defaultOptions, ...options };
    showFeedbackModal(message, type, effectiveTitle, finalOptions);
  }, [showFeedbackModal]);

  // Reactive filtering for web
  useEffect(() => {
    if (!isWeb) {
      return;
    }

    const searchOnWeb = async () => {
      // Don't search if both filters are empty
      if (!filterGender && !filterProvince) {
        setStudents([]);
        setHasSearched(false); // Reset search state
        return;
      }

      if (!auth.idToken) {
        return;
      }

      setLoading(true);
      setHasSearched(true);
      try {
        const fetchedStudents = await fetchStudentsByCriteria(auth.idToken, filterGender || undefined, filterProvince || undefined, undefined);
        setStudents(fetchedStudents);
      } catch (error: any) {
        console.error("Web search students error:", error);
        displayModal(error.message || "Failed to search students.", "error", "Search Error");
      } finally {
        setLoading(false);
      }
    };

    searchOnWeb();
  }, [isWeb, filterGender, filterProvince, auth.idToken, displayModal]);

  // Removed handleClearFilters as the separate button is removed.
  // Individual clear icons handle clearing filters and resetting the list.
  // const handleClearFilters = () => {
  //   setFilterGender("");
  //   setFilterProvince("");
  //   setStudents([]); // Clear the displayed student list
  //   setHasSearched(false); // Reset search state
  // };

  const handleClearGenderFilter = () => {
    setFilterGender("");
    setStudents([]); // Optionally clear results or re-search
  };

  const handleClearProvinceFilter = () => {
    setFilterProvince("");
    setStudents([]); // Optionally clear results or re-search
  };

  // useEffect(() => { // Removed as loadDropdownData is removed
  //   loadDropdownData();
  // }, [loadDropdownData]);

  const handleSearch = async () => {
    if (!filterGender && !filterProvince) { // Adjusted condition: search if at least one is selected
      displayModal("Please select Gender or Province to search.", "error", "Filter Required");
      return;
    }
    if (!auth.idToken) {
      displayModal("Authentication error.", "error", "Auth Error");
      return;
    }
    setLoading(true);
    setStudents([]); // Clear previous results
    setHasSearched(true); // Mark that a search has been initiated
    try {
      // Pass undefined for batch as it's removed
      const fetchedStudents = await fetchStudentsByCriteria(auth.idToken, filterGender || undefined, filterProvince || undefined, undefined);
      setStudents(fetchedStudents);
      if (fetchedStudents.length === 0) {
        displayModal("No students found matching the criteria.", "success", "Search Results");
      }
    } catch (error: any) {
      console.error("Search students error:", error);
      displayModal(error.message || "Failed to search students.", "error", "Search Error");
    } finally {
      setLoading(false);
    }
  };

  const handleSetTeam = async (studentId: string, team: 'A' | 'B') => {
    if (!auth.idToken) {
      displayModal("Authentication error. Cannot update team.", "error", "Auth Error");
      return;
    }
    // Optimistically update UI, or show a specific loader for the item
    const originalStudents = [...students];
    setStudents(prevStudents => 
      prevStudents.map(student => 
        student.id === studentId ? { ...student, team } : student
      )
    );

    try {
      await updateStudentTeam(studentId, team, auth.idToken);
      displayModal(`Student assigned to Team ${team} successfully!`, "success", "Team Update");
    } catch (error: any) {
      console.error("Update team error:", error);
      displayModal(error.message || `Failed to assign to Team ${team}.`, "error", "Update Error");
      setStudents(originalStudents); // Revert optimistic update on error
    }
  };

  const TopShape = React.memo(() => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Assign Teams</Text>
            <Text style={styles.pageSubtitle}>Assign students to teams here</Text>
          </View>
          <Image
            source={require("../../assets/images/logobgr.png")} // Make sure this path is correct
            style={styles.topBarLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  ));

  const renderStudentItem = ({ item }: { item: StudentDocument }) => (
    <View style={isWeb ? styles.webStudentRow : styles.studentRow}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentNameText}>{item.fullName}</Text>
        <Text style={styles.teamText}>
          Current Team: {item.team || "Not Assigned"}
        </Text>
      </View>
      <View style={styles.teamButtonsContainer}>
        <Button 
          mode={item.team === 'A' ? "contained" : "outlined"} 
          onPress={() => handleSetTeam(item.id, 'A')}
          style={styles.teamButton}
          compact
          labelStyle={styles.teamButtonLabel}
        >
          A
        </Button>
        <Button 
          mode={item.team === 'B' ? "contained" : "outlined"} 
          onPress={() => handleSetTeam(item.id, 'B')}
          style={styles.teamButton}
          compact
          labelStyle={styles.teamButtonLabel}
        >
          B
        </Button>
      </View>
    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <View style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Assign Teams</Text>
            <Text style={styles.webPageSubtitle}>Filter students and assign them to Team A or Team B</Text>
          </View>

          <View style={styles.webControlsContainer}>
            <View style={[styles.webPickerContainer, { flex: 1, marginRight: 16 }]}>
              <Picker selectedValue={filterGender} onValueChange={setFilterGender} style={styles.picker}>
                <Picker.Item label="All Genders" value="" />
                {staticGenders.map((g) => (<Picker.Item key={g} label={g} value={g} />))}
              </Picker>
            </View>
            <View style={[styles.webPickerContainer, { flex: 1 }]}>
              <Picker selectedValue={filterProvince} onValueChange={setFilterProvince} style={styles.picker}>
                <Picker.Item label="All Provinces" value="" />
                {staticProvinces.map((p) => (<Picker.Item key={p} label={p} value={p} />))}
              </Picker>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={students}
              keyExtractor={(item) => item.id}
              renderItem={renderStudentItem}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  {hasSearched ? "No students found for the selected criteria." : "Please select filters to find students."}
                </Text>
              }
              style={{ marginTop: 16 }}
            />
          )}
        </View>
        <FeedbackModal
          visible={feedbackModalVisible}
          message={feedbackModalMsg}
          type={feedbackModalType}
          title={feedbackModalTitle}
          onClose={hideFeedbackModal}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopShape />
      <View style={styles.container}>
        <View style={styles.filterContainer}>
          {/* Gender Picker with Clear Button */}
          <View style={styles.pickerRow}>
            <View style={[styles.pickerWrapper, { flex: 1 }]}>
              <Picker selectedValue={filterGender} onValueChange={setFilterGender} style={styles.picker}>
                <Picker.Item label="Select Gender..." value="" />
                {staticGenders.map((g) => (<Picker.Item key={g} label={g} value={g} />))}
              </Picker>
            </View>
            {filterGender ? (
              <IconButton icon="close-circle-outline" size={24} onPress={handleClearGenderFilter} style={styles.clearIconPickerBtn} />
            ) : (
              <View style={styles.clearIconPlaceholder} /> // Placeholder to maintain layout
            )}
          </View>
          {/* Province Picker with Clear Button */}
          <View style={styles.pickerRow}>
            <View style={[styles.pickerWrapper, { flex: 1 }]}>
              <Picker selectedValue={filterProvince} onValueChange={setFilterProvince} style={styles.picker}>
                <Picker.Item label="Select Province..." value="" />
                {staticProvinces.map((p) => (<Picker.Item key={p} label={p} value={p} />))}
              </Picker>
            </View>
            {filterProvince ? (
              <IconButton icon="close-circle-outline" size={24} onPress={handleClearProvinceFilter} style={styles.clearIconPickerBtn} />
            ) : (
              <View style={styles.clearIconPlaceholder} /> // Placeholder
            )}
          </View>
          {/* Batch Picker Removed */}
          {/* <View style={[styles.pickerWrapper]}> ... </View> */}
          <IconButton
            icon="magnify"
            size={28}
            onPress={handleSearch}
            style={styles.searchIconBtn}
            disabled={loading}
            accessibilityLabel="Search students"
            iconColor="#FFFFFF" // Ensuring icon color is white for better visibility on blue background
          />
        </View>

        {loading ? (
          <View style={styles.centeredLoader}>
            <ActivityIndicator size="large" color="#1565c0" />
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={renderStudentItem}
            ListEmptyComponent={
              students.length === 0 && hasSearched && (!filterGender && !filterProvince) ? ( // Show if a search was done with no filters and no results
                <Text style={styles.emptyListText}>
                  No students found for the selected criteria.
                </Text>
              ) : null
            }
            style={styles.flatList}
            contentContainerStyle={styles.flatListContent}
          />
        )}
      </View>

      {/* Centralized Feedback Modal */}
      <FeedbackModal
        visible={feedbackModalVisible}
        message={feedbackModalMsg}
        type={feedbackModalType}
        title={feedbackModalTitle}
        onClose={hideFeedbackModal}
      />
      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5faff" },
  topShapeContainer: { position: "absolute", top: 0, left: 0, right: 0, height: 150, zIndex: 1 },
  topShape: { backgroundColor: "#1565c0", height: 150, borderBottomLeftRadius: 60, borderBottomRightRadius: 60, opacity: 0.15 },
  topBarContainer: { position: "absolute", top: 0, left: 0, right: 0, height: 110, justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 18 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  topBarLogo: { width: 100, height: 100, marginLeft: 10, marginTop: -10 },
  pageTitle: { fontWeight: "bold", fontSize: 24, color: "#1565c0", marginBottom: 2 },
  pageSubtitle: { fontSize: 15, color: "#444", marginBottom: 2, marginTop: 2 },
  container: { flex: 1, paddingHorizontal: 8, paddingTop: 160, paddingBottom: 10, backgroundColor: "#f5faff" },
  
  filterContainer: { 
    flexDirection: 'column', // Stack pickers vertically
    marginBottom: 12, 
    paddingHorizontal: 4 
  },
  pickerRow: { // To align picker and its clear button
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1, 
    borderColor: "#bbb", 
    borderRadius: 8, 
    backgroundColor: "#fff", 
    overflow: "hidden", 
    height: 48, 
    justifyContent: 'center',
    // marginBottom: 8, // Moved to pickerRow
  },
  picker: { 
    height: 48, 
    width: "100%",
    color: '#333', // Ensure selected item text (including placeholder) is visible
  },
  searchIconBtn: { 
    backgroundColor: "#1565c0", // Changed color to match theme
    borderRadius: 8, 
    height: 48, 
    width: '100%', // Make search button full width
    justifyContent: 'center', 
    alignItems: 'center',
    marginTop: 8, // Space above search button
    // alignSelf: 'center', // Removed as it's now part of the filterContainer flex layout
  },
  clearButton: {
    // marginTop: 8, // Removed
    // width: '100%', // Removed
    // height: 48, // Removed
    justifyContent: 'center',
    alignSelf: 'center',
  },
  clearIconPickerBtn: { // Style for the clear filter icon button next to pickers
    marginLeft: 0,
    marginRight: -4,
    alignSelf: "center",
  },
  clearIconPlaceholder: { // To maintain layout when clear icon is not visible
    width: 24 + 8, // Icon size + some margin
  },
  
  centeredLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flatList: { marginTop: 8, flex: 1 },
  flatListContent: { paddingBottom: 80 }, // Adjusted padding
  emptyListText: { color: "#888", textAlign: "center", marginTop: 20, fontSize: 15 },
  
  studentRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#fff", 
    borderRadius: 10, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    marginBottom: 10, 
    elevation: 2, 
    justifyContent: "space-between" 
  },
  studentInfo: {
    flex: 1,
  },
  studentNameText: { fontSize: 16, fontWeight: "bold", color: "#222", marginBottom: 4 },
  teamText: { fontSize: 14, color: "#555" },
  teamButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamButton: {
    marginLeft: 8,
    minWidth: 40, // Ensure buttons are not too small
  },
  teamButtonLabel: {
    fontSize: 14, // Adjust label size if needed
    marginHorizontal: 0, // Remove extra horizontal margin if compact
    marginVertical: 0,
  },

  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 280, maxWidth: 340, marginHorizontal: 16, elevation: 5 },
  successModalText: { color: "green", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  errorModalText: { color: "red", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  modalCloseButton: { marginTop: 12 },
  // Web-specific styles
  webContainer: { flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' },
  webMainContent: { flex: 1, padding: 32 },
  webHeader: { marginBottom: 32 },
  webPageTitle: { fontSize: 32, fontWeight: 'bold', color: '#1A202C' },
  webPageSubtitle: { fontSize: 16, color: '#718096', marginTop: 4 },
  webControlsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  webPickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    height: 56,
    justifyContent: 'center',
  },
  webStudentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    elevation: 2,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
