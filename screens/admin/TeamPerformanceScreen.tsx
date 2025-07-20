import { Picker } from "@react-native-picker/picker";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from "react-native-paper";
import { FeedbackModal } from "../../components/FeedbackModal";
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal";
import { useAuth } from '../../utils/AuthContext'; // Import useAuth
import { getFinalScoreForPerformanceEvent } from '../../utils/calculationUtils';
import { formatScoreForCsv, formatScoreForDisplay, safeCsvText } from '../../utils/csvUtils'; // Import formatScoreForCsv and safeCsvText
import {
  EventDocument,
  fetchEvents,
  fetchStudentMarksForEvent,
  fetchStudents,
  MarksEntryData
} from '../../utils/firebaseRest';

interface ProvinceTeamPerformance { // Interface for team performance data
  province: string;
  teamAScore: number;
  teamBScore: number;
  winningTeam: 'Team A' | 'Team B' | 'Tie' | 'N/A' | 'Team A Wins (B no score)' | 'Team B Wins (A no score)';
  eventDetails?: EventDocument; // For CSV export
}
 
// Helper function to calculate marks for a single round (copied from Performance1ResultsScreen.tsx)
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

// Helper function to check if all marks in a round are empty (copied from Performance1ResultsScreen.tsx)
const isRoundDataEmpty = (marks: MarksEntryData | undefined): boolean => {
  if (!marks) return true;
  return Object.values(marks).every(value => value === "" || value === undefined);
};

