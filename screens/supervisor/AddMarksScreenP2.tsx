import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, IconButton, Text, TextInput } from "react-native-paper";
import { FeedbackModal, ModalType as FeedbackModalType } from "../../components/FeedbackModal"; // Import FeedbackModal
import SupervisorBottomNavBarP2 from "../../components/SupervisorBottomNavBarP2"; // Added SupervisorBottomNavBarP2
import SupervisorWebSidebar from "../../components/supervisor/SupervisorWebSideBar";
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal"; // Import useFeedbackModal
import { useAuth } from "../../utils/AuthContext";
import {
  EventDocument,
  MarksEntryData,
  StudentDocument,
  StudentMarksPayload,
  createEditRequest,
  createMarkEntryNotification,
  fetchEditRequestForMark,
  fetchEvents,
  fetchStudentMarksForEvent,
  fetchStudents,
  saveStudentMarks,
  updateEditRequestStatus,
  updateStudentMarks,
} from "../../utils/firebaseRest";

// Remove direct Firestore notification logic; use REST API notification instead

// Score calculation logic specifically for Performance 1 qualification (mirrors Performance1ResultsScreen.tsx)
const calculateP1RoundScoreForQualification = (marks: MarksEntryData): number => {
  const D = parseFloat(marks.D || "0");
  const P = parseFloat(marks.P || "0");
  const E_scores_str = [marks.E1, marks.E2, marks.E3, marks.E4];
  const E_scores_num = E_scores_str
    .map(e => parseFloat(e || "0"))
    .filter(e => !isNaN(e)); 

  if (E_scores_num.length < 2) { 
    const sumOfE = E_scores_num.reduce((acc, curr) => acc + curr, 0);
    return sumOfE + D - P;
  }

  const minE = Math.min(...E_scores_num);
  const maxE = Math.max(...E_scores_num);
  const sumOfAllE = E_scores_num.reduce((acc, curr) => acc + curr, 0);

  let sumOfMiddleE = sumOfAllE - minE - maxE; // Default for 4+ scores
  let divisor = 2; // Default for 4+ scores

  if (E_scores_num.length === 2) { 
    sumOfMiddleE = 0; // As per Performance1ResultsScreen logic (effectively ignores E-scores if only 2 are present)
    divisor = 1; 
  } else if (E_scores_num.length === 3) {
    // sumOfMiddleE remains (sumOfAllE - minE - maxE), which is the single middle score
    divisor = 1; // As per Performance1ResultsScreen logic (takes the single middle E-score)
  }
  const averageMiddleE = divisor > 0 ? sumOfMiddleE / divisor : 0;
  return averageMiddleE + D - P;
};

const isRoundDataEmpty = (marks: MarksEntryData | undefined): boolean => {
  if (!marks) return true;
  return Object.values(marks).every(value => value === "" || value === undefined);
};

// Helper to get final P1 score for qualification purposes
const getP1FinalScoreForQualification = (roundsData: StudentMarksPayload["rounds"]): number => {
  const round1Score = calculateP1RoundScoreForQualification(roundsData.round1);
  if (roundsData.round2 && !isRoundDataEmpty(roundsData.round2)) {
      const round2Score = calculateP1RoundScoreForQualification(roundsData.round2);
      return (round1Score + round2Score) / 2;
  }
  return round1Score;
};
const initialMarksState = { 
  D: "", D_sup: "",
  E1: "", E1_sup: "",
  E2: "", E2_sup: "",
  E3: "", E3_sup: "",
  E4: "", E4_sup: "",
  P: "", P_sup: "" 
} as MarksEntryData; // Cast to allow extra fields. Ensure backend/firebaseRest can handle them.

// Interface for the combined data we'll display for each top student
interface TopStudentDisplayData {
  id: string; // Unique key for FlatList, e.g., studentId + qualifyingEventId
  student: StudentDocument;
  qualifyingEvent: EventDocument; // The event for which they were "Top 8"
}

