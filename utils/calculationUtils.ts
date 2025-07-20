// f:\Document\MG\Projects\SES\student-evaluation-app\utils\calculationUtils.ts
import { MarksEntryData } from './firebaseRest'; // Assuming MarksEntryData is exported from firebaseRest or a types file

/**
 * Calculates the score for a single round of an event.
 * E scores:
 * - If 4 E scores: Drops highest and lowest, averages the two middle scores.
 * - If 3 E scores: Drops highest and lowest, uses the single middle score.
 * - If 2 E scores: Averages the two scores.
 * - If 1 E score: Uses that score directly.
 * - If 0 E scores: E component is 0.
 * Final score = (Processed E scores) + D - P.
 */
export const calculateRoundScore = (marks: MarksEntryData): number => {
  const D = parseFloat(marks.D || "0");
  const P = parseFloat(marks.P || "0");

  // Filter out undefined, null, or empty strings, then convert to numbers
  const E_scores_num = [marks.E1, marks.E2, marks.E3, marks.E4]
    .filter(e => e !== undefined && e !== null && e !== "")
    .map(e => parseFloat(e!)) // e is guaranteed to be a string here
    .filter(e => !isNaN(e)); // Ensure only valid numbers remain

  let eScoreComponent = 0;

  if (E_scores_num.length === 1) {
    eScoreComponent = E_scores_num[0];
  } else if (E_scores_num.length === 2) {
    eScoreComponent = (E_scores_num[0] + E_scores_num[1]) / 2;
  } else if (E_scores_num.length === 3) {
    const sortedScores = [...E_scores_num].sort((a, b) => a - b);
    eScoreComponent = sortedScores[1]; // The middle score
  } else if (E_scores_num.length === 4) {
    const sortedScores = [...E_scores_num].sort((a, b) => a - b);
    eScoreComponent = (sortedScores[1] + sortedScores[2]) / 2; // Average of the two middle scores
  }
  // If E_scores_num.length is 0, eScoreComponent remains 0, which is correct.

  return eScoreComponent + D - P;
};

/**
 * Checks if all mark entries in a round are empty or undefined/null.
 */
export const isRoundDataEmpty = (marks: MarksEntryData | undefined): boolean => {
  if (!marks) return true;
  // Check if D, P, E1, E2, E3, E4 are all effectively empty
  return (
    (marks.D === undefined || marks.D === null || marks.D === "") &&
    (marks.P === undefined || marks.P === null || marks.P === "") &&
    (marks.E1 === undefined || marks.E1 === null || marks.E1 === "") &&
    (marks.E2 === undefined || marks.E2 === null || marks.E2 === "") &&
    (marks.E3 === undefined || marks.E3 === null || marks.E3 === "") &&
    (marks.E4 === undefined || marks.E4 === null || marks.E4 === "")
  );
};

/**
 * Calculates the final score for an event that can have one or two rounds (like Performance 2).
 * If Round 2 data exists and is not empty, the final score is the average of Round 1 and Round 2.
 * Otherwise, the final score is just the Round 1 score.
 */
export const getFinalScoreForPerformanceEvent = (
  round1Marks: MarksEntryData,
  round2Marks?: MarksEntryData
): number => {
  const round1Score = calculateRoundScore(round1Marks);

  if (round2Marks && !isRoundDataEmpty(round2Marks)) {
    const round2Score = calculateRoundScore(round2Marks);
    return (round1Score + round2Score) / 2;
  }
  return round1Score;
};