export default function TeamPerformanceScreen({ isEmbedded }: { isEmbedded?: boolean }) {
  const { auth } = useAuth();
  const idToken = auth?.idToken;

  const [allEvents, setAllEvents] = useState<EventDocument[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [teamPerformances, setTeamPerformances] = useState<ProvinceTeamPerformance[]>([]);

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [downloadingMaleCsv, setDownloadingMaleCsv] = useState(false); // Specific loading for male CSV
  const [downloadingFemaleCsv, setDownloadingFemaleCsv] = useState(false); // Specific loading for female CSV
  const [downloadingProvinceCsv, setDownloadingProvinceCsv] = useState<Record<string, boolean>>({}); // New state for per-province download
  
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
    type: "success" | "error" | "info",
    title?: string,
    options?: ShowModalOptions
  ) => {
    const defaultTitle = type === "success" ? "Success" : type === "error" ? "Error" : "Information";
    const effectiveTitle = title || defaultTitle;
    const autoClose = options?.autoClose !== undefined ? options.autoClose : (type === "success" || type === "info");
    
    // If useFeedbackModal's showModal (aliased as showFeedbackModalRaw) expects type "success" | "error",
    // map "info" to "success" for the hook call. The title and autoClose logic will still respect "info".
    const typeForHook = type === "info" ? "success" : type;
    showFeedbackModalRaw(message, typeForHook, effectiveTitle, { ...options, autoClose });
  }, [showFeedbackModalRaw]);

  // Fetch all events for the dropdown
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
        displayModal("Failed to load events: " + error.message, "error", "Load Error", { autoClose: false });
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, [idToken, displayModal]);

  const calculateTeamScoresAndDetermineWinner = async (eventId: string) => {
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error", { autoClose: false });
      setLoadingPerformance(false);
      return;
    }
    setLoadingPerformance(true);
    setTeamPerformances([]);

    try {
      const allStudents = await fetchStudents(idToken);
      const studentsWithProvinceAndTeam = allStudents.filter(s => s.province && s.team);

      if (studentsWithProvinceAndTeam.length === 0 && allStudents.length > 0) {
          console.warn("TeamPerformanceScreen: No students found with both province and team assigned. Check student data and team assignments.");
      }

      const provinceScores: Record<string, { teamA_Scores: number[], teamB_Scores: number[] }> = {};

      for (const student of studentsWithProvinceAndTeam) {
        if (!student.province || !student.team) continue;

        const marks = await fetchStudentMarksForEvent(student.id, eventId, idToken);
        if (marks) {
          // Only consider the first round for team performance, even if both rounds exist
          const round1Score = getFinalScoreForPerformanceEvent(marks.rounds.round1, undefined);

          if (!provinceScores[student.province]) {
            provinceScores[student.province] = { teamA_Scores: [], teamB_Scores: [] };
          }
          if (student.team === 'A') {
            provinceScores[student.province].teamA_Scores.push(round1Score);
          } else if (student.team === 'B') {
            provinceScores[student.province].teamB_Scores.push(round1Score);
          }
        }
      }

      const performances: ProvinceTeamPerformance[] = [];
      const selectedEventDetails = allEvents.find(event => event.id === eventId);

      for (const province in provinceScores) {
        const { teamA_Scores, teamB_Scores } = provinceScores[province];

        teamA_Scores.sort((a, b) => b - a); // Sort descending
        teamB_Scores.sort((a, b) => b - a);

        const top5TeamA = teamA_Scores.slice(0, 5);
        const top5TeamB = teamB_Scores.slice(0, 5);

        const teamASum = top5TeamA.reduce((sum, score) => sum + score, 0);
        const teamBSum = top5TeamB.reduce((sum, score) => sum + score, 0);

        let winningTeam: ProvinceTeamPerformance['winningTeam'] = 'N/A';
        if (top5TeamA.length > 0 && top5TeamB.length > 0) {
          if (teamASum > teamBSum) winningTeam = 'Team A';
          else if (teamBSum > teamASum) winningTeam = 'Team B';
          else winningTeam = 'Tie';
        } else if (top5TeamA.length > 0) {
          winningTeam = 'Team A Wins (B no score)';
        } else if (top5TeamB.length > 0) {
          winningTeam = 'Team B Wins (A no score)';
        }
        
        if (top5TeamA.length > 0 || top5TeamB.length > 0) { 
             performances.push({
                province,
                teamAScore: teamASum,
                teamBScore: teamBSum,
                winningTeam,
                eventDetails: selectedEventDetails,
             });
        }
      }
      setTeamPerformances(performances);
      if (performances.length === 0) {
        displayModal("No team scores found for the selected event in any province.", "info", "No Data");
      }

    } catch (error: any) {
      displayModal("Error calculating team performance: " + error.message, "error", "Calculation Error", { autoClose: false });
    } finally {
      setLoadingPerformance(false);
    }
  }; // Removed dependency array as it's not a useCallback here

  // Function to handle search button click
  const handleSearch = () => {
    if (selectedEventId) {
      calculateTeamScoresAndDetermineWinner(selectedEventId);
    } else {
      displayModal("Please select an event first.", "info", "Selection Required");
    }
  };

  useEffect(() => {
    // Calculation is now only via search button or if selectedEventId is cleared.
    if (!selectedEventId) {
        setTeamPerformances([]); // Clear performances if no event is selected
    }
  }, [selectedEventId]); 

  // Function to clear the selected event and results
  const handleClearSelection = () => {
    setSelectedEventId(null);
    // teamPerformances will be cleared by the useEffect hook when selectedEventId becomes null
  };

  // New handler for downloading CSV for a specific gender
  const handleDownloadGenderPerformancesCsv = async (genderCategory: 'Male' | 'Female') => {
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error", { autoClose: false });
      return;
    }
    if (genderCategory === 'Male') {
      setDownloadingMaleCsv(true);
    } else {
      setDownloadingFemaleCsv(true);
    }
    displayModal(`Preparing ${genderCategory} performance report...`, "info", "Report Generation", { autoClose: true, autoCloseDelay: 4000 });

    try {
      const allStudentsList = await fetchStudents(idToken);
      const allEventsList = await fetchEvents(idToken);

      const studentsWithProvinceAndTeam = allStudentsList.filter(s => s.province && s.team);
      if (studentsWithProvinceAndTeam.length === 0 && allStudentsList.length > 0) {
        displayModal("No students found with province and team assigned. Cannot generate report.", "info", "Data Missing");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      const genderSpecificEvents = allEventsList.filter(e => e.gender.toLowerCase() === genderCategory.toLowerCase());
      if (genderSpecificEvents.length === 0) {
        hideFeedbackModal(); // Hide "Preparing..."
        displayModal(`No ${genderCategory} events found to generate a report.`, "info", "No Events");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      // Sort events by name for consistent column order in CSV
      genderSpecificEvents.sort((a, b) => a.eventName.localeCompare(b.eventName));

      // Collect all unique provinces that have students (from allStudentsList, which is already fetched)
      const allProvincesWithStudents = new Set<string>();
      allStudentsList.forEach(s => {
        if (s.province) {
          allProvincesWithStudents.add(s.province);
        }
      });
      const sortedProvinces = Array.from(allProvincesWithStudents).sort();

      // Prepare data structure: Map<Province, Map<EventId, { teamASum: number, teamBSum: number, winningTeam: string }>>
      const provinceEventPerformanceMap = new Map<string, Map<string, { teamASum: number, teamBSum: number, winningTeam: string }>>();
      
      // Populate the map
      for (const event of genderSpecificEvents) {
        const studentsInEvent = allStudentsList.filter(s => s.province && s.team);
        
        const provinceScoresForEvent: Record<string, { teamA_Scores: number[], teamB_Scores: number[] }> = {};

        for (const student of studentsInEvent) {
          const marks = await fetchStudentMarksForEvent(student.id, event.id, idToken);
          if (marks) {
            // Only consider the first round for team performance, even if both rounds exist
            const round1Score = getFinalScoreForPerformanceEvent(marks.rounds.round1, undefined);

            if (!provinceScoresForEvent[student.province!]) {
              provinceScoresForEvent[student.province!] = { teamA_Scores: [], teamB_Scores: [] };
            }
            if (student.team === 'A') {
              provinceScoresForEvent[student.province!].teamA_Scores.push(round1Score);
            } else if (student.team === 'B') {
              provinceScoresForEvent[student.province!].teamB_Scores.push(round1Score);
            }
          }
        }

        for (const province in provinceScoresForEvent) {
          const { teamA_Scores, teamB_Scores } = provinceScoresForEvent[province];

          teamA_Scores.sort((a, b) => b - a);
          teamB_Scores.sort((a, b) => b - a);

          const top5TeamA = teamA_Scores.slice(0, 5);
          const top5TeamB = teamB_Scores.slice(0, 5);

          const teamASum = top5TeamA.reduce((sum, score) => sum + score, 0);
          const teamBSum = top5TeamB.reduce((sum, score) => sum + score, 0);

          let winningTeam: ProvinceTeamPerformance['winningTeam'] = 'N/A';
          if (top5TeamA.length > 0 && top5TeamB.length > 0) {
            if (teamASum > teamBSum) winningTeam = 'Team A';
            else if (teamBSum > teamASum) winningTeam = 'Team B';
            else winningTeam = 'Tie';
          } else if (top5TeamA.length > 0) {
            winningTeam = 'Team A Wins (B no score)';
          } else if (top5TeamB.length > 0) {
            winningTeam = 'Team B Wins (A no score)';
          }

          if (!provinceEventPerformanceMap.has(province)) {
            provinceEventPerformanceMap.set(province, new Map());
          }
          provinceEventPerformanceMap.get(province)!.set(event.id, { teamASum, teamBSum, winningTeam });
        }
      }

      // Generate CSV Header
      let csvString = `Title:,Team Performance Results\n`;
      csvString += `Gender:,${safeCsvText(genderCategory)}\n\n`;

      // Updated header for the "long" format
      csvString += `Province,Event Name,Team A Score,Team B Score,Winning Team\n`;

      let anyActualDataAcrossAllEvents = false; // Declare it hervbe!
      // Generate CSV Rows in the requested "long" format
      let allPerformanceRows: string[] = [];
      for (const event of genderSpecificEvents) {
        for (const province of sortedProvinces) {
          const eventPerformance = provinceEventPerformanceMap.get(province)?.get(event.id);
          if (eventPerformance) {
            allPerformanceRows.push(
              `${safeCsvText(province)},` +
              `${safeCsvText(event.eventName)},` + // Event Name
              `${formatScoreForCsv(eventPerformance.teamASum)},` + // Team A Score
              `${formatScoreForCsv(eventPerformance.teamBSum)},` + // Team B Score
              `${safeCsvText(eventPerformance.winningTeam)}`
            );
            anyActualDataAcrossAllEvents = true;
          }
        }
      };
      csvString += allPerformanceRows.join('\n');
      if (allPerformanceRows.length > 0) {
          csvString += '\n'; // Add a newline at the end if there's data
      }

      if (!anyActualDataAcrossAllEvents) {
        hideFeedbackModal();
        displayModal(`No team performance data found for ${genderCategory} events across any province.`, "info", "No Data");
        if (genderCategory === 'Male') setDownloadingMaleCsv(false); else setDownloadingFemaleCsv(false);
        return;
      }

      const filename = `${genderCategory.toLowerCase()}_team_performances_report.csv`;
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
        displayModal(`${genderCategory} team performance report downloaded.`, "success", "Report Downloaded");
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Download ${genderCategory} Team Performances`, UTI: 'public.comma-separated-values-text' });
          displayModal(`${genderCategory} team performance report shared successfully.`, "success", "Report Shared");
        } else {
          displayModal(`CSV file for ${genderCategory} created, but sharing is not available.`, "info", "Device Error");
        }
      }

    } catch (error: any) { 
      hideFeedbackModal(); 
      displayModal(`Error generating ${genderCategory} CSV: ` + error.message, "error", "CSV Error", { autoClose: false });
    } finally { 
      if (genderCategory === 'Male') {
        setDownloadingMaleCsv(false);
      } else {
        setDownloadingFemaleCsv(false);
      }
    }
  };

  const handleDownloadProvinceCsv = async (provinceName: string, eventId: string) => {
    if (!idToken) {
      displayModal("Authentication error.", "error", "Auth Error", { autoClose: false });
      return;
    }
    if (!eventId) {
      displayModal("No event selected for detailed province download.", "error", "Selection Error");
      return;
    }

    setDownloadingProvinceCsv(prev => ({ ...prev, [provinceName]: true }));
    displayModal(`Preparing detailed report for ${provinceName}...`, "info", "Report Generation", { autoClose: true, autoCloseDelay: 4000 });

    try {
      const allStudents = await fetchStudents(idToken);
      const selectedEvent = allEvents.find(e => e.id === eventId);
      const eventName = selectedEvent ? selectedEvent.eventName : "Unknown Event";

      const studentsInProvince = allStudents.filter(s => s.province === provinceName);

      const teamAStudents: (typeof allStudents[0] & { finalScore: number, marksData: any })[] = [];
      const teamBStudents: (typeof allStudents[0] & { finalScore: number, marksData: any })[] = [];

      for (const student of studentsInProvince) {
        const marks = await fetchStudentMarksForEvent(student.id, eventId, idToken);
        if (marks) {
          const round1Score = calculateRoundScore(marks.rounds.round1);
          let finalScore = round1Score;
          let round2Score: number | undefined = undefined;

          if (marks.rounds.round2 && !isRoundDataEmpty(marks.rounds.round2)) {
            round2Score = calculateRoundScore(marks.rounds.round2);
            finalScore = (round1Score + (round2Score || 0)) / 2;
          }

          const studentData = {
            ...student,
            finalScore,
            marksData: {
              round1: marks.rounds.round1,
              round2: marks.rounds.round2,
              round1Score,
              round2Score,
            }
          };

          if (student.team === 'A') {
            teamAStudents.push(studentData);
          } else if (student.team === 'B') {
            teamBStudents.push(studentData);
          }
        }
      }

      teamAStudents.sort((a, b) => b.finalScore - a.finalScore);
      teamBStudents.sort((a, b) => b.finalScore - a.finalScore);
      
      let csvString = `Title:,Team Performance Details\n`;
      csvString += `Event Name:,${safeCsvText(eventName)}\n`;
      if (selectedEvent?.gender) { // Add gender if available in the event details
          csvString += `Event Gender:,${safeCsvText(selectedEvent.gender)}\n`;
      }
      csvString += `Province:,${safeCsvText(provinceName)}\n\n`; // Two newlines for separation
      
      // New merged header row for "Round 1" and "Round 2"
      const mergedHeaderRow = `,,,,,Round 1,,,,,,,Round 2,,,,,,,\n`; // Adjusted spacing for new Final Score column
      const individualStudentHeader = "ID,Student Name,Final Score,D,E1,E2,E3,E4,P,Score,D,E1,E2,E3,E4,P,Score\n"; // Final Score moved

      // Team A Section
      csvString += "Team A Students:\n";
      csvString += mergedHeaderRow;
      csvString += individualStudentHeader;
      let teamASumTop5 = 0;
      teamAStudents.forEach((s, index) => {
        if (index < 5) teamASumTop5 += s.finalScore;
        const r1 = s.marksData.round1; // Access round1 marks data
        const r2 = s.marksData.round2; // Access round2 marks data
        csvString += `${safeCsvText(s.indexNo)},${safeCsvText(s.fullName)},${formatScoreForCsv(s.finalScore)},` +
                     `${safeCsvText(r1.D)},${safeCsvText(r1.E1)},${safeCsvText(r1.E2)},${safeCsvText(r1.E3)},${safeCsvText(r1.E4)},${safeCsvText(r1.P)},${formatScoreForCsv(s.marksData.round1Score)},` +
                     `${safeCsvText(r2?.D)},${safeCsvText(r2?.E1)},${safeCsvText(r2?.E2)},${safeCsvText(r2?.E3)},${safeCsvText(r2?.E4)},${safeCsvText(r2?.P)},${formatScoreForCsv(s.marksData.round2Score)}\n`;
      });
      csvString += `Top 5 Score:,${formatScoreForCsv(teamASumTop5)}\n\n`; // Changed label

      // Team B Section
      csvString += "Team B Students:\n";
      csvString += mergedHeaderRow;
      csvString += individualStudentHeader;
      let teamBSumTop5 = 0;
      teamBStudents.forEach((s, index) => {
        if (index < 5) teamBSumTop5 += s.finalScore;
        const r1 = s.marksData.round1; // Access round1 marks data
        const r2 = s.marksData.round2; // Access round2 marks data
        csvString += `${safeCsvText(s.indexNo)},${safeCsvText(s.fullName)},${formatScoreForCsv(s.finalScore)},` + // Final Score moved here
                     `${safeCsvText(r1.D)},${safeCsvText(r1.E1)},${safeCsvText(r1.E2)},${safeCsvText(r1.E3)},${safeCsvText(r1.E4)},${safeCsvText(r1.P)},${formatScoreForCsv(s.marksData.round1Score)},` +
                     `${safeCsvText(r2?.D)},${safeCsvText(r2?.E1)},${safeCsvText(r2?.E2)},${safeCsvText(r2?.E3)},${safeCsvText(r2?.E4)},${safeCsvText(r2?.P)},${formatScoreForCsv(s.marksData.round2Score)}\n`; // Removed final score from end
      });
      csvString += `Top 5 Score:,${formatScoreForCsv(teamBSumTop5)}\n\n`; // Changed label

      // Determine winning team for this province
      const currentProvincePerformance = teamPerformances.find(p => p.province === provinceName);
      if (currentProvincePerformance) {
        csvString += `Winning Team:,${safeCsvText(currentProvincePerformance.winningTeam)}\n`;
      }

      const filename = `${provinceName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_details.csv`;
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
        displayModal(`${provinceName} detailed report downloaded.`, "success", "Report Downloaded");
      } else {
        const fileUri = FileSystem.cacheDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `Download ${provinceName} Details`, UTI: 'public.comma-separated-values-text' });
          displayModal(`${provinceName} detailed report shared.`, "success", "Report Shared");
        } else {
          displayModal(`CSV for ${provinceName} created, but sharing is unavailable.`, "info", "Device Error");
        }
      }

    } catch (error: any) {
      displayModal("Failed to generate detailed CSV: " + error.message, "error", "CSV Error", { autoClose: false });
    } finally {
      setDownloadingProvinceCsv(prev => ({ ...prev, [provinceName]: false }));
    }
  };

  const content = (
    <View style={styles.container}>
      {!isEmbedded && (
        <Text style={styles.headerTitle}>Team Performance Analysis</Text>
      )}
        
        {/* Filter/Search Row */}
        <View style={styles.filterRow}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedEventId}
              onValueChange={(itemValue) => setSelectedEventId(itemValue)}
              style={styles.picker}
              enabled={!loadingPerformance && !loadingEvents && allEvents.length > 0}
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
            style={styles.searchIconBtn} // Style updated below
            iconColor="#1565c0" // Icon color to contrast with grey background
            disabled={!selectedEventId || loadingPerformance || loadingEvents || allEvents.length === 0}
          />
          {selectedEventId && ( // Conditionally render clear button
            <IconButton
              icon="close-circle-outline"
              size={28}
              onPress={handleClearSelection}
              style={styles.clearIconBtn}
              iconColor="#e53935"
              disabled={loadingPerformance || loadingEvents} // Disable if loading, not based on teamPerformances.length
            />
          )}
        </View>

        {/* Download Buttons for Male and Female */}
        <View style={styles.downloadButtonsRow}>
          <Button
            icon="download" // Changed icon
            mode="contained" // Changed to contained (filled) - Matches Top8Screen
            onPress={() => handleDownloadGenderPerformancesCsv('Male')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loadingEvents || loadingPerformance} // Disable if either gender CSV is downloading or performance calculation is running
            loading={downloadingMaleCsv} // Use male-specific loading state
            style={[styles.genderDownloadButton, styles.maleButton]}
            labelStyle={styles.maleButtonLabel} // Corrected: Direct assignment
          >
            Male Performances
          </Button>
          <Button
            icon="download" // Changed icon
            mode="outlined"
            onPress={() => handleDownloadGenderPerformancesCsv('Female')}
            disabled={downloadingMaleCsv || downloadingFemaleCsv || loadingEvents || loadingPerformance} // Disable if either gender CSV is downloading or performance calculation is running
            loading={downloadingFemaleCsv} // Use female-specific loading state
            style={[styles.genderDownloadButton, styles.femaleButton]}
            labelStyle={styles.femaleButtonLabel} // Corrected: Direct assignment
          >
            Female Performance
          </Button>
        </View>

        {loadingPerformance ? (
          <View style={styles.centeredLoaderContainer}>
            <ActivityIndicator size="large" color="#1565c0" />
            <Text style={styles.loadingText}>Calculating Performance...</Text>
          </View>
        ) : (
          <>
            {/* {selectedEventId && teamPerformances.length > 0 && (
              <Button
                icon="file-download-outline"
                mode="contained"
                onPress={handleDownloadCsv} // This is the download for the currently selected event
                disabled={downloadingCsv}
                loading={downloadingCsv}
                style={styles.downloadButton}
              >
                {downloadingCsv ? "Preparing CSV..." : "Download Performance (CSV)"}
              </Button> 
            )} */}
            <FlatList
              data={teamPerformances}
              keyExtractor={(item) => item.province}
              renderItem={({ item }) => (
                <View style={styles.performanceItem}>
                  <Text style={styles.provinceName}>{item.province}</Text>
                  <Text style={styles.teamScore}>Team A Score: {formatScoreForDisplay(item.teamAScore)}</Text>
                  <Text style={styles.teamScore}>Team B Score: {formatScoreForDisplay(item.teamBScore)}</Text>
                  <Text style={[
                      styles.winningTeam,
                      item.winningTeam.includes('Team A') ? styles.teamAColor : {},
                      item.winningTeam.includes('Team B') ? styles.teamBColor : {},
                      item.winningTeam === 'Tie' ? styles.tieColor : {}
                    ]}
                  >
                    Winner: {item.winningTeam}
                  </Text>
                  <Button
                    icon="download"
                    mode="text" // Changed to 'text' mode for no border
                    onPress={() => handleDownloadProvinceCsv(item.province, selectedEventId!)}
                    disabled={!selectedEventId || downloadingProvinceCsv[item.province] || loadingPerformance}
                    loading={downloadingProvinceCsv[item.province]}
                    style={styles.downloadProvinceButton} // Adjust style for icon-only button
                  > 
                    {''} {/* Empty string as children to satisfy Button component */}
                  </Button>
                </View>
              )}
              ListEmptyComponent={
                selectedEventId ? (
                  <Text style={styles.emptyText}>No performance data found for the selected event.</Text>
                ) : (
                  <Text style={styles.emptyText}>Please select an event to view team performances.</Text>
                )
              }
              contentContainerStyle={styles.listContentContainer}
            />
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
        type={feedbackModalType}
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
    marginBottom: 8, // Add some space below the filter row before the "Download All" button
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
    // marginBottom: 16, // Adjusted by filterRow's marginBottom
    elevation: 2,
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#333', 
  },
  searchIconBtn: {
    backgroundColor: '#e0e0e0', // Common grey background
    borderRadius: 8,
    height: 48,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    // marginBottom: 16, // Adjusted
    marginLeft: 8,
    marginRight: 4,
  },
  clearIconBtn: { // Defined directly in StyleSheet
    borderRadius: 8,
    height: 48, 
    width: 48,  
    justifyContent: 'center',
    alignItems: 'center',
    // marginBottom: 16, // Adjusted
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
    backgroundColor: '#00796b', // Teal/Green for male (filled)
  },
  femaleButton: { // Copied from Top8Screen
    borderColor: '#00796b', // Teal/Green border for female (outlined)
    borderWidth: 2, 
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
  performanceItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  provinceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  teamScore: {
    fontSize: 16,
    color: '#555',
    marginBottom: 4,
  },
  winningTeam: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 6,
  },
  teamAColor: { color: '#2e7d32' }, 
  teamBColor: { color: '#d32f2f' }, 
  tieColor: { color: '#ff9800' }, 
  centeredLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  downloadButton: {
    marginTop: 8, // Space above this button if it appears
    marginBottom: 16, // Space below this button
    backgroundColor: '#00796b', // Changed to teal/green
  },
  downloadProvinceButton: {
    marginTop: 10,
    // borderColor: '#1565c0', // Removed border
    // borderWidth: 1, // Removed border
    alignSelf: 'flex-start', // Changed to left alignment
    minWidth: 40, // Ensure button isn't too small
    paddingHorizontal: 0, // Reduce horizontal padding
  },
  downloadAllButton: { // Keep styling for the "Download All" button
    borderColor: '#00796b', // A distinct color
    borderWidth: 1.5,
    height: 48, justifyContent: 'center',
  },
  downloadAllButtonText: { // Style for the text of the outlined "Download All" button
    color: '#00796b',
    fontWeight: 'bold',
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
