import { Picker } from "@react-native-picker/picker";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from "react-native-paper";
import { FeedbackModal, ModalType as FeedbackModalType } from "../../components/FeedbackModal"; // Import FeedbackModal
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal";
import { useAuth } from '../../utils/AuthContext';
import { getFinalScoreForPerformanceEvent } from '../../utils/calculationUtils';
import { formatScoreForCsv, formatScoreForDisplay, safeCsvText } from '../../utils/csvUtils'; // Import safeCsvText and formatScoreForCsv
import {
  EventDocument,
  StudentDocument, // Added StudentDocument import
  fetchEvents,
  fetchStudentMarksForEvent,
  fetchStudents,
} from '../../utils/firebaseRest';

interface TopPerformer {
  studentId: string;
  fullName: string;
  indexNo: string;
  province: string;
  finalScore: number;
  isOverallTop8?: boolean; // True if part of the event's overall top 8 from provincial top 3s
  provincialRank?: number; // Rank within their province for this event (1, 2, or 3)
  // For CSV export of all events
  eventName?: string;
  eventGender?: string;
}

export default function Top8Screen({ isEmbedded }: { isEmbedded?: boolean }) {
  const { auth } = useAuth();
  const idToken = auth?.idToken;

  const [allEvents, setAllEvents] = useState<EventDocument[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [downloadingMaleCsv, setDownloadingMaleCsv] = useState(false); // Specific loading for male CSV
  const [downloadingDetailedCsv, setDownloadingDetailedCsv] = useState(false); // New state for detailed event CSV
  const [downloadingFemaleCsv, setDownloadingFemaleCsv] = useState(false); // Specific loading for female CSV
  
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
    const defaultTitle = type === "success" ? "Success" : type === "error" ? "Error" : "Information";
    const effectiveTitle = title || defaultTitle;
    // Ensure 'info' type is handled correctly if useFeedbackModal expects only 'success' | 'error'
    const typeForHook = type === "info" ? "success" : type; // Or handle 'info' directly if supported
    showFeedbackModalRaw(message, typeForHook, effectiveTitle, { autoClose: type !== 'error', ...options });
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
      } catch (error: any) {
        displayModal("Failed to load events: " + error.message, "error", "Load Error");
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, [idToken, displayModal]);

  const calculateTop8ForSelectedEvent = async (eventId: string) => {
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error");
      setLoadingPerformance(false);
      return;
    }
    setLoadingPerformance(true);
    setTopPerformers([]);

    try {
      const allStudents = await fetchStudents(idToken);
      const studentScoresForEvent: { student: StudentDocument, score: number }[] = [];

      for (const student of allStudents) {
        const marks = await fetchStudentMarksForEvent(student.id, eventId, idToken);
        if (marks) {
          const finalScore = getFinalScoreForPerformanceEvent(marks.rounds.round1, marks.rounds.round2);
          studentScoresForEvent.push({ student, score: finalScore });
        }
      }

      if (studentScoresForEvent.length === 0) {
        displayModal("No student scores found for the selected event.", "info", "No Data");
        setLoadingPerformance(false);
        return;
      }

      // Group by province
      const scoresByProvince: Record<string, { student: StudentDocument, score: number }[]> = {};
      studentScoresForEvent.forEach(ss => {
        const province = ss.student.province || "N/A";
        if (!scoresByProvince[province]) scoresByProvince[province] = [];
        scoresByProvince[province].push(ss);
      });

      const combinedProvincialTop3: TopPerformer[] = [];
      for (const province in scoresByProvince) {
        scoresByProvince[province].sort((a, b) => b.score - a.score); // Sort by score within province
        const top3InProvince = scoresByProvince[province].slice(0, 3);
        top3InProvince.forEach((item, index) => {
          combinedProvincialTop3.push({
            studentId: item.student.id,
            fullName: item.student.fullName,
            indexNo: item.student.indexNo,
            province: item.student.province || "N/A",
            finalScore: item.score,
            provincialRank: index + 1,
          });
        });
      }

      // Sort the combined list by final score to determine overall top 8
      combinedProvincialTop3.sort((a, b) => b.finalScore - a.finalScore);

      const finalPerformers = combinedProvincialTop3.map((performer, index) => ({
        ...performer,
        isOverallTop8: index < 8, // Mark the top 8 from this combined list
      }));

      setTopPerformers(finalPerformers);

      if (finalPerformers.length === 0) {
        displayModal("No top performers found after processing provincial top 3s.", "info", "No Data");
      }

    } catch (error: any) {
      displayModal("Error calculating top performers: " + error.message, "error", "Calculation Error");
    } finally {
      setLoadingPerformance(false);
    }
  }
  const handleSearch = () => {
    if (selectedEventId) {
      calculateTop8ForSelectedEvent(selectedEventId);
    } else {
      displayModal("Please select an event first.", "info", "Selection Required");
    }
  }

  useEffect(() => {
    if (!selectedEventId) {
        setTopPerformers([]);
    }
  }, [selectedEventId]);
  
  const handleClearSelection = () => {
    setSelectedEventId(null);
  }

  const handleDownloadGenderSpecificTopPerformersCsv = async (genderCategory: 'Male' | 'Female') => {
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error", { autoClose: false });
      return;
    }
    if (genderCategory === 'Male') {
      setDownloadingMaleCsv(true);
    } else {
      setDownloadingFemaleCsv(true);
    }
    displayModal(`Preparing ${genderCategory} Top 8 report...`, "info", "Report Generation", { autoClose: true, autoCloseDelay: 4000 });

    try {
      const allStudentsList = await fetchStudents(idToken);
      const allEventsList = await fetchEvents(idToken);

      const genderSpecificEvents = allEventsList.filter(e => e.gender.toLowerCase() === genderCategory.toLowerCase());
      if (genderSpecificEvents.length === 0) {
        hideFeedbackModal();
        displayModal(`No ${genderCategory.toLowerCase()} events found to generate a report.`, "info", "No Events");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      let csvString = `Title:,Top 8 Performers Report\n`;
      csvString += `Gender:,${safeCsvText(genderCategory)}\n\n`;
      csvString += "Event Name,ID,Student Name,Province,Final Score\n";
      let resultsFoundForGender = false; // Flag to track if any data was actually added to CSV

      for (const event of genderSpecificEvents) {
        const studentScoresForEvent: { student: StudentDocument, score: number }[] = [];
        for (const student of allStudentsList) {
          const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
          if (marks) {
            const finalScore = getFinalScoreForPerformanceEvent(marks.rounds.round1, marks.rounds.round2);
            studentScoresForEvent.push({ student, score: finalScore });
          }
        }

        if (studentScoresForEvent.length > 0) {
          const scoresByProvince: Record<string, { student: StudentDocument, score: number }[]> = {};
          studentScoresForEvent.forEach(ss => {
            const province = ss.student.province || "N/A";
            if (!scoresByProvince[province]) scoresByProvince[province] = [];
            scoresByProvince[province].push(ss);
          });

          const provincialTop3ForEvent: TopPerformer[] = [];
          for (const province in scoresByProvince) {
            scoresByProvince[province].sort((a, b) => b.score - a.score);
            const top3InProvince = scoresByProvince[province].slice(0, 3);
            top3InProvince.forEach((item, index) => {
              provincialTop3ForEvent.push({
                studentId: item.student.id,
                fullName: item.student.fullName,
                indexNo: item.student.indexNo,
                province: item.student.province || "N/A",
                finalScore: item.score,
                provincialRank: index + 1,
              });
            });
          }

          if (provincialTop3ForEvent.length > 0) {
            resultsFoundForGender = true;
            provincialTop3ForEvent.sort((a, b) => b.finalScore - a.finalScore); // Sort to identify overall top 8 for this event
            
            const top8ForThisEvent = provincialTop3ForEvent.slice(0, 8); // Get only the top 8 performers

            top8ForThisEvent.forEach(performer => {
              csvString += `${safeCsvText(event.eventName)},${safeCsvText(performer.indexNo)},${safeCsvText(performer.fullName)},${safeCsvText(performer.province)},${formatScoreForCsv(performer.finalScore)}\n`;
            });
          }
        }
      }

    if (!resultsFoundForGender) {
      hideFeedbackModal();
      displayModal(`No top performers data found for ${genderCategory.toLowerCase()} events across any province.`, "info", "No Data");
      if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
      return;
    }

    const filename = `${genderCategory.toLowerCase()}_top_performers_report.csv`;
    hideFeedbackModal(); // Hide "Preparing..." modal BEFORE showing final status

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
      displayModal(`${genderCategory} Top 8 report downloaded.`, "success", "Report Downloaded");
    } else {
      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Download ${genderCategory} Top Performers`, UTI: 'public.comma-separated-values-text' });
        displayModal(`${genderCategory} Top 8 report shared successfully.`, "success", "Report Shared");
      } else {
        displayModal(`CSV file for ${genderCategory} created, but sharing is not available.`, "info", "Device Error");
      }
    }
    } catch (error) {
      hideFeedbackModal();
      let message = "An unknown error occurred during CSV generation.";
      if (error instanceof Error) {
        message = error.message;
      }
      displayModal(`Failed to generate CSV: ${message}`, "error", "CSV Error");
    } finally {
      if (genderCategory === 'Male') {
        setDownloadingMaleCsv(false);
      } else {
        setDownloadingFemaleCsv(false);
      }
    }
  }

  const handleDownloadDetailedEventResultsCsv = async () => {
    if (!selectedEventId || topPerformers.length === 0) {
      displayModal("No detailed performance data to download for the selected event.", "info", "No Data");
      return;
    }
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error", { autoClose: false });
      return;
    }

    setDownloadingDetailedCsv(true);
    displayModal("Preparing detailed event results CSV...", "info", "Report Generation", { autoClose: true, autoCloseDelay: 4000 });

    try {
      const selectedEvent = allEvents.find(e => e.id === selectedEventId);
      const eventName = selectedEvent ? selectedEvent.eventName : "Unknown Event";
      const eventGender = selectedEvent ? selectedEvent.gender : "N/A";

      let csvString = `Title:,Detailed Event Results\n`;
      csvString += `Gender:,${safeCsvText(eventGender)}\n`;
      csvString += `Event Name:,${safeCsvText(eventName)}\n\n`; // Empty row for readability

      // Columns: rank, id, student name, province, total marks
      csvString += "Rank,ID,Student Name,Province,Total Marks\n";

      // The topPerformers array is already sorted by finalScore (highest to lowest)
      // and contains the combined provincial top 3s.
      topPerformers.forEach((performer, index) => {
        csvString += `${index + 1},${safeCsvText(performer.indexNo)},${safeCsvText(performer.fullName)},${safeCsvText(performer.province)},${formatScoreForCsv(performer.finalScore)}\n`;
      });

      const filename = `${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_detailed_results.csv`;
      hideFeedbackModal(); // Hide "Preparing..." modal BEFORE showing final status

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
        displayModal(`Detailed results for ${eventName} downloaded.`, "success", "Report Downloaded");
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Download ${eventName} Details`, UTI: 'public.comma-separated-values-text' });
          displayModal(`Detailed results for ${eventName} shared successfully.`, "success", "Report Shared");
        } else {
          displayModal(`CSV file for ${eventName} created, but sharing is not available.`, "info", "Device Error");
        }
      }
    } catch (error) {
      hideFeedbackModal();
      let message = "An unknown error occurred during detailed CSV generation.";
      if (error instanceof Error) {
        message = error.message;
      }
      displayModal(`Failed to generate detailed CSV: ${message}`, "error", "CSV Error");
    } finally {
      setDownloadingDetailedCsv(false);
    }
  }


  if (loadingEvents) {
    return (
      <View style={styles.centeredLoaderContainer}>
        <ActivityIndicator size="large" color="#1565c0" />
        <Text style={styles.loadingText}>Loading Events...</Text>
      </View>
    );
  }

  const content = (
    <View style={styles.container}>
      {!isEmbedded && (
        <Text style={styles.headerTitle}>Top 8 Performers</Text>
      )}
        
        <View style={styles.filterRow}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedEventId}
              onValueChange={(itemValue) => setSelectedEventId(itemValue)}
              style={styles.picker}
              enabled={!loadingPerformance && !loadingEvents}
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
            style={styles.searchIconBtn} // Style will be updated
            iconColor="#1565c0" // Icon color to contrast with grey background
            disabled={!selectedEventId || loadingPerformance || loadingEvents}
          />
          {selectedEventId && ( // Conditionally render clear button
            <IconButton
              icon="close-circle-outline"
              size={28}
              onPress={handleClearSelection}
              style={styles.clearIconBtn}
              iconColor="#e53935" 
              disabled={loadingPerformance || loadingEvents} // Consistent disabled state
            />
          )}
        </View>

        {/* Download Buttons for Male and Female */}
        <View style={styles.downloadButtonsRow}>
          <Button
            icon="download" // Changed icon
            mode="contained" // Changed to contained (filled) - Matches TeamPerformance
            onPress={() => handleDownloadGenderSpecificTopPerformersCsv('Male')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loadingEvents || loadingPerformance} // Disable if either gender CSV is downloading or performance calculation is running
            loading={downloadingMaleCsv} // Use male-specific loading state
            style={[styles.genderDownloadButton, styles.maleButton]}
            labelStyle={styles.maleButtonLabel} // Corrected: Direct assignment
          >
            Male Top 8
          </Button>
          <Button
            icon="download" // Changed icon
            mode="outlined"
            onPress={() => handleDownloadGenderSpecificTopPerformersCsv('Female')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loadingEvents || loadingPerformance} // Disable if either gender CSV is downloading or performance calculation is running
            loading={downloadingFemaleCsv} // Use female-specific loading state
            style={[styles.genderDownloadButton, styles.femaleButton]}
            labelStyle={styles.femaleButtonLabel} // Corrected: Direct assignment
          >
            Female Top 8
          </Button>
        </View>

        {loadingPerformance ? (
          <View style={styles.centeredLoaderContainer}>
            <ActivityIndicator size="large" color="#1565c0" />
            <Text style={styles.loadingText}>Calculating Top 8...</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={topPerformers}
              keyExtractor={(item, index) => `${item.studentId}-${index}`} // Ensure unique key if student can appear multiple times with different provincial ranks
              renderItem={({ item, index }) => (
                <View style={[styles.performerItem, item.isOverallTop8 && styles.overallTop8Item]}>
                  <Text style={[styles.rankText, item.isOverallTop8 && styles.overallTop8Text]}>
                    {index + 1}. {item.isOverallTop8 ? "(Top 8)" : ""}
                  </Text>
                  <View style={styles.performerDetails}>
                      <Text style={[styles.performerName, item.isOverallTop8 && styles.overallTop8Text]}>{item.fullName} ({item.indexNo})</Text>
                      <Text style={[styles.performerProvince, item.isOverallTop8 && styles.overallTop8Text]}>
                          Province: {item.province} (Rank: {item.provincialRank})
                      </Text>
                  </View>
                  <Text style={[styles.performerScore, item.isOverallTop8 && styles.overallTop8ScoreText]}>
                      {formatScoreForDisplay(item.finalScore)}</Text>
                </View>
              )}
              ListEmptyComponent={
                selectedEventId ? (
                  <Text style={styles.emptyText}>No top performers found for the selected event.</Text>
                ) : (
                  <Text style={styles.emptyText}>Please select an event and search to view top performers.</Text>
                )
              }
              contentContainerStyle={styles.listContentContainer}
            />
            {/* Download Button for Detailed Event Results - Moved to bottom */}
            {selectedEventId && topPerformers.length > 0 && (
              <Button
                icon="download"
                mode="outlined"
                onPress={handleDownloadDetailedEventResultsCsv}
                disabled={downloadingDetailedCsv || loadingPerformance}
                loading={downloadingDetailedCsv}
                style={styles.downloadDetailedEventButton}
                labelStyle={styles.downloadDetailedEventButtonLabel}
              >
                {downloadingDetailedCsv ? "Preparing..." : "Download Event Details"}
              </Button>
            )}
          </>
        )}
    </View>
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
        type={feedbackModalType as FeedbackModalType}
        title={feedbackModalTitle}
        onClose={hideFeedbackModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f7', 
  },
  container: {
    flex: 1,
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10, // Reduced margin as download button is below
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1565c0', 
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerWrapper: { 
    flex: 1, 
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbb',
    // marginBottom: 16, // Removed as filterRow has marginBottom
    elevation: 2,
    height: 48,
    justifyContent: 'center',
  },
  picker: {
    height: 48, // Ensure picker takes full height of wrapper
    width: '100%',
  },
  searchIconBtn: {
    backgroundColor: '#e0e0e0', // Common grey background like TeamPerformanceScreen
    borderRadius: 8,
    height: 48,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    // marginBottom: 16, // Removed
    marginLeft: 8, 
    marginRight: 4,
  },
  clearIconBtn: { 
    borderRadius: 8,
    height: 48, 
    width: 48,  
    justifyContent: 'center',
    alignItems: 'center',
    // marginBottom: 16, // Removed
    marginRight: 0,
  },
  downloadAllButton: {
    // This style is removed as the button is replaced
  },
  // Styles copied from TeamPerformanceScreen for gender download buttons
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
  downloadAllButtonText: {
    // This style is removed as the button is replaced
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
  downloadDetailedEventButton: {
    marginTop: 16, // Space from list
    borderColor: '#6a1b9a', // Purple border
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
  },
  downloadDetailedEventButtonLabel: {
    color: '#6a1b9a', // Purple label
    fontWeight: 'bold',
  },
  performerItem: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallTop8Item: {
    backgroundColor: '#e8f5e9', // Light green for overall top 8
    borderColor: '#a5d6a7',
    borderWidth: 1,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
    marginRight: 10,
  },
  performerDetails: {
    flex: 1,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  performerProvince: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  performerScore: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2e7d32', // Green for score
  },
  overallTop8Text: {
    // color: '#1b5e20', // Darker green for text if needed
  },
  overallTop8ScoreText: {
    color: '#1b5e20', // Darker green for score
  },
  centeredLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
    color: '#777',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 10,
    width: '85%',
    maxWidth: 320,
    alignItems: 'center',
    elevation: 5,
  },
  successModalText: { color: "green", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  infoModalText: { color: "#1565c0", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  errorModalText: { color: "red", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  
});
