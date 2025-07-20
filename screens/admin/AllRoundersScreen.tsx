import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { FeedbackModal, ModalType as FeedbackModalType } from "../../components/FeedbackModal"; // Import FeedbackModal
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal";
import { useAuth } from '../../utils/AuthContext';
import { getFinalScoreForPerformanceEvent } from '../../utils/calculationUtils';
import { formatScoreForCsv, formatScoreForDisplay, safeCsvText } from '../../utils/csvUtils';
import {
  StudentDocument,
  fetchEvents,
  fetchStudentMarksForEvent,
  fetchStudents
} from '../../utils/firebaseRest';

interface AllRounder {
  studentId: string;
  fullName: string;
  indexNo: string;
  province: string;
  totalScore: number;
  rankInProvince: number;
}

interface StudentTotalScore {
  studentInfo: StudentDocument;
  totalScore: number;
}

export default function AllRoundersScreen({ isEmbedded }: { isEmbedded?: boolean }) {
  const { auth } = useAuth();
  const idToken = auth?.idToken;

  const [allRounders, setAllRounders] = useState<AllRounder[]>([]);
  const [loading, setLoading] = useState(false); // Set to false initially
  const [selectedGender, setSelectedGender] = useState<string | null>(null);

  // Specific download states
  const [downloadingMaleCsv, setDownloadingMaleCsv] = useState(false);
  const [downloadingFemaleCsv, setDownloadingFemaleCsv] = useState(false);
  
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

  const handleCalculateAllRounders = useCallback(async () => {
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error");
      setLoading(false);
      return;
    }
    if (!selectedGender) {
      displayModal("Please select a gender to calculate all-rounders.", "info", "Selection Required");
      setLoading(false);
      return;
    }
    setLoading(true);
    setAllRounders([]);

    try {
      const allStudents = await fetchStudents(idToken);
      const allEvents = await fetchEvents(idToken);

      const genderFilteredStudents = allStudents.filter(s => s.gender.toLowerCase() === selectedGender.toLowerCase());

      if (genderFilteredStudents.length === 0) {
        displayModal(`No ${selectedGender.toLowerCase()} students found.`, "info", "No Data");
        setLoading(false);
        return;
      }
      if (allEvents.length === 0) { // This check remains for events in general
        displayModal("No events found in the system. Cannot calculate all-rounders.", "info", "No Data");
        setLoading(false);
        return;
      }

      const studentTotalScores: StudentTotalScore[] = [];

      for (const student of genderFilteredStudents) { // Iterate over gender-filtered students
        let currentStudentTotalScore = 0;
        for (const event of allEvents) {
          const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
          if (marks) {
            // Only consider the first round for all-rounder calculations, even if both rounds exist
            const round1Score = getFinalScoreForPerformanceEvent(marks.rounds.round1, undefined);
            currentStudentTotalScore += round1Score;
          }
        }
        if (currentStudentTotalScore > 0) { // Only consider students with some score
            studentTotalScores.push({ studentInfo: student, totalScore: currentStudentTotalScore });
        }
      }

      // Group by province
      const scoresByProvince: Record<string, StudentTotalScore[]> = {};
      studentTotalScores.forEach(sts => {
        const province = sts.studentInfo.province || "N/A";
        if (!scoresByProvince[province]) {
          scoresByProvince[province] = [];
        }
        scoresByProvince[province].push(sts);
      });

      const finalAllRounders: AllRounder[] = [];
      for (const province in scoresByProvince) {
        scoresByProvince[province].sort((a, b) => b.totalScore - a.totalScore); // Sort descending
        const top3ForProvince = scoresByProvince[province].slice(0, 3);
        
        top3ForProvince.forEach((sts, index) => {
          finalAllRounders.push({
            studentId: sts.studentInfo.id,
            fullName: sts.studentInfo.fullName,
            indexNo: sts.studentInfo.indexNo,
            province: province,
            totalScore: sts.totalScore,
            rankInProvince: index + 1,
          });
        });
      }
      
      // Sort the final list by province, then by rank
      finalAllRounders.sort((a,b) => {
        if (a.province < b.province) return -1;
        if (a.province > b.province) return 1;
        return a.rankInProvince - b.rankInProvince;
      });

      setAllRounders(finalAllRounders);

      if (finalAllRounders.length === 0) {
        displayModal(`No ${selectedGender.toLowerCase()} all-rounders found.`, "info", "No Results");
      }

    } catch (error: any) {
      displayModal("Error calculating all-rounders: " + error.message, "error", "Calculation Error");
    } finally {
      setLoading(false);
    }
  }, [idToken, displayModal, selectedGender]);

  useEffect(() => {
    // Clear results if gender selection is cleared
    if (!selectedGender) {
      setAllRounders([]);
    }
  }, [selectedGender]);

  const handleClearGenderSelection = () => {
    setSelectedGender(null);
    // AllRounders will be cleared by the useEffect hook listening to selectedGender
  }


  const handleDownloadGenderSpecificAllRoundersCsv = async (genderCategory: 'Male' | 'Female') => {
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error");
      return;
    }

    if (genderCategory === 'Male') {
      setDownloadingMaleCsv(true);
    } else {
      setDownloadingFemaleCsv(true);
    }
    displayModal(`Preparing ${genderCategory} all-rounders report...`, "info", "Report Generation", { autoClose: true, autoCloseDelay: 4000 });

    try {
      const allStudents = await fetchStudents(idToken);
      const allEvents = await fetchEvents(idToken);

      const genderFilteredStudents = allStudents.filter(s => s.gender.toLowerCase() === genderCategory.toLowerCase());

      if (genderFilteredStudents.length === 0) {
        hideFeedbackModal();
        displayModal(`No ${genderCategory.toLowerCase()} students found to generate a report.`, "info", "No Data");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }
      if (allEvents.length === 0) {
        hideFeedbackModal();
        displayModal("No events found. Cannot generate report.", "info", "No Events");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      // Pre-calculate all student-event scores for easy lookup
      const studentEventScoresMap = new Map<string, Map<string, number>>(); // studentId -> eventId -> score
      const studentTotalScores: { student: StudentDocument; totalScore: number }[] = [];
      for (const student of genderFilteredStudents) {
        let currentStudentTotalScore = 0;
        const studentScoresForEvents = new Map<string, number>();
        for (const event of allEvents) {
          const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
          if (marks) {
            const round1Score = getFinalScoreForPerformanceEvent(marks.rounds.round1, undefined);
            currentStudentTotalScore += round1Score;
            studentScoresForEvents.set(event.id, round1Score);
          } else {
            studentScoresForEvents.set(event.id, 0);
          }
        }
        studentEventScoresMap.set(student.id, studentScoresForEvents);
        studentTotalScores.push({ student, totalScore: currentStudentTotalScore });
      }

      // Sort all students by totalScore descending, then by province, then by name
      studentTotalScores.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (a.student.province < b.student.province) return -1;
        if (a.student.province > b.student.province) return 1;
        return a.student.fullName.localeCompare(b.student.fullName);
      });

      // Build CSV Header
      let csvString = `Title:,All-Rounder Champions\n`;
      csvString += `Gender:,${genderCategory}\n\n`;

      let headerColumns = ["Rank", "ID", "Student Name", "Province", "Total Marks"];
      allEvents.forEach(event => {
        headerColumns.push(event.eventName);
      });
      csvString += headerColumns.map(h => safeCsvText(h)).join(',') + '\n';

      // Build CSV Data Rows
      studentTotalScores.forEach((entry, idx) => {
        const { student, totalScore } = entry;
        let rowData = [
          `${idx + 1}`,
          safeCsvText(student.indexNo),
          safeCsvText(student.fullName),
          safeCsvText(student.province),
          formatScoreForCsv(totalScore)
        ];
        allEvents.forEach(event => {
          const score = studentEventScoresMap.get(student.id)?.get(event.id) ?? 0;
          rowData.push(formatScoreForCsv(score));
        });
        csvString += rowData.join(',') + '\n';
      });

      const filename = `${genderCategory.toLowerCase()}_all_students_all_rounders_report.csv`;
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
        displayModal(`${genderCategory} all-rounders report downloaded.`, "success", "Report Downloaded");
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Download ${genderCategory} All-Rounders`, UTI: 'public.comma-separated-values-text' });
          displayModal(`${genderCategory} all-rounders report shared.`, "success", "Report Shared");
        } else {
          displayModal(`CSV for ${genderCategory} created, but sharing is unavailable.`, "info", "Device Error");
        }
      }
    } catch (error) {
      hideFeedbackModal();
      let message = "An unknown error occurred during CSV generation.";
      if (error instanceof Error) {
        message = error.message;
      }
      displayModal("Failed to generate CSV: " + message, "error", "CSV Error");
    } finally {
      if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centeredLoaderContainer}>
        <ActivityIndicator size="large" color="#1565c0" />
        <Text style={styles.loadingText}>Calculating All-Rounders...</Text>
      </View>
    );
  }

  const content = (
    <View style={styles.container}>
      {!isEmbedded && (
        <Text style={styles.headerTitle}>All-Rounder Champions</Text>
      )}

        <View style={styles.filterRow}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedGender}
              onValueChange={(itemValue) => setSelectedGender(itemValue)}
              style={styles.picker}
              enabled={!loading && !downloadingMaleCsv && !downloadingFemaleCsv}
            >
              <Picker.Item label="Select Gender..." value={null} />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              {/* <Picker.Item label="Other" value="Other" /> */}
            </Picker>
          </View>
          <IconButton
            icon="magnify"
            size={28}
            onPress={handleCalculateAllRounders}
            style={styles.searchIconBtn}
            iconColor="#1565c0"
            disabled={!selectedGender || loading || downloadingMaleCsv || downloadingFemaleCsv}
          />
          {selectedGender && ( // Conditionally render clear button
            <IconButton
              icon="close-circle-outline"
              size={28}
              onPress={handleClearGenderSelection}
              style={styles.clearIconBtn} // Add this style
              iconColor="#e53935" 
              disabled={loading || downloadingMaleCsv || downloadingFemaleCsv} 
            />
          )}
        </View>
        
        {/* Gender Specific Download Buttons */}
        <View style={styles.downloadButtonsRow}>
          <Button
            icon="download"
            mode="contained"
            onPress={() => handleDownloadGenderSpecificAllRoundersCsv('Male')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loading}
            loading={downloadingMaleCsv}
            style={[styles.genderDownloadButton, styles.maleButton]}
            labelStyle={styles.maleButtonLabel}
          >
            Male All-Rounders
          </Button>
          <Button
            icon="download"
            mode="outlined"
            onPress={() => handleDownloadGenderSpecificAllRoundersCsv('Female')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loading}
            loading={downloadingFemaleCsv}
            style={[styles.genderDownloadButton, styles.femaleButton]}
            labelStyle={styles.femaleButtonLabel}
          >
            Female All-Rounders
          </Button>
        </View>

        {/* Only show each all-rounder once per province (by studentId) */}
        <FlatList
            data={allRounders.filter((ar, idx, arr) =>
              arr.findIndex(a => a.studentId === ar.studentId && a.province === ar.province) === idx
            )}
            keyExtractor={(item) => `${item.province}-${item.studentId}`}
            renderItem={({ item }) => (
              <View style={styles.allRounderItem}>
                <View style={styles.rankContainer}>
                    <Text style={styles.provinceName}>{item.province}</Text>
                    <Text style={styles.rankText}>Rank: {item.rankInProvince}</Text>
                </View>
                <View style={styles.allRounderDetails}>
                    <Text style={styles.allRounderName}>{item.fullName} ({item.indexNo})</Text>
                </View>
                <Text style={styles.allRounderScore}>{formatScoreForDisplay(item.totalScore)}</Text>
              </View>
            )}
            ListEmptyComponent={
              !loading && selectedGender ? (
                <Text style={styles.emptyText}>No all-rounders found for {selectedGender.toLowerCase()}.</Text>
              ) : !loading && !selectedGender ? (
                <Text style={styles.emptyText}>Please select a gender and search.</Text>
              ) : null
            }
            contentContainerStyle={styles.listContentContainer}
        />
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
        type={feedbackModalType as FeedbackModalType} // Cast because hook might have wider type
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
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1565c0', 
    textAlign: 'center',
    marginBottom: 16,
  },
  filterRow: { // Copied from Top8Screen
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickerWrapper: { // Copied from Top8Screen
    flex: 1, 
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbb',
    elevation: 2,
    height: 48,
    justifyContent: 'center',
  },
  picker: { // Copied from Top8Screen
    height: 48,
    width: '100%',
    color: '#333',
  },
  searchIconBtn: { // Copied from Top8Screen
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    height: 48,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8, 
  },
  clearIconBtn: { // Copied from Top8Screen, adjust if needed
    borderRadius: 8,
    height: 48, 
    width: 48,  
    justifyContent: 'center',
    alignItems: 'center',
    // marginLeft: 4, // If spacing is needed between search and clear
    marginRight: 0,
  },
  downloadButtonsRow: { // Copied from Top8Screen
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    marginBottom: 16, 
  },
  genderDownloadButton: { // Copied from Top8Screen
    flex: 1,
    marginHorizontal: 4,
    height: 48,
    justifyContent: 'center',
  },
  maleButton: { // Copied from Top8Screen
    backgroundColor: '#00796b', 
  },
  femaleButton: { // Copied from Top8Screen
    color: '#00796b',
    borderColor: '#00796b', 
    borderWidth: 2, 
  },
  allRounderItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  maleButtonLabel: { // Copied from Top8Screen
    color: '#ffffff', 
    fontWeight: 'bold',
    fontSize: 13,
  },
  femaleButtonLabel: { // Copied from Top8Screen
    color: '#00796b', 
    fontWeight: 'bold',
    fontSize: 13,
  },
  rankContainer: {
    marginRight: 15,
    alignItems: 'center',
  },
  provinceName: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
  },
  allRounderDetails: {
    flex: 1,
  },
  allRounderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  allRounderScore: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2e7d32', 
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
});
