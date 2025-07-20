import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native"; // Added Modal back
import { Button, IconButton, Text, TextInput } from "react-native-paper"; // Removed MarksEntry from import
import { FeedbackModal, ModalType as FeedbackModalType } from "../../components/FeedbackModal"; // Import FeedbackModal
import SupervisorBottomNavBar from "../../components/SupervisorBottomNavBar";
import SupervisorWebSidebar from "../../components/supervisor/SupervisorWebSideBar";
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal"; // Import useFeedbackModal
import { useAuth } from "../../utils/AuthContext";
import {
  EventDocument,
  MarksEntryData, // Changed to MarksEntryData from firebaseRest.tsx
  StudentDocument,
  createEditRequest,
  fetchEditRequestForMark,
  fetchEvents,
  fetchStudentMarksForEvent,
  fetchStudentsByCriteria,
  saveStudentMarks,
  updateEditRequestStatus,
  updateStudentMarks
} from "../../utils/firebaseRest";




// Import the REST API-based notification creator
import { createMarkEntryNotification } from "../../utils/firebaseRest";

// Use MarksEntryData from firebaseRest.tsx, which will be updated to include _sup fields
type MarksEntry = MarksEntryData;

const initialMarksEntry: MarksEntry = { 
  D: "", D_sup: "",
  E1: "", E1_sup: "",
  E2: "", E2_sup: "",
  E3: "", E3_sup: "",
  E4: "", E4_sup: "",
  P: "", P_sup: "" 
};

// Hardcoded provinces
const provincesList = [
  "Western",
  "Central",
  "Southern",
  "Northern",
  "Eastern",
  "North Western",
  "North Central",
  "Uva",
  "Sabaragamuwa",
];