export default function AddMarksScreenP2({ navigation }: any) {
  const { auth } = useAuth();
  const idToken = auth?.idToken || "";
  const supervisorId = auth?.uid || "unknown_supervisor";
  const supervisorName = (auth?.firstName && auth?.lastName) ? `${String(auth.firstName).trim()} ${String(auth.lastName).trim()}` : "Supervisor"; // Ensure names are strings and trimmed
  const isWeb = Platform.OS === 'web';

  const [allTopStudentsData, setAllTopStudentsData] = useState<TopStudentDisplayData[]>([]);
  const [filteredTopStudents, setFilteredTopStudents] = useState<TopStudentDisplayData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [allEventsForModalPicker, setAllEventsForModalPicker] = useState<EventDocument[]>([]);

  // Loading states
  const [loadingEventsForPicker, setLoadingEventsForPicker] = useState(true); // For initial event list for modal
  const [loadingQualifiedStudents, setLoadingQualifiedStudents] = useState(false); // For the Top 8 student list
  const [loadingStudentMarks, setLoadingStudentMarks] = useState(false); // For modal operations

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<StudentDocument | null>(null);
  const [selectedEventForP2Marks, setSelectedEventForP2Marks] = useState<string | null>(null); // Event ID for P2 marks (selected in modal)
  const [currentMarks, setCurrentMarks] = useState<StudentMarksPayload["rounds"]>({ round1: { ...initialMarksState } });
  const [existingMarkId, setExistingMarkId] = useState<string | null>(null);
  const [showRound2InModal, setShowRound2InModal] = useState(false);

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
    type: FeedbackModalType,
    title?: string,
    options?: ShowModalOptions
  ) => {
    const defaultTitle = type === "success" ? "Success!" : type === "error" ? "Error!" : "Information";
    const effectiveTitle = title || defaultTitle;
    showFeedbackModalRaw(message, type, effectiveTitle, { autoClose: type !== 'error', ...options });
  }, [showFeedbackModalRaw]);

  // Phase 1: Load events for modal picker quickly
  useEffect(() => {
    const loadInitialEvents = async () => {
      if (!idToken) {
        displayModal("Authentication token is missing. Please log in again.", "error", "Auth Error", { autoClose: false });
        setLoadingEventsForPicker(false);
        return;
      }
      setLoadingEventsForPicker(true);
      try {
        const allStudentsList = await fetchStudents(idToken);
        if (allStudentsList.length === 0) { // This check is done early, but might be redundant if fetchStudents throws on empty
          displayModal("No students found in the system. Cannot determine Top 8.", "info", "No Data", { autoClose: false }); // Keep this notification
          setLoadingEventsForPicker(false); // Corrected: Use setLoadingEventsForPicker
          return;
        }

        const allEventsList = await fetchEvents(idToken);
        if (allEventsList.length === 0) {
          displayModal("No events found in the system. Cannot determine Top 8.", "info", "No Data", { autoClose: false });
          setLoadingEventsForPicker(false);
          return;
        }
        setAllEventsForModalPicker(allEventsList); // For the modal picker
      } catch (e: any) {
        displayModal("Failed to load event list for modal: " + e.message, "error", "Load Error", { autoClose: false });
      } finally {
        setLoadingEventsForPicker(false);
      }
    };
    loadInitialEvents();
  }, [idToken, displayModal]);

  // Phase 2: Load qualified "Top 8" students (this is the longer operation)
  useEffect(() => {
    const loadQualifiedStudentsData = async () => {
      if (!idToken || loadingEventsForPicker) { // Don't run if events are still loading or no token
        return;
      }
      setLoadingQualifiedStudents(true);
      setAllTopStudentsData([]); // Clear previous data
      setFilteredTopStudents([]); // Clear display
      try {
        const allStudentsList = await fetchStudents(idToken);
        if (allStudentsList.length === 0) {
          // Notification was already shown in loadInitialEvents if this was the case
          setLoadingQualifiedStudents(false);
          return;
        }

        // Use allEventsForModalPicker as it's already fetched and contains all events
        const allEventsList = allEventsForModalPicker; 
        if (allEventsList.length === 0) {
          // Notification was already shown in loadInitialEvents
          setLoadingQualifiedStudents(false);
          return;
        }

        // --- Start of existing Top 8 calculation logic ---
        // (Copied from the original loadData, now focused on this specific task)
        const studentPerformanceScores: Array<{
          student: StudentDocument;
          qualifyingEvent: EventDocument;
          score: number;
        }> = [];

        let p1MarksFound = false; // Flag to check if any P1 marks were processed
        for (const student of allStudentsList) {
          for (const event of allEventsList) {
            const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);

            // IMPORTANT: Only consider "performance 1" marks for Top 8 qualification
            if (marks && marks.performance === "performance 1") {
              p1MarksFound = true; // Set flag if we find at least one P1 mark
              const finalP1Score = getP1FinalScoreForQualification(marks.rounds);
              // Add every valid "Performance 1" score to the list
              studentPerformanceScores.push({
                student: student,
                qualifyingEvent: event, // This is the specific event for this P1 score
                score: finalP1Score,
              });
            }
          }
        }

        // Sort by score descending and take top 8
        const top8Candidates = studentPerformanceScores
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);

        const finalTopStudentsData: TopStudentDisplayData[] = top8Candidates.map(item => ({
          id: `${item.student.id}_${item.qualifyingEvent.id}`, // Unique key for FlatList
          student: item.student,
          qualifyingEvent: item.qualifyingEvent,
        }));

        setAllTopStudentsData(finalTopStudentsData);
        // setFilteredTopStudents(finalTopStudentsData); // Removed: Results should only show after search
        if (finalTopStudentsData.length === 0) {
          if (!p1MarksFound && allStudentsList.length > 0 && allEventsList.length > 0) {
            displayModal("No 'Performance 1' marks found for any student. Cannot determine Top 8.", "info", "No P1 Marks", { autoClose: false });
          } else {
            displayModal("Could not determine Top 8 students from available 'Performance 1' marks.", "info", "No Top 8", { autoClose: false });
          }
        }
        // --- End of existing Top 8 calculation logic ---
      } catch (e: any) {
        displayModal("Failed to load qualified students: " + e.message, "error", "Load Error", { autoClose: false });
      } finally {
        setLoadingQualifiedStudents(false);
      }
    };
    loadQualifiedStudentsData();
  }, [idToken, loadingEventsForPicker, allEventsForModalPicker, displayModal]); // Rerun if token changes or after initial events are loaded

  const handleClearSearch = () => {
    setSearchTerm("");
  };


  const handleActualSearch = () => {
    Keyboard.dismiss(); // Dismiss keyboard before search
    // The actual filtering logic is handled by the useEffect hook listening to searchTerm
    // This function is primarily to trigger UI changes like dismissing the keyboard
  };

  const MarksModal = () => (
    <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView>
            {selectedStudentForModal && <Text style={styles.modalTitle}>P2 Marks: {selectedStudentForModal.fullName}</Text>}

            {/* Event Picker inside the Modal */}
            <View style={styles.pickerWrapperModal}>
              <Picker
                selectedValue={selectedEventForP2Marks}
                onValueChange={(itemValue) => setSelectedEventForP2Marks(itemValue as string | null)}
                style={styles.pickerModal}
                enabled={!loadingStudentMarks} // Disable while saving/loading marks
              >
                <Picker.Item label="Select Event for P2 Marks..." value={null} />
                {allEventsForModalPicker.map(event => (
                  // Batch display removed from event label
                  <Picker.Item key={event.id} label={`${event.eventName} (${event.gender})`} value={event.id} />
                ))}
              </Picker>
            </View>

            {/* Marks input fields section */}
            {loadingStudentMarks && selectedEventForP2Marks ? (
              <ActivityIndicator size="large" color="#1565c0" style={{marginVertical: 20}}/>
            ) : (
              <>
                <Text style={styles.roundTitleModal}>Round 1</Text>
                {renderMarksFieldInModal('round1', 'D', 'D', !selectedEventForP2Marks)}
                {renderMarksFieldInModal('round1', 'E1', 'E1', !selectedEventForP2Marks)}
                {renderMarksFieldInModal('round1', 'E2', 'E2', !selectedEventForP2Marks)}
                {renderMarksFieldInModal('round1', 'E3', 'E3', !selectedEventForP2Marks)}
                {renderMarksFieldInModal('round1', 'E4', 'E4', !selectedEventForP2Marks)}
                {renderMarksFieldInModal('round1', 'P', 'P', !selectedEventForP2Marks)}

                <TouchableOpacity 
                  style={[styles.addRoundButtonModal, !selectedEventForP2Marks && styles.disabledButtonOverlay]} 
                  onPress={() => setShowRound2InModal(!showRound2InModal)}
                  disabled={!selectedEventForP2Marks || loadingStudentMarks}
                >
                  <MaterialIcons name={showRound2InModal ? "remove-circle-outline" : "add-circle-outline"} size={24} color="#1565c0" />
                  <Text style={styles.addRoundTextModal}>{showRound2InModal ? "Remove Round 2" : "Add Round 2"}</Text>
                </TouchableOpacity>

                {showRound2InModal && selectedEventForP2Marks && ( // Also check selectedEventForP2Marks here for visibility
                  <>
                    <Text style={styles.roundTitleModal}>Round 2</Text>
                    {renderMarksFieldInModal('round2', 'D', 'D', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round2', 'E1', 'E1', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round2', 'E2', 'E2', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round2', 'E3', 'E3', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round2', 'E4', 'E4', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round2', 'P', 'P', !selectedEventForP2Marks)}
                  </>
                )}
                <View style={styles.modalActions}>
                  <Button mode="outlined" onPress={() => setIsModalVisible(false)} style={{marginRight: 10}}>Cancel</Button>
                  <Button
                      mode="contained" // This button's disabled state is already handled
                      onPress={handleSaveMarks}
                      loading={loadingStudentMarks && !!selectedEventForP2Marks} // Show spinner on button when saving
                      disabled={loadingStudentMarks || !selectedEventForP2Marks} // Disable if loading or no event selected
                      buttonColor="#1565c0"
                  >
                    {existingMarkId ? "Update Marks" : "Save Marks"}
                  </Button>
                </View>
                {!selectedEventForP2Marks && (
                  <Text style={{textAlign: 'center', marginTop: 15, color: '#777'}}>Please select an event to enter marks.</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Search/Filter Logic
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredTopStudents(allTopStudentsData); // Show all qualified if search is empty
      return;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = allTopStudentsData.filter(item =>
      item.student.fullName.toLowerCase().includes(lowerSearchTerm) ||
      item.student.indexNo.toLowerCase().includes(lowerSearchTerm) ||
      item.qualifyingEvent.eventName.toLowerCase().includes(lowerSearchTerm) // Search by qualifying event name
    );
    setFilteredTopStudents(filtered);
  }, [searchTerm, allTopStudentsData]);


  const openModalForStudent = (studentDoc: StudentDocument) => {
    setSelectedStudentForModal(studentDoc);
    setSelectedEventForP2Marks(null); // Reset event selection in modal
    setCurrentMarks({ round1: { ...initialMarksState }, round2: { ...initialMarksState } }); // Reset marks
    setExistingMarkId(null);
    setShowRound2InModal(false);
    setIsModalVisible(true);
    // Marks will be loaded/reset when an event is selected in the modal's Picker
  };

  // Effect to load marks when an event is selected IN THE MODAL
  useEffect(() => {
    const loadMarksAndCheckPermissionsP2 = async () => {
      if (isModalVisible && selectedStudentForModal && selectedEventForP2Marks && idToken) {
        setLoadingStudentMarks(true); // Show loader inside modal for this operation
        try {
          const marks = await fetchStudentMarksForEvent(selectedStudentForModal.id, selectedEventForP2Marks, idToken);
          
          if (marks && marks.performance === "performance 2") {
            // P2 Marks exist, check for edit permission
            const editRequest = await fetchEditRequestForMark(marks.markId, idToken);

            if (editRequest?.status === 'approved') {
              // APPROVED: Load marks and allow editing
              setCurrentMarks({
                round1: marks.rounds.round1 || { ...initialMarksState },
                round2: marks.rounds.round2 || { ...initialMarksState },
              });
              setExistingMarkId(marks.markId);
              setShowRound2InModal(!!(marks.rounds.round2 && !isRoundDataEmpty(marks.rounds.round2)));
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
              // NO REQUEST or 'completed': Create a new request
              const selectedEvent = allEventsForModalPicker.find(e => e.id === selectedEventForP2Marks);
              const requestData = {
                  studentId: selectedStudentForModal.id,
                  studentName: selectedStudentForModal.fullName,
                  eventId: selectedEventForP2Marks,
                  eventName: selectedEvent?.eventName || 'Unknown Event',
                  markId: marks.markId,
                  supervisorId: supervisorId,
                  supervisorName: supervisorName,
              };
              await createEditRequest(requestData, idToken);
              displayModal("P2 Marks for this event already exist. An edit request has been sent to the admin.", "info", "Request Sent");
              setIsModalVisible(false);
            }
          } else {
            // NO P2 MARKS FOUND: This is a new entry, proceed as normal.
            setCurrentMarks({ round1: { ...initialMarksState }, round2: { ...initialMarksState } });
            setExistingMarkId(null);
            setShowRound2InModal(false);
          }
        } catch (e: any) {
          displayModal("Error checking for existing marks: " + e.message, "error", "Error", { autoClose: false });
          setIsModalVisible(false);
        } finally {
          setLoadingStudentMarks(false);
        }
      }
    };
    loadMarksAndCheckPermissionsP2();
  }, [isModalVisible, selectedStudentForModal, selectedEventForP2Marks, idToken, displayModal]); // Rerun when modal event changes


  const handleMarkChange = (round: "round1" | "round2", field: keyof MarksEntryData, value: string) => {
    setCurrentMarks(prev => ({
      ...prev,
      [round]: { ...prev[round], [field]: value },
    }));
  };

  const handleSaveMarks = async () => {
    if (!selectedStudentForModal || !selectedEventForP2Marks) {
      displayModal("Please select an event in the modal to save marks.", "error", "Selection Error");
      return;
    }
    if (!idToken) {
      displayModal("Authentication error. Cannot save marks. Please log in again.", "error", "Auth Error", { autoClose: false });
      return;
    }

    // Validate marks before saving
    const validateMarksEntry = (marks: MarksEntryData): boolean => {
      const numericScoreFields: Array<keyof MarksEntryData> = ['D', 'E1', 'E2', 'E3', 'E4', 'P'];
      return numericScoreFields.every(field => {
        const value = marks[field];
        return value === undefined || value === "" || !isNaN(parseFloat(value));
      });
    };

    if (!validateMarksEntry(currentMarks.round1)) {
      displayModal("Round 1 marks must be numbers or empty.", "error", "Input Error");
      return;
    }
    if (showRound2InModal && currentMarks.round2 && !validateMarksEntry(currentMarks.round2)) {
      displayModal("Round 2 marks must be numbers or empty.", "error", "Input Error");
      return;
    }

    const payload: StudentMarksPayload = {
      studentId: selectedStudentForModal.id,
      eventId: selectedEventForP2Marks,
      supervisorId: supervisorId,
      rounds: {
        round1: currentMarks.round1,
        ...(showRound2InModal ? { round2: currentMarks.round2 } : {})
      },
      performance: "performance 2",
      timestamp: new Date().toISOString(),
    };

    // Helper to calculate final mark (average if round2 exists, else round1)
    const calculateFinalMark = () => {
      const D = parseFloat(currentMarks.round1.D || "0");
      const P = parseFloat(currentMarks.round1.P || "0");
      const E_scores = [currentMarks.round1.E1, currentMarks.round1.E2, currentMarks.round1.E3, currentMarks.round1.E4]
        .map(e => parseFloat(e || "0"))
        .filter(e => !isNaN(e));
      let round1Score = 0;
      if (E_scores.length < 2) {
        round1Score = E_scores.reduce((acc, curr) => acc + curr, 0) + D - P;
      } else {
        const minE = Math.min(...E_scores);
        const maxE = Math.max(...E_scores);
        const sumOfAllE = E_scores.reduce((acc, curr) => acc + curr, 0);
        let sumOfMiddleE = sumOfAllE - minE - maxE;
        let divisor = 2;
        if (E_scores.length === 2) {
          sumOfMiddleE = 0;
          divisor = 1;
        } else if (E_scores.length === 3) {
          divisor = 1;
        }
        const averageMiddleE = divisor > 0 ? sumOfMiddleE / divisor : 0;
        round1Score = averageMiddleE + D - P;
      }
      if (showRound2InModal && currentMarks.round2) {
        // Calculate round2 score
        const D2 = parseFloat(currentMarks.round2.D || "0");
        const P2 = parseFloat(currentMarks.round2.P || "0");
        const E2_scores = [currentMarks.round2.E1, currentMarks.round2.E2, currentMarks.round2.E3, currentMarks.round2.E4]
          .map(e => parseFloat(e || "0"))
          .filter(e => !isNaN(e));
        let round2Score = 0;
        if (E2_scores.length < 2) {
          round2Score = E2_scores.reduce((acc, curr) => acc + curr, 0) + D2 - P2;
        } else {
          const minE2 = Math.min(...E2_scores);
          const maxE2 = Math.max(...E2_scores);
          const sumOfAllE2 = E2_scores.reduce((acc, curr) => acc + curr, 0);
          let sumOfMiddleE2 = sumOfAllE2 - minE2 - maxE2;
          let divisor2 = 2;
          if (E2_scores.length === 2) {
            sumOfMiddleE2 = 0;
            divisor2 = 1;
          } else if (E2_scores.length === 3) {
            divisor2 = 1;
          }
          const averageMiddleE2 = divisor2 > 0 ? sumOfMiddleE2 / divisor2 : 0;
          round2Score = averageMiddleE2 + D2 - P2;
        }
        return ((round1Score + round2Score) / 2).toFixed(2);
      }
      return round1Score.toFixed(2);
    };

    // Send notification using REST API (like AddMarksScreen)
    const sendNotification = async () => {
      try {
        const eventName = allEventsForModalPicker.find(e => e.id === selectedEventForP2Marks)?.eventName || "";
        const finalMark = calculateFinalMark();
        // Simple, meaningful notification sentence
        // Notification will be constructed in the backend as in AddMarksScreen
        await createMarkEntryNotification({
          studentId: selectedStudentForModal.indexNo,
          studentName: selectedStudentForModal.fullName,
          eventId: selectedEventForP2Marks,
          eventName: eventName,
          province: selectedStudentForModal.province || '',
          D: currentMarks.round1.D ?? "",
          finalMark: Number(finalMark),
        }, idToken);
      } catch (err) {
        // Optionally log error
      }
    };

    try {
      setLoadingStudentMarks(true);
      if (existingMarkId) {
        await updateStudentMarks(existingMarkId, payload, idToken);
        const editRequest = await fetchEditRequestForMark(existingMarkId, idToken);
        if (editRequest && editRequest.status === 'approved') {
          await updateEditRequestStatus(editRequest.id!, 'completed', idToken);
        }
        await sendNotification();
        displayModal("Marks updated successfully!", "success", "Update Success");
      } else {
        await saveStudentMarks(payload, idToken);
        await sendNotification();
        displayModal("Marks saved successfully!", "success", "Save Success");
      }
      setIsModalVisible(false);
    } catch (e: any) {
      displayModal("Error saving marks: " + e.message, "error", "Save Error", { autoClose: false });
    } finally {
      setLoadingStudentMarks(false);
    }
  };

  const renderMarksFieldInModal = (
    round: 'round1' | 'round2',
    field: keyof MarksEntryData,
    label: string,
    disabled?: boolean // Added disabled prop
  ) => {
    const value = (currentMarks[round]?.[field] ?? "") as string;
    const supField = `${field}_sup` as keyof MarksEntryData;
    const supValue = (currentMarks[round]?.[supField] ?? "") as string;
    return (
      <View style={styles.markRow}>
        <Text style={styles.markLabel}>{label}</Text>
        <TextInput
          label="Score"
          value={value}
          onChangeText={(text) => handleMarkChange(round, field, text)}
          keyboardType="numeric"
          style={styles.markInputField}
          mode="outlined" dense
          disabled={disabled || loadingStudentMarks} // Apply disabled state
        />
        <TextInput
          label="Supervisor"
          value={supValue}
          onChangeText={(text) => handleMarkChange(round, supField, text)}
          style={styles.supervisorInputField}
          mode="outlined" dense
          disabled={disabled || loadingStudentMarks} // Apply disabled state
        />
      </View>
    );
  };



  // --- UI Components ---
  const TopBarContent = () => (
    <View style={styles.topBarInternal}>
        <View style={{flex: 1}}>
            <Text style={styles.pageTitle}>Performance 2 Marks</Text>
            <Text style={styles.pageSubtitle}>Add student marks here.</Text>
        </View>
        <Image source={require("../../assets/images/logobgr.png")} style={styles.topBarLogo} resizeMode="contain" />
    </View>
  );

  const TopShape = React.memo(() => (
    <View style={styles.topShapeContainer}>
        <View style={styles.topShape} />
        <View style={styles.topBarContainer}><TopBarContent /></View>
    </View>
  ));

  // Conditional rendering for the main screen content
  // --- WEB LAYOUT ---
  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <SupervisorWebSidebar navigation={navigation} />
        <View style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Performance 2 Marks</Text>
            <Text style={styles.webPageSubtitle}>Add student marks here.</Text>
          </View>
          <View style={styles.webCard}>
            {/* Search bar only (no dropdowns) */}
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrapper}>
                <TextInput
                  placeholder="Search by Name, Index No, or Event"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.searchInputStyle}
                  mode="flat"
                  dense
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  onSubmitEditing={handleActualSearch}
                />
                {searchTerm ? (
                  <IconButton icon="close-circle-outline" onPress={handleClearSearch} size={20} iconColor="#e53935" style={styles.clearSearchInputIcon} />
                ) : null}
              </View>
              <TouchableOpacity
                onPress={handleActualSearch}
                // Only disable if loadingEventsForPicker (not for loadingQualifiedStudents)
                disabled={loadingEventsForPicker}
                style={[styles.searchActionIconBtn, loadingEventsForPicker && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <MaterialIcons name="search" size={28} color="#1565c0" />
              </TouchableOpacity>
            </View>
  

            {loadingQualifiedStudents ? (
              <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 20 }} />
            ) : filteredTopStudents.length > 0 ? (
              <FlatList
                data={filteredTopStudents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.studentItem}>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentNameContainer}>
                        <Text style={styles.studentIndex}>ID: {item.student.indexNo}</Text>
                        {"\n"}
                        <Text>{item.student.fullName}</Text>
                      </Text>
                      <Text style={styles.studentDetail}>Top 8 for: {item.qualifyingEvent.eventName}</Text>
                    </View>
                    <View style={styles.studentActions}>
                      <Button
                        mode="outlined"
                        onPress={() => openModalForStudent(item.student)}
                        compact
                        style={{ marginRight: 5 }}
                        textColor="#1565c0"
                        labelStyle={{ fontSize: 12 }}
                      >
                        Add P2 Marks
                      </Button>
                      <TouchableOpacity onPress={() => openModalForStudent(item.student)} style={styles.editIconTouchable}>
                        <MaterialIcons name="edit" size={24} color="#757575" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            ) : (
              <Text style={styles.infoText}>
                {loadingEventsForPicker ? "Loading..." :
                  (searchTerm && filteredTopStudents.length === 0 ? "No students match your search." :
                    (allTopStudentsData.length === 0 && !loadingQualifiedStudents ? "No 'Top 8' qualified students found from Performance 1." :
                      "Enter search term to find students.")
                  )
                }
              </Text>
            )}
          </View>
        </View>
        {/* Modal and FeedbackModal are rendered globally for both web and mobile */}
        <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView>
                {selectedStudentForModal && <Text style={styles.modalTitle}>P2 Marks: {selectedStudentForModal.fullName}</Text>}
                <View style={styles.pickerWrapperModal}>
                  <Picker
                    selectedValue={selectedEventForP2Marks}
                    onValueChange={(itemValue) => setSelectedEventForP2Marks(itemValue as string | null)}
                    style={styles.pickerModal}
                    enabled={!loadingStudentMarks}
                  >
                    <Picker.Item label="Select Event for P2 Marks..." value={null} />
                    {allEventsForModalPicker.map(event => (
                      <Picker.Item key={event.id} label={`${event.eventName} (${event.gender})`} value={event.id} />
                    ))}
                  </Picker>
                </View>
                {loadingStudentMarks && selectedEventForP2Marks ? (
                  <ActivityIndicator size="large" color="#1565c0" style={{ marginVertical: 20 }} />
                ) : (
                  <>
                    <Text style={styles.roundTitleModal}>Round 1</Text>
                    {renderMarksFieldInModal('round1', 'D', 'D', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round1', 'E1', 'E1', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round1', 'E2', 'E2', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round1', 'E3', 'E3', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round1', 'E4', 'E4', !selectedEventForP2Marks)}
                    {renderMarksFieldInModal('round1', 'P', 'P', !selectedEventForP2Marks)}
                    <TouchableOpacity
                      style={[styles.addRoundButtonModal, !selectedEventForP2Marks && styles.disabledButtonOverlay]}
                      onPress={() => setShowRound2InModal(!showRound2InModal)}
                      disabled={!selectedEventForP2Marks || loadingStudentMarks}
                    >
                      <MaterialIcons name={showRound2InModal ? "remove-circle-outline" : "add-circle-outline"} size={24} color="#1565c0" />
                      <Text style={styles.addRoundTextModal}>{showRound2InModal ? "Remove Round 2" : "Add Round 2"}</Text>
                    </TouchableOpacity>
                    {showRound2InModal && selectedEventForP2Marks && (
                      <>
                        <Text style={styles.roundTitleModal}>Round 2</Text>
                        {renderMarksFieldInModal('round2', 'D', 'D', !selectedEventForP2Marks)}
                        {renderMarksFieldInModal('round2', 'E1', 'E1', !selectedEventForP2Marks)}
                        {renderMarksFieldInModal('round2', 'E2', 'E2', !selectedEventForP2Marks)}
                        {renderMarksFieldInModal('round2', 'E3', 'E3', !selectedEventForP2Marks)}
                        {renderMarksFieldInModal('round2', 'E4', 'E4', !selectedEventForP2Marks)}
                        {renderMarksFieldInModal('round2', 'P', 'P', !selectedEventForP2Marks)}
                      </>
                    )}
                    <View style={styles.modalActions}>
                      <Button mode="outlined" onPress={() => setIsModalVisible(false)} style={{ marginRight: 10 }}>Cancel</Button>
                      <Button
                        mode="contained"
                        onPress={handleSaveMarks}
                        loading={loadingStudentMarks && !!selectedEventForP2Marks}
                        disabled={loadingStudentMarks || !selectedEventForP2Marks}
                        buttonColor="#1565c0"
                      >
                        {existingMarkId ? "Update Marks" : "Save Marks"}
                      </Button>
                    </View>
                    {!selectedEventForP2Marks && (
                      <Text style={{ textAlign: 'center', marginTop: 15, color: '#777' }}>Please select an event to enter marks.</Text>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <FeedbackModal
          visible={feedbackModalVisible}
          message={feedbackModalMsg}
          type={feedbackModalType as FeedbackModalType}
          title={feedbackModalTitle}
          onClose={hideFeedbackModal}
        />
      </View>
    );
  }

  // --- MOBILE LAYOUT ---
  if (loadingEventsForPicker) { // Show loader for the whole screen if basic events aren't loaded
    return (
      <SafeAreaView style={styles.safeArea}>
        <TopShape />
        <View style={styles.centeredLoader}><ActivityIndicator size="large" color="#1565c0" /></View>
      </SafeAreaView>)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopShape />
      <View style={styles.mainContainer}>
        {/* ...existing code... */}
        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrapper}> 
              <TextInput
                placeholder="Search by Name, Index No, or Event"
                value={searchTerm}
                onChangeText={setSearchTerm}
                style={styles.searchInputStyle}
                mode="flat"
                dense
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                onSubmitEditing={handleActualSearch} 
              />
              {searchTerm ? (
                <IconButton icon="close-circle-outline" onPress={handleClearSearch} size={20} iconColor="#e53935" style={styles.clearSearchInputIcon} />
              ) : null}
            </View>
            <IconButton 
              icon="magnify" 
              size={28}
              onPress={handleActualSearch} // Use handleActualSearch
              style={styles.searchActionIconBtn} // Consistent with other pages
              iconColor="#1565c0" // Blue icon
              disabled={loadingEventsForPicker || loadingQualifiedStudents} // Disable if any data is loading
            />
          </View>
        </View>

        {loadingQualifiedStudents ? ( // Show loader for the list area
          <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 20 }} />
        ) : filteredTopStudents.length > 0 ? (
          <FlatList
            data={filteredTopStudents}
            keyExtractor={(item) => item.id} // Use the unique ID from TopStudentDisplayData
            renderItem={({ item }) => (
              <View style={styles.studentItem}>
                <View style={styles.studentInfo}>
                    <Text style={styles.studentNameContainer}>
                      <Text style={styles.studentIndex}>ID: {item.student.indexNo}</Text>
                      {"\n"}
                      <Text>{item.student.fullName}</Text>
                    </Text>
                    <Text style={styles.studentDetail}>Top 8 for: {item.qualifyingEvent.eventName}</Text>
                </View>
                <View style={styles.studentActions}>
                  <Button
                    mode="outlined"
                    onPress={() => openModalForStudent(item.student)} // Pass only student document
                    compact
                    style={{marginRight: 5}}
                    textColor="#1565c0"
                    labelStyle={{fontSize: 12}} // Smaller label for button
                  >
                    Add P2 Marks
                  </Button>
                   <TouchableOpacity onPress={() => openModalForStudent(item.student)} style={styles.editIconTouchable}>
                    <MaterialIcons name="edit" size={24} color="#757575" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 20 }} // For scroll room
          />
        ) : (
          <Text style={styles.infoText}>
            {/* Updated info text logic */}
            {loadingEventsForPicker ? "Loading..." : // Should not hit this if structured correctly
              (searchTerm && filteredTopStudents.length === 0 ? "No students match your search." : 
              (allTopStudentsData.length === 0 && !loadingQualifiedStudents ? "No 'Top 8' qualified students found from Performance 1." : 
              "Enter search term to find students.")
              )
            }
          </Text>
        )}
      </View>

      {/* Modal for Adding/Editing P2 Marks */}
      <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {selectedStudentForModal && <Text style={styles.modalTitle}>P2 Marks: {selectedStudentForModal.fullName}</Text>}

              {/* Event Picker inside the Modal */}
              <View style={styles.pickerWrapperModal}>
                <Picker
                  selectedValue={selectedEventForP2Marks}
                  onValueChange={(itemValue) => setSelectedEventForP2Marks(itemValue as string | null)}
                  style={styles.pickerModal}
                  enabled={!loadingStudentMarks} // Disable while saving/loading marks
                >
                  <Picker.Item label="Select Event for P2 Marks..." value={null} />
                  {allEventsForModalPicker.map(event => (
                    // Batch display removed from event label
                    <Picker.Item key={event.id} label={`${event.eventName} (${event.gender})`} value={event.id} />
                  ))}
                </Picker>
              </View>

              {/* Marks input fields section */}
              {loadingStudentMarks && selectedEventForP2Marks ? (
                <ActivityIndicator size="large" color="#1565c0" style={{marginVertical: 20}}/>
              ) : (
                <>
                  <Text style={styles.roundTitleModal}>Round 1</Text>
                  {renderMarksFieldInModal('round1', 'D', 'D', !selectedEventForP2Marks)}
                  {renderMarksFieldInModal('round1', 'E1', 'E1', !selectedEventForP2Marks)}
                  {renderMarksFieldInModal('round1', 'E2', 'E2', !selectedEventForP2Marks)}
                  {renderMarksFieldInModal('round1', 'E3', 'E3', !selectedEventForP2Marks)}
                  {renderMarksFieldInModal('round1', 'E4', 'E4', !selectedEventForP2Marks)}
                  {renderMarksFieldInModal('round1', 'P', 'P', !selectedEventForP2Marks)}

                  <TouchableOpacity 
                    style={[styles.addRoundButtonModal, !selectedEventForP2Marks && styles.disabledButtonOverlay]} 
                    onPress={() => setShowRound2InModal(!showRound2InModal)}
                    disabled={!selectedEventForP2Marks || loadingStudentMarks}
                  >
                    <MaterialIcons name={showRound2InModal ? "remove-circle-outline" : "add-circle-outline"} size={24} color="#1565c0" />
                    <Text style={styles.addRoundTextModal}>{showRound2InModal ? "Remove Round 2" : "Add Round 2"}</Text>
                  </TouchableOpacity>

                  {showRound2InModal && selectedEventForP2Marks && ( // Also check selectedEventForP2Marks here for visibility
                    <>
                      <Text style={styles.roundTitleModal}>Round 2</Text>
                      {renderMarksFieldInModal('round2', 'D', 'D', !selectedEventForP2Marks)}
                      {renderMarksFieldInModal('round2', 'E1', 'E1', !selectedEventForP2Marks)}
                      {renderMarksFieldInModal('round2', 'E2', 'E2', !selectedEventForP2Marks)}
                      {renderMarksFieldInModal('round2', 'E3', 'E3', !selectedEventForP2Marks)}
                      {renderMarksFieldInModal('round2', 'E4', 'E4', !selectedEventForP2Marks)}
                      {renderMarksFieldInModal('round2', 'P', 'P', !selectedEventForP2Marks)}
                    </>
                  )}
                  <View style={styles.modalActions}>
                    <Button mode="outlined" onPress={() => setIsModalVisible(false)} style={{marginRight: 10}}>Cancel</Button>
                    <Button
                        mode="contained" // This button's disabled state is already handled
                        onPress={handleSaveMarks}
                        loading={loadingStudentMarks && !!selectedEventForP2Marks} // Show spinner on button when saving
                        disabled={loadingStudentMarks || !selectedEventForP2Marks} // Disable if loading or no event selected
                        buttonColor="#1565c0"
                    >
                      {existingMarkId ? "Update Marks" : "Save Marks"}
                    </Button>
                  </View>
                  {!selectedEventForP2Marks && (
                    <Text style={{textAlign: 'center', marginTop: 15, color: '#777'}}>Please select an event to enter marks.</Text>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FeedbackModal
        visible={feedbackModalVisible}
        message={feedbackModalMsg}
        type={feedbackModalType as FeedbackModalType}
        title={feedbackModalTitle}
        onClose={hideFeedbackModal}
      />

      <SupervisorBottomNavBarP2 navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- WEB LAYOUT STYLES ---
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
  safeArea: { flex: 1, backgroundColor: "#f5faff" },
  topShapeContainer: { // Matched AddMarksScreen
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150, 
    zIndex: 1,
  },
  topShape: { // Matched AddMarksScreen
    backgroundColor: "#1565c0",
    height: 150, 
    borderBottomLeftRadius: 60, 
    borderBottomRightRadius: 60,
    opacity: 0.15,
  },
  topBarContainer: { // Matched AddMarksScreen
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110, 
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 20, 
  },
  topBarInternal: { // Matched AddMarksScreen
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pageTitle: { // Matched AddMarksScreen
    fontSize: 24, 
    color: "#1565c0",
    fontWeight: "bold",
    textAlign: 'left',
    marginBottom: 2,
    marginTop: 20,
  },
  pageSubtitle: { // Matched AddMarksScreen
    fontSize: 15, 
    color: "#555",
    textAlign: 'left',
    marginTop: 2,
  },
  topBarLogo: { // Matched AddMarksScreen
    width: 100, 
    height: 100,
    marginLeft: 10,
    marginTop: -10,
  },
  mainContainer: { // Matched AddMarksScreen (mainContentContainer)
    flex: 1,
    paddingTop: 160, 
    paddingHorizontal: 16,
  },
  centeredLoader: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchCard: { // Matched Performance1ResultsScreen
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16, 
    elevation: 3,
    marginBottom: 16,
  },
  searchRow: { // New style for the search input and button row
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputWrapper: { // Wrapper for the TextInput and clear icon
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    backgroundColor: '#fff',
    height: 48, 
    paddingLeft: 8, // Padding for the text input
    marginRight: 8, // Space before the search IconButton
  },
  searchInputStyle: { 
    backgroundColor: "#fff", 
    flex: 1,
    height: 44, 
    fontSize: 15,
  },
  clearSearchInputIcon: { // Style for the clear IconButton
    marginRight: 0, 
    marginLeft: -4, 
  },
  searchActionIconBtn: { // Style for the search IconButton
    backgroundColor: "#e0e0e0", 
    borderRadius: 8, 
    height: 48, 
    width: 48, 
    justifyContent: 'center',
    alignItems: 'center',
    // marginLeft: 8, // Handled by searchInputWrapper's marginRight
  },
  studentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12, // Matched AddMarksScreen
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 10,
    elevation: 1, // Matched AddMarksScreen
  },
  studentInfo: { flex: 1, marginRight: 8 }, 
  studentName: { fontSize: 16, flexShrink: 1, marginRight: 8 }, // Matched AddMarksScreen
  studentNameContainer: { fontSize: 16, flexShrink: 1, marginRight: 8 }, // New style for the container of two lines
  studentIndex: {
    fontWeight: 'bold',
    color: '#1565c0',
  },
  studentDetail: { fontSize: 13, color: "#666", marginTop: 2 }, // Similar to eventDetailText
  studentActions: { flexDirection: "row", alignItems: 'center' }, // Matched AddMarksScreen
  editIconTouchable: { // To look like editIconBtn in AddMarksScreen
    margin: 0, 
    backgroundColor: 'transparent', 
    width: 36, 
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: { textAlign: "center", marginVertical: 30, fontSize: 15, color: "#555" },

  // Modal Styles
  modalOverlay: { // Matched AddMarksScreen
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.5)", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  modalContent: { // Matched AddMarksScreen
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxHeight: "85%",
    elevation: 5,
  },
  modalTitle: { // Matched AddMarksScreen
    fontSize: 18, 
    fontWeight: "bold", 
    marginBottom: 15, 
    textAlign: "center", 
    color: "#1565c0" 
  },
  pickerWrapperModal: { // Matched AddMarksScreen
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5, // Slightly different from AddMarksScreen's pickerWrapper, kept for now
    justifyContent: 'center',
    marginBottom: 15,
  },
  pickerModal: { height: 50, width: "100%" }, // Matched AddMarksScreen
  roundTitleModal: { // Matched AddMarksScreen (roundTitle)
    fontSize: 16, 
    fontWeight: "600", 
    marginTop: 10,
    marginBottom: 5,
    color: "#333" 
  },
  markInputRowModal: { // Removed
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputModal: { // Removed
    flex: 1,
    marginRight: 8,
    backgroundColor: "#f9f9f9", 
    fontSize: 16, // Increased font size
  }, 
  supInputModal: { // Removed
    flex: 1,
    backgroundColor: "#f9f9f9", 
    fontSize: 14 
  },
  addRoundButtonModal: { // Matched AddMarksScreen (addRoundButton)
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 10, // Adjusted from 12
    marginTop: 5, // Adjusted from 8
  },
  addRoundTextModal: { // Matched AddMarksScreen (addRoundText)
    marginLeft: 8, 
    color: "#1565c0", 
    fontSize: 15, 
  },
  modalActions: { // Matched AddMarksScreen
    flexDirection: "row", 
    justifyContent: "flex-end", 
    marginTop: 20, // Adjusted from 25
    paddingTop: 10, // Adjusted from 15
    borderTopWidth: 1, 
    borderTopColor: "#eee" 
  },
  disabledButtonOverlay: { opacity: 0.5 }, // For visually disabling touchable opacity

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
});
