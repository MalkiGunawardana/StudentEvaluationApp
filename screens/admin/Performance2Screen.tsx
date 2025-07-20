import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper'; // Assuming react-native-paper is available
import { FeedbackModal, ModalType as FeedbackModalType } from '../../components/FeedbackModal';
import { ShowModalOptions, useFeedbackModal } from '../../hooks/useFeedbackModal'; // Correct import for useFeedbackModal
import { useAuth } from '../../utils/AuthContext';
import { formatScoreForCsv, safeCsvText } from '../../utils/csvUtils'; // Import safeCsvText and formatScoreForCsv for robust CSV formatting
import {
  EventDocument,
  FetchedStudentMarks,
  MarksEntryData,
  StudentDocument,
  fetchEvents,
  fetchStudentMarksForEvent,
  fetchStudents,
} from '../../utils/firebaseRest';

// --- Helper Functions (copied from supervisor screens for consistency) ---
const calculateRoundScore = (marks: MarksEntryData): number => {
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

  let sumOfMiddleE = sumOfAllE - minE - maxE;
  let divisor = 2;

  if (E_scores_num.length === 2) {
    sumOfMiddleE = 0;
    divisor = 1;
  } else if (E_scores_num.length === 3) {
    divisor = 1;
  }
  const averageMiddleE = divisor > 0 ? sumOfMiddleE / divisor : 0;
  return averageMiddleE + D - P;
};

const isRoundDataEmpty = (marks: MarksEntryData | undefined): boolean => {
  if (!marks) return true;
  return Object.values(marks).every(value => value === "" || value === undefined);
};

const getFinalP2Score = (roundsData: FetchedStudentMarks['rounds']): number => {
  const round1Score = calculateRoundScore(roundsData.round1);
  if (roundsData.round2 && !isRoundDataEmpty(roundsData.round2)) {
    const round2Score = calculateRoundScore(roundsData.round2);
    return (round1Score + round2Score) / 2;
  }
  return round1Score;
};
// --- End Helper Functions ---
const initialMarksState: MarksEntryData = { D: "", E1: "", E2: "", E3: "", E4: "", P: "" };

// Interface for the combined data we'll display for each top student


interface StudentScoreData {
  student: StudentDocument;
  finalScore: number;
  marksPerformanceType?: string; // To ensure we only consider 'performance 2'
}

interface PlaceDetails {
  placeName: string; // "1st Place", "2nd Place", "3rd Place"
  score?: number;
  winners: StudentDocument[];
}