export default function AddMarksScreen({ navigation }: any) {
  const { auth } = useAuth();
  const idToken = auth?.idToken;
  const supervisorId = auth?.uid;
  const supervisorName = (auth?.firstName && auth?.lastName) ? `${String(auth.firstName).trim()} ${String(auth.lastName).trim()}` : "Supervisor"; // Ensure names are strings and trimmed
  const isWeb = Platform.OS === 'web';

  // Dropdown states
  const [selectedGender, setSelectedGender] = useState("");
  // const [selectedBatch, setSelectedBatch] = useState(""); // Batch functionality removed
  const [selectedProvince, setSelectedProvince] = useState("");

  // Data for dropdowns
  // const [batches, setBatches] = useState<string[]>([]); // Batch functionality removed
  const [allEvents, setAllEvents] = useState<EventDocument[]>([]); // For modal dropdown

  // Student list
  const [students, setStudents] = useState<StudentDocument[]>([]);
  const [teamAStudents, setTeamAStudents] = useState<StudentDocument[]>([]);
  const [teamBStudents, setTeamBStudents] = useState<StudentDocument[]>([]);
  const [searched, setSearched] = useState(false);

  // Loading states
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedStudentForMarks, setSelectedStudentForMarks] = useState<StudentDocument | null>(null);
  const [selectedEventInModal, setSelectedEventInModal] = useState<string>(""); // Event ID
  const [marksRound1, setMarksRound1] = useState<MarksEntry>({ ...initialMarksEntry });
  const [marksRound2, setMarksRound2] = useState<MarksEntry>({ ...initialMarksEntry });
  const [showRound2, setShowRound2] = useState(false);
  const [currentMarkId, setCurrentMarkId] = useState<string | null>(null); // For tracking edited mark's ID

  const { 
    modalVisible: feedbackModalVisible, 
    modalMsg: feedbackModalMsg, 
    modalType: feedbackModalType, 
    modalTitle: feedbackModalTitle, 
    showModal: showFeedbackModalRaw, 
    hideModal: hideFeedbackModal 
  } = useFeedbackModal();

  const displayModal = useCallback((
    message: string,
    type: FeedbackModalType, // Use the imported ModalType
    title?: string,
    options?: ShowModalOptions
  ) => {
    const defaultTitle = type === "success" ? "Success!" : type === "error" ? "Error!" : "Information";
    const effectiveTitle = title || defaultTitle;
    showFeedbackModalRaw(message, type, effectiveTitle, { autoClose: type !== 'error', ...options });
  }, [showFeedbackModalRaw]);

  // Fetch initial data for dropdowns
  useEffect(() => {
    const loadDropdownData = async () => {
      if (!idToken) return;
      setLoadingFilters(true);
      try {
        const [/*fetchedBatches,*/ fetchedEvents] = await Promise.all([ // Batch fetching removed
          // fetchBatches(idToken), // Batch functionality removed
          fetchEvents(idToken), // Fetch all events for the modal
        ]);
        // setBatches(fetchedBatches); // Batch functionality removed
        setAllEvents(fetchedEvents);
      } catch (error: any) {
        displayModal("Failed to load filter data: " + error.message, "error", "Load Error");
      } finally {
        setLoadingFilters(false);
      }
    };
    loadDropdownData();
  }, [idToken, displayModal]);

  const handleSearchStudents = async () => {
    // if (!selectedGender || !selectedBatch || !selectedProvince) { // Batch condition removed
    //   showNotification("Please select Gender, Batch, and Province.", "error");
    //   return;
    // }
    if (!selectedGender && !selectedProvince) { // Search if at least one is selected
      displayModal("Please select Gender or Province to search.", "error", "Filter Required");
      return;
    }
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error");
      return;
    }
    setLoadingStudents(true);
    setSearched(true);
    setStudents([]);
    setTeamAStudents([]);
    setTeamBStudents([]);
    try {
      const fetchedStudents = await fetchStudentsByCriteria(idToken, selectedGender, selectedProvince, undefined /*selectedBatch removed*/);
      setStudents(fetchedStudents);
      setTeamAStudents(fetchedStudents.filter(s => s.team === 'A'));
      setTeamBStudents(fetchedStudents.filter(s => s.team === 'B'));
      // if (fetchedStudents.length === 0) { // Removed as per request to only show "No students in Team A/B"
      //   showNotification("No students found for the selected criteria.", "success");
      // }
    } catch (error: any) {
      displayModal("Failed to fetch students: " + error.message, "error", "Fetch Error");
    } finally {
      setLoadingStudents(false);
    }
  };

  const openMarksModal = (student: StudentDocument) => {
    setSelectedStudentForMarks(student);
    setSelectedEventInModal(""); // Reset event selection
    setMarksRound1({ ...initialMarksEntry });
    setMarksRound2({ ...initialMarksEntry });
    setShowRound2(false);
    setCurrentMarkId(null); // Reset mark ID
    // On web, defer modal open to next tick to avoid mobile modal flash
    if (isWeb) {
      setTimeout(() => setIsModalVisible(true), 0);
    } else {
      setIsModalVisible(true);
    }
  };

  const handleSaveMarks = async () => {
    if (!selectedStudentForMarks || !selectedEventInModal ) {
      displayModal("Student or Event not selected.", "error", "Selection Error");
      return;
    }
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error");
      return;
    }

    // Basic validation for marks (ensure they are numbers or empty)
    const validateMarks = (marks: MarksEntry): boolean => {
        // Define only the fields that are expected to be numeric scores
        const numericScoreFields: Array<keyof MarksEntryData> = ['D', 'E1', 'E2', 'E3', 'E4', 'P'];
        
        return numericScoreFields.every(field => {
            const value = marks[field];
            // A score field is valid if it's undefined, an empty string, or a string representing a valid number
            return value === undefined || value === "" || !isNaN(parseFloat(value));
        });
    };

    if (!validateMarks(marksRound1) || (showRound2 && marksRound2 && !validateMarks(marksRound2))) {
        displayModal("Marks must be numbers or empty.", "error", "Input Error");
        return;
    }

    setSavingMarks(true);
    const marksDataPayload = {
      studentId: selectedStudentForMarks.id,
      eventId: selectedEventInModal,
      supervisorId: auth?.uid || "unknown_supervisor", // Get supervisor ID from auth context
      rounds: {
        round1: marksRound1,
        ...(showRound2 && { round2: marksRound2 }),
      },
      performance: "performance 1", // Ensure performance field is included
      timestamp: new Date().toISOString(),
    };

    try {
      let isNew = false;
      if (currentMarkId) {
        await updateStudentMarks(currentMarkId, marksDataPayload, idToken);
        // After successfully updating, find the approved request and mark it as 'completed'
        const editRequest = await fetchEditRequestForMark(currentMarkId, idToken);
        if (editRequest && editRequest.status === 'approved') {
            await updateEditRequestStatus(editRequest.id!, 'completed', idToken);
        }
        displayModal("Marks updated successfully!", "success", "Update Success");
      } else {
        // Save new marks
        await saveStudentMarks(marksDataPayload, idToken);
        isNew = true;
        displayModal("Marks saved successfully!", "success", "Save Success");
      }

      // --- Send notification after saving marks (for both new and update) ---
      // Only send if all fields D, E1, E2, E3, E4, P are filled (not empty)
      const allFieldsFilled = ['D','E1','E2','E3','E4','P'].every(f => {
        const v = marksRound1[f as keyof MarksEntry];
        return v !== undefined && v !== '';
      });
      if (allFieldsFilled && selectedStudentForMarks) {
        // Calculate final mark (same as calculationUtils, but inline for simplicity)
        const D = parseFloat(marksRound1.D || "0");
        const P = parseFloat(marksRound1.P || "0");
        const E_scores = [marksRound1.E1, marksRound1.E2, marksRound1.E3, marksRound1.E4].map(e => parseFloat(e || "0")).filter(e => !isNaN(e));
        let finalMark = 0;
        if (E_scores.length < 2) {
          finalMark = E_scores.reduce((a, b) => a + b, 0) + D - P;
        } else {
          const minE = Math.min(...E_scores);
          const maxE = Math.max(...E_scores);
          const sumAllE = E_scores.reduce((a, b) => a + b, 0);
          let sumMiddleE = sumAllE - minE - maxE;
          let divisor = 2;
          if (E_scores.length === 2) { sumMiddleE = 0; divisor = 1; }
          else if (E_scores.length === 3) { divisor = 1; }
          const avgMiddleE = divisor > 0 ? sumMiddleE / divisor : 0;
          finalMark = avgMiddleE + D - P;
        }
        // Simple, meaningful notification sentence
        const eventName = allEvents.find(e => e.id === selectedEventInModal)?.eventName || "";
        const notificationMessage = `Marks entered: ${selectedStudentForMarks.fullName} (ID: ${selectedStudentForMarks.indexNo}, Province: ${selectedStudentForMarks.province || ''}), Event: ${eventName}, D: ${marksRound1.D ?? ''}, Final Mark: ${finalMark.toFixed(2)}`;
        await createMarkEntryNotification({
          studentId: selectedStudentForMarks.indexNo,
          studentName: selectedStudentForMarks.fullName,
          eventId: selectedEventInModal,
          eventName: eventName,
          province: selectedStudentForMarks.province || '',
          D: marksRound1.D ?? "",
          finalMark: Number(finalMark.toFixed(2)),
        }, idToken);
      }

      setIsModalVisible(false);
    } catch (error: any) {
      displayModal("Failed to save marks: " + error.message, "error", "Save Error");
    } finally {
      setSavingMarks(false);
    }
  };

  // This function now just opens the modal. Fetching marks happens on event selection.
  const handleEditMarksClick = (student: StudentDocument) => {
    setSelectedStudentForMarks(student);
    setSelectedEventInModal(""); // User will select event in modal
    setMarksRound1({ ...initialMarksEntry });
    setMarksRound2({ ...initialMarksEntry });
    setShowRound2(false);
    setCurrentMarkId(null); // Will be set if marks are found for the selected event
    setIsModalVisible(true);
  };

  const renderMarksField = (
    round: 'round1' | 'round2',
    field: keyof MarksEntry,
    label: string
  ) => {
    const value = (round === 'round1' ? marksRound1[field] : marksRound2[field]) || "";
    const supField = `${field}_sup` as keyof MarksEntry;
    const supValue = (round === 'round1' ? marksRound1[supField] : marksRound2[supField]) || "";
    const setter = round === 'round1' ? setMarksRound1 : setMarksRound2;
    return (
      <View style={styles.markRow}>
        <Text style={styles.markLabel}>{label}</Text>
        <TextInput
          label="Score"
          value={value}
          onChangeText={(text) => setter(prev => ({ ...prev, [field]: text }))}
          keyboardType="numeric"
          style={styles.markInputField}
          mode="outlined"
          dense
        />
        <TextInput
          label="Supervisor"
          value={supValue}
          onChangeText={(text) => setter(prev => ({ ...prev, [supField]: text }))}
          style={styles.supervisorInputField}
          mode="outlined"
          dense
        />
      </View>
    );
  };

  useEffect(() => {
    const loadMarksAndCheckPermissions = async () => {
      if (isModalVisible && selectedStudentForMarks && selectedEventInModal && idToken) {
        setSavingMarks(true); // Use this loader for checking permissions too
        try {
          const existingMarks = await fetchStudentMarksForEvent(selectedStudentForMarks.id, selectedEventInModal, idToken);
          
          if (existingMarks) {
            // Marks exist, so we need to check for edit permission
            const editRequest = await fetchEditRequestForMark(existingMarks.markId, idToken);

            if (editRequest?.status === 'approved') {
              // APPROVED: Load marks and allow editing
              setMarksRound1({ ...initialMarksEntry, ...existingMarks.rounds.round1 });
              if (existingMarks.rounds.round2) {
                setMarksRound2({ ...initialMarksEntry, ...existingMarks.rounds.round2 });
                setShowRound2(true);
              } else {
                setMarksRound2({ ...initialMarksEntry });
                setShowRound2(false);
              }
              setCurrentMarkId(existingMarks.markId);
              displayModal("Request approved! You can now edit the marks.", "success", "Permission Granted");

            } else if (editRequest?.status === 'pending') {
              // PENDING: Show message and close modal
              displayModal("Your edit request is pending admin approval.", "info", "Request Pending");
              setIsModalVisible(false);

            } else if (editRequest?.status === 'rejected') {
              // REJECTED: Show message and close modal
              displayModal("Your edit request was rejected by the admin.", "error", "Request Rejected");
              setIsModalVisible(false);

            } else {
              // NO REQUEST or request is 'completed': Create a new request
              const selectedEvent = allEvents.find(e => e.id === selectedEventInModal);
              const requestData = {
                  studentId: selectedStudentForMarks.id,
                  studentName: selectedStudentForMarks.fullName,
                  eventId: selectedEventInModal,
                  eventName: selectedEvent?.eventName || 'Unknown Event',
                  markId: existingMarks.markId,
                  supervisorId: auth?.uid || 'unknown_supervisor',
                  supervisorName: supervisorName,
              };
              await createEditRequest(requestData, idToken);
              displayModal("Marks for this event already exist. An edit request has been sent to the admin for approval.", "info", "Request Sent");
              setIsModalVisible(false); // Close modal after sending request
            }
          } else {
            // NO EXISTING MARKS: This is a new entry, not an edit. Proceed as normal.
            setMarksRound1({ ...initialMarksEntry });
            setMarksRound2({ ...initialMarksEntry });
            setShowRound2(false);
            setCurrentMarkId(null);
          }
        } catch (error: any) {
          displayModal("An error occurred: " + error.message, "error", "Error");
          setIsModalVisible(false); // Close modal on error
        } finally {
          setSavingMarks(false);
        }
      }
    };
    loadMarksAndCheckPermissions();
  }, [isModalVisible, selectedStudentForMarks, selectedEventInModal, idToken, displayModal]);

  // Common UI: Top Shape and Bar
  const handleClearGenderFilter = () => {
    setSelectedGender("");
    setStudents([]);
    setTeamAStudents([]);
    setTeamBStudents([]);
    setSearched(false); // Reset search state
  };
  const handleClearProvinceFilter = () => {
    setSelectedProvince("");
    setStudents([]);
    setTeamAStudents([]);
    setTeamBStudents([]);
    setSearched(false); // Reset search state
  };

  // Platform-specific modal: use native Modal for mobile, custom overlay for web
  const MarksModal = () => {
    if (isWeb) {
      // Web: custom overlay
      if (!isModalVisible) return null;
      return (
        <View style={[styles.modalOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }]}> 
          <View style={[styles.modalContent, { maxHeight: 600, width: 500 }]}> 
            <ScrollView>
              <Text style={styles.modalTitle}>Add Marks for {selectedStudentForMarks?.fullName}</Text>
              <View style={styles.pickerWrapperModal}>
                <Picker selectedValue={selectedEventInModal} onValueChange={setSelectedEventInModal} style={styles.picker}>
                  <Picker.Item label="Select Event..." value="" />
                  {allEvents.map(event => <Picker.Item key={event.id} label={event.eventName} value={event.id} />)}
                </Picker>
              </View>
              <Text style={styles.roundTitle}>Round 1</Text>
              {renderMarksField('round1', 'D', 'D')}
              {renderMarksField('round1', 'E1', 'E1')}
              {renderMarksField('round1', 'E2', 'E2')}
              {renderMarksField('round1', 'E3', 'E3')}
              {renderMarksField('round1', 'E4', 'E4')}
              {renderMarksField('round1', 'P', 'P')}
              <TouchableOpacity style={styles.addRoundButton} onPress={() => setShowRound2(!showRound2)}>
                <MaterialIcons name={showRound2 ? "remove-circle-outline" : "add-circle-outline"} size={24} color="#1565c0" />
                <Text style={styles.addRoundText}>{showRound2 ? "Remove Round 2" : "Add Round 2"}</Text>
              </TouchableOpacity>
              {showRound2 && (
                <>
                  <Text style={styles.roundTitle}>Round 2</Text>
                  {renderMarksField('round2', 'D', 'D')}
                  {renderMarksField('round2', 'E1', 'E1')}
                  {renderMarksField('round2', 'E2', 'E2')}
                  {renderMarksField('round2', 'E3', 'E3')}
                  {renderMarksField('round2', 'E4', 'E4')}
                  {renderMarksField('round2', 'P', 'P')}
                </>
              )}
              <View style={styles.modalActions}>
                <Button onPress={() => setIsModalVisible(false)} mode="outlined" style={{marginRight: 10}} uppercase={false} contentStyle={{ paddingHorizontal: 4 }} labelStyle={{ fontSize: 14, marginHorizontal: 0, letterSpacing: 0 }}>
                  Cancel
                </Button>
                <Button onPress={handleSaveMarks} mode="contained" loading={savingMarks} buttonColor="#1565c0">Save Marks</Button>
              </View>
            </ScrollView>
          </View>
        </View>
      );
    } else {
      // Mobile: native Modal
      return (
        <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView>
                <Text style={styles.modalTitle}>Add Marks for {selectedStudentForMarks?.fullName}</Text>
                <View style={styles.pickerWrapperModal}>
                  <Picker selectedValue={selectedEventInModal} onValueChange={setSelectedEventInModal} style={styles.picker}>
                    <Picker.Item label="Select Event..." value="" />
                    {allEvents.map(event => <Picker.Item key={event.id} label={event.eventName} value={event.id} />)}
                  </Picker>
                </View>
                <Text style={styles.roundTitle}>Round 1</Text>
                {renderMarksField('round1', 'D', 'D')}
                {renderMarksField('round1', 'E1', 'E1')}
                {renderMarksField('round1', 'E2', 'E2')}
                {renderMarksField('round1', 'E3', 'E3')}
                {renderMarksField('round1', 'E4', 'E4')}
                {renderMarksField('round1', 'P', 'P')}
                <TouchableOpacity style={styles.addRoundButton} onPress={() => setShowRound2(!showRound2)}>
                  <MaterialIcons name={showRound2 ? "remove-circle-outline" : "add-circle-outline"} size={24} color="#1565c0" />
                  <Text style={styles.addRoundText}>{showRound2 ? "Remove Round 2" : "Add Round 2"}</Text>
                </TouchableOpacity>
                {showRound2 && (
                  <>
                    <Text style={styles.roundTitle}>Round 2</Text>
                    {renderMarksField('round2', 'D', 'D')}
                    {renderMarksField('round2', 'E1', 'E1')}
                    {renderMarksField('round2', 'E2', 'E2')}
                    {renderMarksField('round2', 'E3', 'E3')}
                    {renderMarksField('round2', 'E4', 'E4')}
                    {renderMarksField('round2', 'P', 'P')}
                  </>
                )}
                <View style={styles.modalActions}>
                  <Button onPress={() => setIsModalVisible(false)} mode="outlined" style={{marginRight: 10}} uppercase={false} contentStyle={{ paddingHorizontal: 4 }} labelStyle={{ fontSize: 14, marginHorizontal: 0, letterSpacing: 0 }}>
                    Cancel
                  </Button>
                  <Button onPress={handleSaveMarks} mode="contained" loading={savingMarks} buttonColor="#1565c0">Save Marks</Button>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      );
    }
  };

  const TopBarContent = () => (
    <View style={styles.topBarInternal}>
      {/* Back button removed */}
      <View style={{flex: 1}}>
        <Text style={styles.pageTitle}>Performance 1 Marks</Text>
        <Text style={styles.pageSubtitle}>Add student marks here.</Text>
      </View>
      <Image
        source={require("../../assets/images/logobgr.png")}
        style={styles.topBarLogo}
        resizeMode="contain"
      />
    </View>
  );

  const TopShape = React.memo(() => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <TopBarContent />
      </View>
    </View>
  ));

  const renderContent = () => (
    <>
      {isWeb ? (
        <View style={styles.webCard}>
          <View style={styles.webControlsContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
              <View style={[styles.webPickerContainer, { flex: 1 }]}> 
                <Picker selectedValue={selectedGender} onValueChange={setSelectedGender} style={styles.picker}> 
                  <Picker.Item label="Gender..." value="" /> 
                  <Picker.Item label="Male" value="Male" /> 
                  <Picker.Item label="Female" value="Female" /> 
                  <Picker.Item label="Other" value="Other" /> 
                </Picker> 
              </View>
              {selectedGender ? (
                <IconButton icon="close-circle-outline" size={24} onPress={handleClearGenderFilter} style={styles.clearIconPickerBtn} iconColor="#e53935" />
              ) : <View style={styles.clearIconPlaceholder} />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
              <View style={[styles.webPickerContainer, { flex: 1 }]}> 
                <Picker selectedValue={selectedProvince} onValueChange={setSelectedProvince} style={styles.picker}> 
                  <Picker.Item label="Province..." value="" /> 
                  {provincesList.map(p => <Picker.Item key={p} label={p} value={p} />)} 
                </Picker> 
              </View>
              {selectedProvince ? (
                <IconButton icon="close-circle-outline" size={24} onPress={handleClearProvinceFilter} style={styles.clearIconPickerBtn} iconColor="#e53935" />
              ) : <View style={styles.clearIconPlaceholder} />}
            </View>
            <Button
              mode="contained"
              onPress={handleSearchStudents}
              style={styles.webAddButton}
              buttonColor="#1565c0"
              icon="magnify"
              disabled={loadingStudents || loadingFilters}
            >
              Search
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.filterCard}>
          <View style={styles.filterRow}>
            <View style={[styles.pickerWrapper, { flex: 1 }]}> 
              <Picker selectedValue={selectedGender} onValueChange={setSelectedGender} style={styles.picker}> 
                <Picker.Item label="Gender..." value="" /> 
                <Picker.Item label="Male" value="Male" /> 
                <Picker.Item label="Female" value="Female" /> 
                <Picker.Item label="Other" value="Other" /> 
              </Picker> 
            </View>
            {selectedGender ? ( 
              <IconButton icon="close-circle-outline" size={24} onPress={handleClearGenderFilter} style={styles.clearIconPickerBtn} iconColor="#e53935" /> 
            ) : <View style={styles.clearIconPlaceholder} />} 
          </View>
          <View style={styles.filterRow}> 
            <View style={[styles.pickerWrapper, { flex: 1 }]}> 
              <Picker selectedValue={selectedProvince} onValueChange={setSelectedProvince} style={styles.picker}> 
                <Picker.Item label="Province..." value="" /> 
                {provincesList.map(p => <Picker.Item key={p} label={p} value={p} />)} 
              </Picker> 
            </View>
            {selectedProvince ? ( 
              <IconButton icon="close-circle-outline" size={24} onPress={handleClearProvinceFilter} style={styles.clearIconPickerBtn} iconColor="#e53935" /> 
            ) : <View style={styles.clearIconPlaceholder} />} 
          </View>
          <IconButton 
            icon="magnify" 
            size={28} 
            onPress={handleSearchStudents} 
            style={styles.searchIconBtnFullWidth} 
            iconColor="#1565c0" 
            disabled={loadingStudents || loadingFilters} />
        </View>
      )}

      {loadingStudents ? (
        <View style={styles.centeredLoader}><ActivityIndicator size="large" color="#1565c0" /></View>
      ) : (
        <FlatList
          data={[{ title: "Team A Students", data: teamAStudents }, { title: "Team B Students", data: teamBStudents }]}
          keyExtractor={(item, index) => item.title + index}
          renderItem={({ item: section }) => (
            section.data.length > 0 ? (
              <>
                <Text style={styles.teamHeader}>{section.title} ({section.data.length})</Text>
                {section.data.map(student => (
                  <View key={student.id} style={styles.studentItem}>
                    <Text style={styles.studentNameContainer}>
                      <Text style={styles.studentIndex}>ID: {student.indexNo}</Text>
                      {"\n"}{student.fullName}
                    </Text>
                    <View style={styles.studentActions}>
                      <Button mode="outlined" onPress={() => openMarksModal(student)} compact style={{ marginRight: 5 }} textColor="#1565c0">
                        Add Marks
                      </Button>
                      <IconButton icon="pencil" size={20} onPress={() => handleEditMarksClick(student)} style={styles.editIconBtn} iconColor="#757575" />
                    </View>
                  </View>
                ))}
              </>
            ) : (searched && students.length === 0 && section.data.length === 0 ? <Text style={styles.emptyTeamText}>No students in {section.title.split(' ')[0]} {section.title.split(' ')[1]}.</Text> : null)
          )}
          ListEmptyComponent={!searched ? <Text style={styles.emptyListText}>Select criteria and search for students.</Text> : null}
          contentContainerStyle={isWeb ? { paddingBottom: 20 } : styles.listContentContainer}
          style={{ marginTop: 10 }} />
      )}
    </>
  );

  if (loadingFilters) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <TopShape />
        <View style={styles.centeredLoader}><ActivityIndicator size="large" color="#1565c0" /></View>
        <SupervisorBottomNavBar navigation={navigation} />
      </SafeAreaView>
    );
  }

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <SupervisorWebSidebar navigation={navigation} />
        <ScrollView style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Performance 1 Marks</Text>
            <Text style={styles.webPageSubtitle}>Filter students and add marks for Performance 1 events.</Text>
          </View>
          {renderContent()}
        </ScrollView>
        {/* Only render the custom web modal here */}
        <MarksModal />
        <FeedbackModal visible={feedbackModalVisible} message={feedbackModalMsg} type={feedbackModalType as FeedbackModalType} title={feedbackModalTitle} onClose={hideFeedbackModal} />
      </View>
    );
  }

  // Only render the mobile modal on native platforms
  return (
    <SafeAreaView style={styles.safeArea}>
      <TopShape />
      <View style={styles.mainContentContainer}>
        {renderContent()}
      </View>
      <MarksModal />
      <FeedbackModal
        visible={feedbackModalVisible}
        message={feedbackModalMsg}
        type={feedbackModalType as FeedbackModalType}
        title={feedbackModalTitle}
        onClose={hideFeedbackModal}
      />
      <SupervisorBottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5faff" },
  // Top Shape and Bar Styles (adapted from AdminHomeScreen)
  topShapeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150, // Adjusted height
    zIndex: 1,
  },
  topShape: {
    backgroundColor: "#1565c0",
    height: 150, // Reverted
    borderBottomLeftRadius: 60, // Reverted
    borderBottomRightRadius: 60,
    opacity: 0.15,
  },
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110, // Adjusted
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 20, // For status bar
  },
  topBarInternal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 24,
    color: "#1565c0",
    fontWeight: "bold",
    textAlign: 'left', 
    marginBottom: 2,
    marginTop: 20,
    // marginLeft: 10, // No longer needed if back button is gone and title is in a View
  },
  pageSubtitle: {
    fontSize: 15,
    color: "#555",
    textAlign: 'left',
    marginTop: 2,
    // marginLeft: 10, // Match title alignment
  },
  topBarLogo: {
    width: 100, // Adjusted size
    height: 100,
    marginLeft: 10,
    marginTop: -10,
  },
  mainContentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 160, // Push content below the shape
  },
  centeredLoader: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 20 },
  filterCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    marginBottom: 16,
  },
  // filterTitle: { fontSize: 18, fontWeight: "bold", color: "#1565c0", marginBottom: 12 }, // Removed
  filterSubtitle: { fontSize: 14, color: "#555", marginBottom: 15, lineHeight: 20 },
  filterRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  pickerWrapper: { // Wrapper for individual picker
    height: 48, // Standard height for inputs/pickers
    borderColor: "#bbb",
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    backgroundColor: "#fff", // Ensure picker background is white
  },
  picker: { height: 48, width: "100%", color: '#333' }, // Ensure selected item text (including placeholder) is visible
  // inputField: { // Style was unused
  //   height: 48, // Match picker height
  //   backgroundColor: "#fff", // Ensure consistent background
  // },
  searchIconBtnFullWidth: { // For the main search button, styled like AddEventScreen's small search icon
    backgroundColor: "#e0e0e0", // Grey background
    borderRadius: 8,
    height: 48,
    width: '100%', // Make it full width
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8, // Space above the button
  },
  clearIconPickerBtn: { // For clear icons next to pickers
    marginLeft: 0, 
    marginRight: -4, 
    alignSelf: "center",
    backgroundColor: 'transparent', // Transparent background like AddEventScreen's clear icon
  },
  clearIconPlaceholder: { // To maintain layout when clear icon is not visible
    width: 24 + 8, // Icon size + some margin, assuming IconButton is around 24 + padding
  },
  listContentContainer: { paddingBottom: 70 }, // Space for bottom nav bar
  teamHeader: { fontSize: 18, fontWeight: "bold", color: "#1565c0", marginTop: 15, marginBottom: 8, paddingLeft: 4 },
  studentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10, // Increased spacing
    elevation: 1,
  },
  studentName: { fontSize: 16, flexShrink: 1, marginRight: 8 },
  studentNameContainer: { fontSize: 16, flexShrink: 1, marginRight: 8 }, // New style for the container of two lines
  studentIndex: {
    fontWeight: 'bold',
    color: '#1565c0',
  },
  studentActions: { flexDirection: "row" },
  editIconBtn: {
    margin: 0, // Remove default margins from IconButton
    backgroundColor: 'transparent', // Or a subtle background if preferred
    width: 36, // Adjust size as needed
    height: 36,
    borderRadius: 18,
  },
  emptyListText: { textAlign: "center", marginTop: 30, fontSize: 16, color: "#666" },
  emptyTeamText: { textAlign: "center", marginTop: 10, fontSize: 14, color: "#888" },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxHeight: "85%",
    elevation: 5,
  },
  pickerWrapperModal: { // Style for picker inside the modal
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    justifyContent: 'center',
    marginBottom: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15, textAlign: "center", color: "#1565c0" },
  roundTitle: { fontSize: 16, fontWeight: "600", marginTop: 10, marginBottom: 5, color: "#333" },
  
  // Styles for marks entry
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  markLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
    width: 40, // Fixed width for the label (e.g., "E1")
  },
  markInputField: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#fff',
  },
  supervisorInputField: {
    flex: 2,
    backgroundColor: '#fff',
  },
  addRoundButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginTop: 5 }, // Existing style, no change
  addRoundText: { marginLeft: 8, color: "#1565c0", fontSize: 15 }, // Existing style, no change
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eee" }, // Existing style, no change
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
    padding: 24,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 24,
  },
  webControlsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  webPickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    height: 56,
    justifyContent: 'center',
  },
  webAddButton: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
