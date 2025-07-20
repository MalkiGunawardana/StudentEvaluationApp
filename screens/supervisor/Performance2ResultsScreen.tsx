import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, IconButton, Text, TextInput } from "react-native-paper";
import { FeedbackModal, ModalType as FeedbackModalType } from "../../components/FeedbackModal";
import SupervisorWebSidebar from "../../components/supervisor/SupervisorWebSideBar";
import SupervisorBottomNavBarP2 from "../../components/SupervisorBottomNavBarP2"; // Added SupervisorBottomNavBarP2
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal"; // Import useFeedbackModal
import { useAuth } from "../../utils/AuthContext";
import { calculateRoundScore, isRoundDataEmpty } from "../../utils/calculationUtils";
import { formatScoreForCsv, formatScoreForDisplay, safeCsvText } from "../../utils/csvUtils";
import {
  EventDocument, FetchedStudentMarks, StudentDocument, // These interfaces are imported from firebaseRest.tsx
  fetchEvents, fetchStudentMarksForEvent, fetchStudents,
} from "../../utils/firebaseRest";
export default function Performance2ResultsScreen({ navigation }: any) {
  const { auth } = useAuth();
  const idToken = auth?.idToken;
  const supervisorId = auth?.uid;

  const [searchTerm, setSearchTerm] = useState("");
  const [studentsWithAllEventMarks, setStudentsWithAllEventMarks] = useState<(StudentDocument & { eventResults: StudentEventResult[] })[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<(StudentDocument & { eventResults: StudentEventResult[] })[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(true); 
  // const [downloadingAll, setDownloadingAll] = useState(false); // Commented out as per request
  const [downloadingMaleCsv, setDownloadingMaleCsv] = useState(false); // For Male P2 results
  const [downloadingFemaleCsv, setDownloadingFemaleCsv] = useState(false); // For Female P2 results

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<(StudentDocument & { eventResults: StudentEventResult[] }) | null>(null);

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

  const [allEventDetails, setAllEventDetails] = useState<EventDocument[]>([]);
  useEffect(() => {
    const loadInitial = async () => {
      if (!idToken) return;
      setLoadingInitialData(true);
      try {
        const fetched = await fetchEvents(idToken);
        setAllEventDetails(fetched);
      } catch (error: any) {
        displayModal("Failed to load event details: " + error.message, "error", "Load Error", { autoClose: false });
      } finally {
        setLoadingInitialData(false);
      }
    };
    loadInitial();
  }, [idToken, displayModal]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      displayModal("Please enter a name or ID number to search.", "error", "Search Error");
      return;
    }
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error", { autoClose: false });
      return;
    }
    setLoading(true);
    setFilteredStudents([]);
    setStudentsWithAllEventMarks([]);
    try {
      const allStudentsList = await fetchStudents(idToken); 
      const term = searchTerm.toLowerCase();
      const matchedStudents = allStudentsList.filter(s => 
        (s.fullName && typeof s.fullName === 'string' && s.fullName.toLowerCase().includes(term)) ||
        (s.indexNo && typeof s.indexNo === 'string' && s.indexNo.toLowerCase().includes(term))
      );

      const studentsWithResults: (StudentDocument & { eventResults: StudentEventResult[] })[] = [];

      for (const student of matchedStudents) {
        const studentEventResults: StudentEventResult[] = [];
        for (const event of allEventDetails) { 
          const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
          // Only process marks if they are for "performance 2"
          if (marks && marks.performance === "performance 2") {
            const round1ScoreVal = calculateRoundScore(marks.rounds.round1);
            let finalScoreVal = round1ScoreVal;
            let round2ScoreVal: number | undefined = undefined;

            if (marks.rounds.round2 && !isRoundDataEmpty(marks.rounds.round2)) {
              round2ScoreVal = calculateRoundScore(marks.rounds.round2);
              finalScoreVal = (round1ScoreVal + (round2ScoreVal || 0)) / 2;
            }
            studentEventResults.push({
              marks,
              eventDetails: event,
              calculatedScores: { round1Score: round1ScoreVal, round2Score: round2ScoreVal, finalScore: finalScoreVal }
            });
          }
        }
        if (studentEventResults.length > 0) {
          studentsWithResults.push({ ...student, eventResults: studentEventResults.filter(er => er.marks.performance === "performance 2") });
        }
      }
      setStudentsWithAllEventMarks(studentsWithResults);
      setFilteredStudents(studentsWithResults);

      if (studentsWithResults.length === 0) {
        displayModal("No results found for any student matching your criteria.", "info", "Search Results");
      }
    } catch (error: any) {
      displayModal("Error fetching results: " + error.message, "error", "Fetch Error", { autoClose: false });
    } finally {
      setLoading(false);
    }
  };

  const openResultModal = (student: StudentDocument & { eventResults: StudentEventResult[] }) => {
    setSelectedStudentForModal(student);
    setIsModalVisible(true);
  };

  // const handleDownloadAllResultsAsCsv = async () => { // Commented out as per request
  //   setDownloadingAll(true);
  //   try {
  //       if (!idToken) {
  //           displayModal("Authentication error.", "error", "Auth Error", { autoClose: false });
  //           setDownloadingAll(false);
  //           return;
  //       }

  //       const allStudentsList = await fetchStudents(idToken); 
  //       if (allStudentsList.length === 0) {
  //           displayModal("No students found in the system.", "info", "No Data");
  //           setDownloadingAll(false);
  //           return;
  //       }

  //       let csvString = "Student Name,Index No,Province,Team,Event Name,Event Batch,Event Gender,Performance,Round 1 Score,Round 2 Score,Final Score\n";
  //       let resultsFoundForAnyStudent = false;

  //       for (const student of allStudentsList) { 
  //           for (const event of allEventDetails) {
  //               const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
  //               // Only include marks if they are for "performance 2"
  //               if (marks && marks.performance === "performance 2") {
  //                   resultsFoundForAnyStudent = true;
  //                   const round1ScoreVal = calculateRoundScore(marks.rounds.round1);
  //                   let finalScoreVal = round1ScoreVal;
  //                   let round2ScoreVal: number | undefined = undefined;

  //                   if (marks.rounds.round2 && !isRoundDataEmpty(marks.rounds.round2)) {
  //                       round2ScoreVal = calculateRoundScore(marks.rounds.round2);
  //                       finalScoreVal = (round1ScoreVal + (round2ScoreVal || 0)) / 2;
  //                   }

  //                   const studentName = `"${student.fullName.replace(/"/g, '""')}"`;
  //                   const indexNo = student.indexNo;
  //                   const province = `"${(student.province || 'N/A').replace(/"/g, '""')}"`;
  //                   const team = student.team || "N/A"; 
  //                   const eventName = `"${event.eventName.replace(/"/g, '""')}"`;
  //                   // const eventBatch = event.batch; // Batch functionality removed
  //                   const eventGender = event.gender;
  //                   const performance = `"${(marks.performance || 'N/A').replace(/"/g, '""')}"`;
  //                   const round1ScoreStr = round1ScoreVal.toFixed(2);
  //                   const round2ScoreStr = round2ScoreVal !== undefined ? round2ScoreVal.toFixed(2) : "N/A";
  //                   const finalScoreStr = finalScoreVal.toFixed(2);

  //                   csvString += `${studentName},${indexNo},${province},${team},${eventName},${eventGender},${performance},${round1ScoreStr},${round2ScoreStr},${finalScoreStr}\n`; // Removed eventBatch
  //               }
  //           }
  //       }

  //       if (!resultsFoundForAnyStudent) {
  //           displayModal("No marks found for any student in any event.", "info", "No Data");
  //           setDownloadingAll(false);
  //           return;
  //       }

  //       const filename = "all_student_performance_2_results.csv"; // Changed filename slightly
  //       const fileUri = FileSystem.cacheDirectory + filename;
  //       await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });

  //       if (await Sharing.isAvailableAsync()) {
  //           await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Download All P2 Results', UTI: 'public.comma-separated-values-text' });
  //       } else {
  //           displayModal("Sharing is not available on this device.", "error", "Device Error");
  //       }
  //   } catch (error: any) {
  //       displayModal("Failed to generate all results CSV: " + error.message, "error", "CSV Error", { autoClose: false });
  //   } finally {
  //       setDownloadingAll(false);
  //   }
  // };

  // Modernized: Download CSV on web, share on mobile, styled like Performance1ResultsScreen
  const handleDownloadGenderSpecificP2ResultsCsv = async (genderCategory: 'Male' | 'Female') => {
    if (!idToken) {
      displayModal("Authentication error.", 'error', "Auth Error", { autoClose: false });
      return;
    }
    if (allEventDetails.length === 0) {
      displayModal(`No events available to generate ${genderCategory.toLowerCase()} P2 results.`, 'info', "No Events");
      return;
    }

    if (genderCategory === 'Male') setDownloadingMaleCsv(true);
    else setDownloadingFemaleCsv(true);
    displayModal(`Preparing ${genderCategory} Performance 2 CSV...`, 'info', "CSV Export", { autoClose: true, autoCloseDelay: 4000 });

    try {
      const allStudentsList = await fetchStudents(idToken);
      if (allStudentsList.length === 0) {
        displayModal("No students found.", 'info', "No Data");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      const genderSpecificEvents = allEventDetails.filter(event => event.gender.toLowerCase() === genderCategory.toLowerCase());
      if (genderSpecificEvents.length === 0) {
        hideFeedbackModal();
        displayModal(`No ${genderCategory.toLowerCase()} events found.`, 'info', "No Events");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      let csvString = `Performance 2 Results\n`;
      csvString += `Gender:,${genderCategory}\n\n`;
      csvString += "Student Name,ID,Province,Team,Event Name,Round 1 Score,Round 2 Score,Final Score\n";
      let resultsFoundForGender = false;

      for (const event of genderSpecificEvents) {
        for (const student of allStudentsList) {
          const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
          if (marks && marks.performance === "performance 2") {
            resultsFoundForGender = true;
            const round1ScoreVal = calculateRoundScore(marks.rounds.round1);
            let finalScoreVal = round1ScoreVal;
            let round2ScoreVal: number | undefined = undefined;

            if (marks.rounds.round2 && !isRoundDataEmpty(marks.rounds.round2)) {
              round2ScoreVal = calculateRoundScore(marks.rounds.round2);
              finalScoreVal = (round1ScoreVal + (round2ScoreVal || 0)) / 2;
            }

            const indexNo = safeCsvText(student.indexNo);
            const studentName = safeCsvText(student.fullName);
            const provinceCsv = safeCsvText(student.province);
            const teamCsv = safeCsvText(student.team);
            const eventNameCsv = safeCsvText(event.eventName);
            const round1ScoreStr = formatScoreForCsv(round1ScoreVal);
            const round2ScoreStr = formatScoreForCsv(round2ScoreVal);
            const finalScoreStr = formatScoreForCsv(finalScoreVal);
            csvString += `${studentName},${indexNo},${provinceCsv},${teamCsv},${eventNameCsv},${round1ScoreStr},${round2ScoreStr},${finalScoreStr}\n`;
          }
        }
      }

      if (!resultsFoundForGender) {
        hideFeedbackModal();
        displayModal(`No 'Performance 2' marks found for ${genderCategory.toLowerCase()} events.`, 'info', "No Data");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      const filename = `${genderCategory.toLowerCase()}_performance_2_results.csv`;

      if (Platform.OS === 'web') {
        // Web: Use Blob and anchor for download
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        hideFeedbackModal();
        displayModal(`${genderCategory} P2 Results CSV downloaded.`, 'success', "Downloaded");
      } else {
        // Mobile: Use FileSystem and Sharing
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
        hideFeedbackModal();
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Download ${genderCategory} P2 Results`, UTI: 'public.comma-separated-values-text' });
          displayModal(`${genderCategory} P2 Results CSV shared.`, 'success', "Shared");
        } else {
          displayModal("Sharing is not available on this device.", "error", "Device Error");
        }
      }
    } catch (error: any) {
      hideFeedbackModal();
      displayModal(`Failed to generate ${genderCategory} P2 CSV: ${error.message}`, 'error', "CSV Error", { autoClose: false });
    } finally {
      if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
    }
  };

  const TopBarContent = () => (
    <View style={styles.topBarInternal}>
      <View style={{flex: 1}}>
        <Text style={styles.pageTitle}>Performance 2 Results</Text> 
        <Text style={styles.pageSubtitle}>View student scores for events.</Text>
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

  // --- WEB LAYOUT ---
  if (Platform.OS === 'web') {
    if (loadingInitialData) {
      return (
        <View style={{ flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' }}>
          <SupervisorWebSidebar navigation={navigation} />
          <View style={{ flex: 1, padding: 32 }}>
            <View style={{ marginBottom: 32 }}>
              <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#1A202C' }}>Performance 2 Results</Text>
              <Text style={{ fontSize: 16, color: '#718096', marginTop: 4 }}>View student scores for events.</Text>
            </View>
            <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#bbb', borderRadius: 8, backgroundColor: '#fff', height: 48, paddingLeft: 8, marginRight: 8 }}>
                  <TextInput
                    placeholder="Search by Name or ID"
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    style={{ backgroundColor: '#fff', flex: 1, height: 44, fontSize: 15 }}
                    mode="flat"
                    dense
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                  />
                  {searchTerm ? (
                    <IconButton icon="close-circle-outline" size={20} onPress={() => setSearchTerm("")} style={{ marginRight: 0, marginLeft: -4 }} iconColor="#e53935" />
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={handleSearch}
                  disabled={loading || loadingInitialData}
                  style={[{ backgroundColor: '#e0e0e0', borderRadius: 8, height: 48, width: 48, justifyContent: 'center', alignItems: 'center' }, (loading || loadingInitialData) && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Search"
                >
                  <Text>
                    <IconButton icon="magnify" size={28} iconColor="#1565c0" style={{ backgroundColor: 'transparent', margin: 0, padding: 0 }} />
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8, marginBottom: 16 }}>
                <Button
                  icon="download"
                  mode="contained"
                  onPress={() => handleDownloadGenderSpecificP2ResultsCsv('Male')}
                  disabled={downloadingMaleCsv || downloadingFemaleCsv || loading || loadingInitialData}
                  loading={downloadingMaleCsv}
                  style={{ flex: 1, marginHorizontal: 4, height: 48, justifyContent: 'center', backgroundColor: '#00796b' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}
                >
                  Male P2 Results
                </Button>
                <Button
                  icon="download"
                  mode="outlined"
                  onPress={() => handleDownloadGenderSpecificP2ResultsCsv('Female')}
                  disabled={downloadingMaleCsv || downloadingFemaleCsv || loading || loadingInitialData}
                  loading={downloadingFemaleCsv}
                  style={{ flex: 1, marginHorizontal: 4, height: 48, justifyContent: 'center', borderColor: '#00796b', borderWidth: 2 }}
                  labelStyle={{ color: '#00796b', fontWeight: 'bold', fontSize: 13 }}
                >
                  Female P2 Results
                </Button>
              </View>
              {loading ? (
                <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={filteredStudents}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={{ backgroundColor: '#fff', borderRadius: 8, padding: 15, marginBottom: 10, elevation: 1 }} onPress={() => openResultModal(item)}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{`${safeRenderText(item.fullName, 'Unknown Name')} (${safeRenderText(item.indexNo, 'No ID')})`}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    !loading && searchTerm ? <Text style={{ textAlign: 'center', marginTop: 30, fontSize: 16, color: '#666' }}>No results found.</Text> : <Text style={{ textAlign: 'center', marginTop: 30, fontSize: 16, color: '#666' }}>Enter search term to find student results.</Text>
                  }
                  contentContainerStyle={{ paddingBottom: 70 }}
                />
              )}
            </View>
            <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} transparent animationType="slide">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 20, width: '90%', maxHeight: '80%', elevation: 5 }}>
                  <ScrollView>
                    {selectedStudentForModal && (
                      <>
                        <Text style={{ fontSize: 16, color: '#333', marginBottom: 8, lineHeight: 22 }}>
                          <Text style={{ fontWeight: 'bold' }}>Student: </Text>
                          {`${selectedStudentForModal.fullName} (${selectedStudentForModal.indexNo})`}
                        </Text>
                        {selectedStudentForModal.eventResults.length > 0 ? (
                          selectedStudentForModal.eventResults.map((result, index) => (
                            <View key={index} style={{ marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                              <Text style={{ fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                                <Text style={{ fontWeight: 'bold' }}>Event: </Text>{result.eventDetails.eventName}
                              </Text>
                              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E88E5', marginTop: 10, textAlign: 'center' }}>
                                <Text style={{ fontWeight: 'bold' }}>Final Score: </Text>{formatScoreForDisplay(result.calculatedScores.finalScore)}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={{ textAlign: 'center', marginTop: 30, fontSize: 16, color: '#666' }}>No event results found for this student.</Text>
                        )}
                      </>
                    )}
                    <Button onPress={() => setIsModalVisible(false)} mode="contained" style={{ marginTop: 20 }} buttonColor="#1565c0">
                      Close
                    </Button>
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
        </View>
      );
    }
    // Main web layout (after loading)
    return (
      <View style={{ flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' }}>
        <SupervisorWebSidebar navigation={navigation} />
        <View style={{ flex: 1, padding: 32 }}>
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#1A202C' }}>Performance 2 Results</Text>
            <Text style={{ fontSize: 16, color: '#718096', marginTop: 4 }}>View student scores for events.</Text>
          </View>
          <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#bbb', borderRadius: 8, backgroundColor: '#fff', height: 48, paddingLeft: 8, marginRight: 8 }}>
                <TextInput
                  placeholder="Search by Name or ID"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={{ backgroundColor: '#fff', flex: 1, height: 44, fontSize: 15 }}
                  mode="flat"
                  dense
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                />
                {searchTerm ? (
                  <IconButton icon="close-circle-outline" size={20} onPress={() => setSearchTerm("")} style={{ marginRight: 0, marginLeft: -4 }} iconColor="#e53935" />
                ) : null}
              </View>
              <TouchableOpacity
                onPress={handleSearch}
                disabled={loading || loadingInitialData}
                style={[{ backgroundColor: '#e0e0e0', borderRadius: 8, height: 48, width: 48, justifyContent: 'center', alignItems: 'center' }, (loading || loadingInitialData) && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <Text>
                  <IconButton icon="magnify" size={28} iconColor="#1565c0" style={{ backgroundColor: 'transparent', margin: 0, padding: 0 }} />
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8, marginBottom: 16 }}>
              <Button
                icon="download"
                mode="contained"
                onPress={() => handleDownloadGenderSpecificP2ResultsCsv('Male')}
                disabled={downloadingMaleCsv || downloadingFemaleCsv || loading || loadingInitialData}
                loading={downloadingMaleCsv}
                style={{ flex: 1, marginHorizontal: 4, height: 48, justifyContent: 'center', backgroundColor: '#00796b' }}
                labelStyle={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}
              >
                Male P2 Results
              </Button>
              <Button
                icon="download"
                mode="outlined"
                onPress={() => handleDownloadGenderSpecificP2ResultsCsv('Female')}
                disabled={downloadingMaleCsv || downloadingFemaleCsv || loading || loadingInitialData}
                loading={downloadingFemaleCsv}
                style={{ flex: 1, marginHorizontal: 4, height: 48, justifyContent: 'center', borderColor: '#00796b', borderWidth: 2 }}
                labelStyle={{ color: '#00796b', fontWeight: 'bold', fontSize: 13 }}
              >
                Female P2 Results
              </Button>
            </View>
            {loading ? (
              <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filteredStudents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={{ backgroundColor: '#fff', borderRadius: 8, padding: 15, marginBottom: 10, elevation: 1 }} onPress={() => openResultModal(item)}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{`${safeRenderText(item.fullName, 'Unknown Name')} (${safeRenderText(item.indexNo, 'No ID')})`}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !loading && searchTerm ? <Text style={{ textAlign: 'center', marginTop: 30, fontSize: 16, color: '#666' }}>No results found.</Text> : <Text style={{ textAlign: 'center', marginTop: 30, fontSize: 16, color: '#666' }}>Enter search term to find student results.</Text>
                }
                contentContainerStyle={{ paddingBottom: 70 }}
              />
            )}
          </View>
          <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 20, width: '90%', maxHeight: '80%', elevation: 5 }}>
                <ScrollView>
                  {selectedStudentForModal && (
                    <>
                      <Text style={{ fontSize: 16, color: '#333', marginBottom: 8, lineHeight: 22 }}>
                        <Text style={{ fontWeight: 'bold' }}>Student: </Text>
                        {`${selectedStudentForModal.fullName} (${selectedStudentForModal.indexNo})`}
                      </Text>
                      {selectedStudentForModal.eventResults.length > 0 ? (
                        selectedStudentForModal.eventResults.map((result, index) => (
                          <View key={index} style={{ marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                            <Text style={{ fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                              <Text style={{ fontWeight: 'bold' }}>Event: </Text>{result.eventDetails.eventName}
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1E88E5', marginTop: 10, textAlign: 'center' }}>
                              <Text style={{ fontWeight: 'bold' }}>Final Score: </Text>{formatScoreForDisplay(result.calculatedScores.finalScore)}
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={{ textAlign: 'center', marginTop: 30, fontSize: 16, color: '#666' }}>No event results found for this student.</Text>
                      )}
                    </>
                  )}
                  <Button onPress={() => setIsModalVisible(false)} mode="contained" style={{ marginTop: 20 }} buttonColor="#1565c0">
                    Close
                  </Button>
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
      </View>
    );
  }
  // --- MOBILE/TABLET LAYOUT ---
  // Use type-safe conditional style logic as in Performance1ResultsScreen
  const isWeb = (Platform.OS as string) === 'web';
  return (
    <SafeAreaView style={styles.safeArea}>
      <TopShape />
      <View
        style={{
          ...styles.mainContentContainer,
          ...(isWeb ? { maxWidth: 1100, marginHorizontal: 'auto', width: '100%' } : {})
        }}
      >
        <View
          style={{
            ...styles.filterCard,
            ...(isWeb ? { maxWidth: 900, marginHorizontal: 'auto', width: '100%' } : {})
          }}
        >
          <View
            style={{
              ...styles.searchRow,
              ...(isWeb ? { flexWrap: 'nowrap' } : {})
            }}
          >
            <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#bbb', borderRadius: 8, backgroundColor: '#fff'}}>
              <TextInput
                placeholder="Search by Name or ID"
                value={searchTerm}
                onChangeText={setSearchTerm}
                style={styles.searchInput}
                mode="flat"
                dense
                underlineColor="transparent"
                activeUnderlineColor="transparent"
              />
              {searchTerm ? (
                <IconButton icon="close-circle-outline" size={20} onPress={() => setSearchTerm("")} style={styles.clearSearchIconBtn} iconColor="#e53935"/>
              ) : null}
            </View>
            <IconButton 
              icon="magnify" 
              size={28} 
              onPress={handleSearch} 
              style={styles.searchActionIconBtn}
              iconColor="#1565c0"
              disabled={loading || loadingInitialData} />
          </View>
        </View>

        {/* Gender Specific Download Buttons */}
        <View style={{
          ...styles.downloadButtonsRow,
          ...(isWeb ? { maxWidth: 900, marginHorizontal: 'auto', width: '100%' } : {})
        }}>
          <Button
            icon="download"
            mode="contained"
            onPress={() => handleDownloadGenderSpecificP2ResultsCsv('Male')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loading || loadingInitialData}
            loading={downloadingMaleCsv}
            style={[styles.genderDownloadButton, styles.maleButton]}
            labelStyle={styles.maleButtonLabel}
          >
            Male P2 Results
          </Button>
          <Button
            icon="download"
            mode="outlined"
            onPress={() => handleDownloadGenderSpecificP2ResultsCsv('Female')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loading || loadingInitialData}
            loading={downloadingFemaleCsv}
            style={[styles.genderDownloadButton, styles.femaleButton]}
            labelStyle={styles.femaleButtonLabel}
          >
            Female P2 Results
          </Button>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredStudents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.studentItem} onPress={() => openResultModal(item)}>
                <Text style={styles.studentName}>{safeRenderText(item.fullName, 'Unknown Name')} ({safeRenderText(item.indexNo, 'No ID')})</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !loading && searchTerm ? <Text style={styles.emptyListText}>No results found.</Text> : <Text style={styles.emptyListText}>Enter search term to find student results.</Text>
            }
            contentContainerStyle={styles.listContentContainer}
          />
        )}
      </View>

      <Modal visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {selectedStudentForModal && (
                <>
                  <Text style={styles.modalDetailText}><Text style={styles.modalLabel}>Student:</Text> {safeRenderText(selectedStudentForModal.fullName)} ({safeRenderText(selectedStudentForModal.indexNo)})</Text>
                  {selectedStudentForModal.eventResults.length > 0 ? (
                    selectedStudentForModal.eventResults.map((result, index) => (
                      <View key={index} style={styles.eventResultBlock}>
                        <Text style={styles.modalEventName}><Text style={styles.modalLabel}>Event:</Text> {result.eventDetails.eventName}</Text>
                        <Text style={styles.finalScoreText}><Text style={styles.modalLabel}>Final Score:</Text> {formatScoreForDisplay(result.calculatedScores.finalScore)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyListText}>No event results found for this student.</Text>
                  )}
                </>
              )}
              <Button onPress={() => setIsModalVisible(false)} mode="contained" style={{ marginTop: 20 }} buttonColor="#1565c0">
                Close
              </Button>
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

interface CalculatedScores { round1Score?: number; round2Score?: number; finalScore: number; }
interface StudentEventResult { marks: FetchedStudentMarks; eventDetails: EventDocument; calculatedScores: CalculatedScores; }
// Helper function to safely render text, providing a fallback for null/undefined/empty.
// This is for UI display, not CSV. safeCsvText is for CSV.
const safeRenderText = (value: any, fallback: string = 'N/A'): string => {
  if (value === null || value === undefined) { return fallback; }
  const str = String(value).trim();
  return str === '' ? fallback : str;
};

// Styles are identical to Performance1ResultsScreen, so they are copied here.
// For a real app, these styles should be refactored into a shared stylesheet or theme.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5faff" },
  topShapeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150, // Matched P1ResultsScreen
    zIndex: 1,
  },
  topShape: {
    backgroundColor: "#1565c0",
    height: 150, // Matched P1ResultsScreen
    borderBottomLeftRadius: 60, // Matched P1ResultsScreen
    borderBottomRightRadius: 60,
    opacity: 0.15,
  },
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110, // Matched P1ResultsScreen
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 20, // Matched P1ResultsScreen
  },
  topBarInternal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10, 
  },
  pageTitle: { 
    fontSize: 21, // Matched P1ResultsScreen
    color: "#1565c0", 
    fontWeight: "bold", 
    textAlign: 'left', 
    marginBottom: 2, 
    marginTop: 20, 
  },
  pageSubtitle: { 
    fontSize: 15, // Matched P1ResultsScreen
    color: "#555", 
    textAlign: 'left',
    marginTop: 2, 
  },
  topBarLogo: { 
    width: 100, // Matched P1ResultsScreen
    height: 100, 
    marginLeft: 10,
    marginTop: 0, 
  },
  mainContentContainer: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 160 // Adjusted for larger top shape
  },
  centeredLoader: { flex: 1, justifyContent: "center", alignItems: "center" },
  filterCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, elevation: 3, marginBottom: 16 },
  pickerWrapper: { height: 48, borderColor: "#bbb", borderWidth: 1, borderRadius: 8, justifyContent: 'center', backgroundColor: "#fff", marginBottom: 10 },
  picker: { height: 48, width: "100%" },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchInput: { 
    flex: 1, 
    height: 46, 
    backgroundColor: "transparent", 
    fontSize: 15,
  },
  clearSearchIconBtn: { 
    marginRight: 0,
    marginLeft: -4, 
  },
  searchActionIconBtn: { 
    backgroundColor: "#e0e0e0", 
    borderRadius: 8, 
    height: 48, 
    width: 48, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginLeft: 8,
  },
  downloadAllButton: { marginTop: 10, borderColor: '#00796b', borderWidth: 1.5 }, // Styled like P1ResultsScreen
  listContentContainer: { paddingBottom: 70 },
  studentItem: { backgroundColor: "#fff", borderRadius: 8, padding: 15, marginBottom: 10, elevation: 1 },
  studentName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  studentBatch: { fontSize: 14, color: "#666", marginTop: 4 },
  emptyListText: { textAlign: "center", marginTop: 30, fontSize: 16, color: "#666" },
  eventResultBlock: { marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#eee" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", borderRadius: 10, padding: 20, width: "90%", maxHeight: "80%", elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15, textAlign: "center", color: "#1565c0" },
  modalEventName: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 8},
  modalDetailText: { fontSize: 16, color: "#333", marginBottom: 8, lineHeight: 22 },
  modalLabel: { fontWeight: "bold" },
  scoreSeparator: { height: 1, backgroundColor: "#e0e0e0", marginVertical: 10 },
  finalScoreText: { fontSize: 18, fontWeight: "bold", color: "#1E88E5", marginTop: 10, textAlign: "center" },
  downloadAllButtonText: { // Added for outlined download button text color
    color: '#00796b',
    fontWeight: 'bold',
  },
  // Styles for gender specific download buttons (copied from Performance1ResultsScreen)
  downloadButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    marginBottom: 16, // Space below the buttons before the list
  },
  genderDownloadButton: {
    flex: 1,
    marginHorizontal: 4,
    height: 48,
    justifyContent: 'center',
  },
  maleButton: {
    backgroundColor: '#00796b', 
  },
  femaleButton: {
    borderColor: '#00796b', 
    borderWidth: 2,
  },
  maleButtonLabel: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  femaleButtonLabel: { color: '#00796b', fontWeight: 'bold', fontSize: 13 },
});