export default function Performance2Screen({ isEmbedded }: { isEmbedded?: boolean }) {
  const { auth } = useAuth();
  const idToken = auth?.idToken;

  const [allEvents, setAllEvents] = useState<EventDocument[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null); // For Picker
  const [rankedResults, setRankedResults] = useState<PlaceDetails[]>([]);

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  // const [downloadingAllCsv, setDownloadingAllCsv] = useState(false); // Removed as per request
  const [downloadingMaleCsv, setDownloadingMaleCsv] = useState(false); // For Male P2 results
  const [downloadingFemaleCsv, setDownloadingFemaleCsv] = useState(false); // For Female P2 results

  const {
    modalVisible: feedbackModalVisible,
    modalMsg: feedbackModalMsg,
    modalType: feedbackModalType,
    modalTitle: feedbackModalTitle,
    showModal: showFeedbackModalRaw, // Add showModal from the hook
    hideModal: hideFeedbackModal,   // Add hideModal from the hook
  } = useFeedbackModal(); // Complete the assignment
  
  const displayModal = useCallback((
    message: string,
    type: FeedbackModalType, // Use the imported ModalType
    title?: string,
    options?: ShowModalOptions
  ) => {
    const defaultTitle = type === "success" ? "Success!" : type === "error" ? "Error!" : "Information";
    const effectiveTitle = title || defaultTitle;
    // Default autoClose to true for success/info, false for error, unless overridden in options
    const autoClose = options?.autoClose !== undefined ? options.autoClose : (type === "success" || type === "info");
    
    showFeedbackModalRaw(message, type, effectiveTitle, { ...options, autoClose });
  }, [showFeedbackModalRaw]);

  useEffect(() => {
    const loadEvents = async () => {
      if (!idToken) {
        setLoadingEvents(false);
        return;
      }
      try {
        setLoadingEvents(true);
        const fetchedEvents = await fetchEvents(idToken);
        setAllEvents(fetchedEvents);
        if (fetchedEvents.length === 0) {
          displayModal("No events found.", 'info', "Events");
        }
      } catch (error: any) {
        displayModal(`Failed to load events: ${error.message}`, 'error', "Load Error", { autoClose: false });
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, [idToken, displayModal]);

  useEffect(() => {
    if (!selectedEventId) {
      setRankedResults([]); // Clear results if no event is selected
    }
  }, [selectedEventId]);

  const handleClearSelection = () => {
    setSelectedEventId(null);
    // rankedResults will be cleared by the useEffect above
  };

  const handleSearch = async () => {
    if (!selectedEventId) {
      displayModal("Please select an event to view results.", 'info', "Selection Required");
      return;
    }
    if (!idToken) {
      displayModal("Authentication error. Please try again.", 'error', "Auth Error", { autoClose: false });
      return;
    }
    setLoadingResults(true);
    setRankedResults([]);

    try {
      const foundEvent = allEvents.find(event => event.id === selectedEventId);
      if (!foundEvent) {
        displayModal("Selected event not found. Please refresh.", 'error', "Event Error");
        setLoadingResults(false);
        return;
      }

      const allStudentsList = await fetchStudents(idToken);
      const studentScores: StudentScoreData[] = [];

      for (const student of allStudentsList) {
        const marks = await fetchStudentMarksForEvent(student.id, foundEvent.id, idToken);
        if (marks && marks.performance === "performance 2") {
          const finalScore = getFinalP2Score(marks.rounds);
          studentScores.push({ student, finalScore, marksPerformanceType: marks.performance });
        }
      }
      if (studentScores.length === 0) {
        displayModal(`No 'Performance 2' marks found for "${foundEvent.eventName}".`, 'info', "No Marks");
        setLoadingResults(false);
        return;
      }

      // Sort students by final score in descending order
      studentScores.sort((a, b) => b.finalScore - a.finalScore);

      const newRankedResults: PlaceDetails[] = [];
      const placeNames = ["1st Place", "2nd Place", "3rd Place"];
      const uniqueScores: number[] = [];

      // Get unique scores from the sorted list
      studentScores.forEach(ss => {
        if (!uniqueScores.includes(ss.finalScore)) {
          uniqueScores.push(ss.finalScore);
        }
      });
      
      for (let i = 0; i < Math.min(placeNames.length, uniqueScores.length); i++) {
        const currentPlaceScore = uniqueScores[i];
        const winnersForPlace = studentScores
          .filter(ss => ss.finalScore === currentPlaceScore)
          .map(ss => ss.student);
        
        if (winnersForPlace.length > 0) {
          newRankedResults.push({
            placeName: placeNames[i],
            score: currentPlaceScore,
            winners: winnersForPlace,
          });
        }
      }
      
      setRankedResults(newRankedResults);
      if (newRankedResults.length === 0 && studentScores.length > 0) {
         displayModal("Sufficient data not available to determine top 3 places.", 'info', "Results");
      } else if (newRankedResults.length === 0) {
         displayModal("No results to display for top places.", 'info', "Results");
      }

    } catch (error: any) {
      displayModal(`Error fetching results: ${error.message}`, 'error', "Fetch Error", { autoClose: false });
    } finally {
      setLoadingResults(false);
    }
  };

  const handleDownloadGenderSpecificP2ResultsCsv = async (genderCategory: 'Male' | 'Female') => {
    if (!idToken) {
      displayModal("Authentication error.", 'error', "Auth Error", { autoClose: false });
      return;
    }
    if (allEvents.length === 0) {
      displayModal(`No events available to generate ${genderCategory.toLowerCase()} results.`, 'info', "No Events");
      return;
    }

    if (genderCategory === 'Male') {
      setDownloadingMaleCsv(true);
    } else {
      setDownloadingFemaleCsv(true);
    }
    displayModal(`Preparing ${genderCategory} Performance 2 CSV...`, 'info', "CSV Export", { autoClose: true, autoCloseDelay: 4000 });

    try {
      const allStudentsList = await fetchStudents(idToken);
      if (allStudentsList.length === 0) {
        displayModal("No students found.", 'info', "No Data");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      const genderSpecificEvents = allEvents.filter(event => event.gender.toLowerCase() === genderCategory.toLowerCase());
      if (genderSpecificEvents.length === 0) {
        hideFeedbackModal();
        displayModal(`No ${genderCategory.toLowerCase()} events found.`, 'info', "No Events");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      let csvString = `Performance 2 Top 3 Results\n`;
      csvString += `Gender:,${genderCategory}\n\n`; // Separate line for gender with space

      // Headers
      csvString += "Event Name,Place,ID,Student Name,Score\n"; // Header updated
      let resultsFoundForGender = false;

      for (const event of genderSpecificEvents) {
        const studentScoresForEvent: StudentScoreData[] = [];
        for (const student of allStudentsList) {
          const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
          if (marks && marks.performance === "performance 2") {
            const finalScore = getFinalP2Score(marks.rounds);
            studentScoresForEvent.push({ student, finalScore });
          }
        }

        if (studentScoresForEvent.length > 0) {
          resultsFoundForGender = true;
          studentScoresForEvent.sort((a, b) => b.finalScore - a.finalScore);
          const placeNames = ["1st Place", "2nd Place", "3rd Place"];
          const uniqueScores = [...new Set(studentScoresForEvent.map(s => s.finalScore))].slice(0, 3);

          uniqueScores.forEach((score, index) => {
            const winners = studentScoresForEvent.filter(s => s.finalScore === score);
            winners.forEach(winner => {
              //csvString += `"${event.eventName.replace(/"/g, '""')}","${placeNames[index]}","${winner.student.fullName.replace(/"/g, '""')}","${winner.student.indexNo}",${winner.finalScore.toFixed(2)}\n`;
              csvString += `${safeCsvText(event.eventName)},` +
                           `${safeCsvText(placeNames[index])},` +
                           `${safeCsvText(winner.student.indexNo)},` + // ID before Student Name
                           `${safeCsvText(winner.student.fullName)},` + // Student Name
                           `${formatScoreForCsv(winner.finalScore)}\n`; // Score
            });
          });
        }
      }

      if (!resultsFoundForGender) {
        hideFeedbackModal();
        displayModal(`No 'Performance 2' marks found for ${genderCategory.toLowerCase()} events.`, 'info', "No Data");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      const filename = `${genderCategory.toLowerCase()}_performance_2_top_3.csv`;
      hideFeedbackModal();

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        displayModal(`${genderCategory} P2 Top 3 CSV downloaded.`, 'success', "Downloaded");
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Download ${genderCategory} P2 Top 3`, UTI: 'public.comma-separated-values-text' });
          displayModal(`${genderCategory} P2 Top 3 CSV shared.`, 'success', "Shared");
        } else {
          displayModal("Sharing is not available on this device.", 'error', "Device Error");
        }
      }
    } catch (error: any) {
      hideFeedbackModal();
      displayModal(`Failed to generate ${genderCategory} P2 CSV: ${error.message}`, 'error', "CSV Error", { autoClose: false });
    } finally {
      if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
    }
  };

  const content = (
    <ScrollView style={styles.container}>
      {!isEmbedded && (
        <Text style={styles.headerTitle}>Performance 2 Event Results</Text>
      )}
        {/* Event Picker */}
          <View style={styles.searchRow}>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedEventId}
                onValueChange={(itemValue) => setSelectedEventId(itemValue)}
                style={styles.picker}
                enabled={!loadingEvents && !loadingResults && allEvents.length > 0}
              >
                <Picker.Item label="Select an Event..." value={null} />
                {allEvents.map(event => (
                  <Picker.Item key={event.id} label={`${event.eventName} (${event.gender})`} value={event.id} />
                ))}
              </Picker>
            </View>
            <IconButton
              icon="magnify"
              size={28}
              onPress={handleSearch} 
              style={styles.searchActionIconBtn} // Consistent with other pages
              iconColor="#1565c0" // Blue icon
              disabled={!selectedEventId || loadingEvents || loadingResults}
            />
            {selectedEventId && (
                <IconButton icon="close-circle-outline" onPress={handleClearSelection} size={28} iconColor="#e53935" style={styles.clearSearchInputIcon} />
            )}
          </View>


        {/* Gender Specific Download Buttons */}
        <View style={styles.downloadButtonsRow}>
          <Button
            icon="download"
            mode="contained"
            onPress={() => handleDownloadGenderSpecificP2ResultsCsv('Male')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loadingEvents || loadingResults}
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
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loadingEvents || loadingResults}
            loading={downloadingFemaleCsv}
            style={[styles.genderDownloadButton, styles.femaleButton]}
            labelStyle={styles.femaleButtonLabel}
          >
            Female P2 Results
          </Button>
        </View>

        {/* "Download All Top 3 (CSV)" button removed as per request */}
        {loadingResults && <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 20 }} />}

        {!loadingResults && rankedResults.length > 0 && (
          <View style={styles.resultsContainer}> 
            {rankedResults.map((placeDetail, index) => (
              <View key={index} style={styles.placeBlock}>
                <Text style={styles.placeTitle}>{placeDetail.placeName} (Score: {formatScoreForCsv(placeDetail.score)})</Text>
                {placeDetail.winners.length > 0 ? (
                  placeDetail.winners.map((winner) => (
                    <View key={winner.id} style={styles.winnerItem}>
                      <Text style={styles.winnerName}>{winner.fullName} ({winner.indexNo})</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noWinnerInfo}>No students achieved this place.</Text>
                )}
              </View>
            ))}
          </View>
        )}
         {!loadingResults && rankedResults.length === 0 && selectedEventId && (
            <Text style={styles.noResultsText}>
                No 'Performance 2' top place results found for the selected event.
                This might be due to insufficient 'Performance 2' marks.
            </Text>
        )}
        {!loadingResults && rankedResults.length === 0 && !selectedEventId && !loadingEvents && ( <Text style={styles.noResultsText}>Please select an event and search.</Text>
        )}
      </ScrollView>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {content}
      <FeedbackModal
        visible={feedbackModalVisible}
        message={feedbackModalMsg}
        type={feedbackModalType as FeedbackModalType} // Cast because hook might have wider type
        title={feedbackModalTitle}
        onClose={hideFeedbackModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5faff' },
  container: { flex: 1, padding: 15 },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1565c0',

    textAlign: 'center',
    marginBottom: 20,
  },
  searchRow: { // Container for the picker wrapper and search button
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16, // Space before download buttons
  },
  // searchCard: { // Matched Performance1ResultsScreen
  //   // backgroundColor: "#fff", // Removed if searchRow is directly in container
  //   // borderRadius: 12,
  //   // padding: 16,
  //   // elevation: 3,
  //   marginBottom: 16,
  // },
  pickerWrapper: { // Copied from Top8Screen
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbb',
    elevation: 2,
    height: 48, // Ensure consistent height
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#333', // Ensure selected item text (including placeholder) is visible
  },
  downloadAllButton: {

    borderColor: '#4CAF50', // Green outline
    borderWidth: 1,
    paddingVertical: 8,
    marginBottom: 15, // Added margin to separate from results
    borderRadius: 8,
  },
  downloadAllButtonText: { // This style is for the "Download All Top 3" button
    color: '#4CAF50', // Green text
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 20,
  },
  placeBlock: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  placeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10569f', // Slightly darker blue
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  winnerItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  winnerName: {
    fontSize: 16,
    color: '#333',
  },
  noWinnerInfo: {
    fontSize: 15,
    color: '#777',
    fontStyle: 'italic',
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 10,
  },
  // Notification Styles
  notificationBase: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    alignItems: 'center',
  },
  notification_success: { backgroundColor: '#d4edda', borderColor: '#c3e6cb' },
  notification_error: { backgroundColor: '#f8d7da', borderColor: '#f5c6cb' },
  notification_info: { backgroundColor: '#d1ecf1', borderColor: '#bee5eb' },
  notificationText: {
    fontSize: 15,
    color: '#333', // Adjust color based on type if needed
  },
  // searchInputWrapper: { // Removed as TextInput is replaced by Picker
  //   flex: 1,
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   borderWidth: 1,
  //   borderColor: '#bbb',
  //   borderRadius: 8,
  //   backgroundColor: '#fff',
  //   height: 48,
  //   borderColor: '#bbb',
  //   borderRadius: 8,
  //   backgroundColor: '#fff',
  //   height: 48,
  //   paddingLeft: 8, // Padding for the text input
  //   marginRight: 8, // Space before the search IconButton
  // },
  // searchInputStyle: { // Removed as TextInput is replaced by Picker
  //   backgroundColor: "#fff",
  //   flex: 1,
  //   height: 44,
  //   height: 46, // Slightly less than wrapper height
  // },
  clearSearchInputIcon: { // Style for the clear IconButton for Picker
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
  // Styles copied from Top8Screen for gender download buttons
  downloadButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    marginBottom: 16,
  },
  genderDownloadButton: {
    flex: 1,
    marginHorizontal: 4,
    height: 48,
    justifyContent: 'center',
  },
  maleButton: {
    backgroundColor: '#00796b', // Teal/Green for male (filled)
  },
  femaleButton: {
    borderColor: '#00796b', // Teal/Green border for female (outlined)
    borderWidth: 2,
  },
  maleButtonLabel: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  femaleButtonLabel: {
    color: '#00796b',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
