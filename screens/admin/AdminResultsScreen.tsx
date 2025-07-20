import React, { useState } from 'react';
import { Image, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminBottomNavBar from '../../components/BottomNavBar';
import DesktopSideBar from '../../components/admin/DesktopSideBar';
import AllRoundersScreen from './AllRoundersScreen';
import Performance2Screen from './Performance2Screen';
import TeamPerformanceScreen from './TeamPerformanceScreen';
import Top8Screen from './Top8Screen';

type ActiveScreenType = 'TeamPerformance' | 'Top8' | 'AllRounders' | 'Performance2';

export default function AdminResultsScreen({ navigation }: any) {
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const [activeScreen, setActiveScreen] = useState<ActiveScreenType>('TeamPerformance');

  // Reusable TopBar and TopShape components (similar to other screens)
  const TopBarContent = () => (
    <View style={styles.topBarInternal}>
      <View style={{flex: 1}}>
        <Text style={styles.pageTitle}>Results Dashboard</Text>
        <Text style={styles.pageSubtitle}>View performance metrics</Text>
      </View>
      <Image source={require("../../assets/images/logobgr.png")} style={styles.topBarLogo} resizeMode="contain" />
    </View>
  );

  const TopShape = React.memo(() => (
    <View style={[styles.topShapeContainer, { paddingTop: insets.top }]}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}><TopBarContent /></View>
    </View>
  ));

  const renderContent = () => {
    switch (activeScreen) {
      case 'TeamPerformance':
        return <TeamPerformanceScreen isEmbedded={isWeb} />;
      case 'Top8':
        return <Top8Screen isEmbedded={isWeb} />;
      case 'AllRounders':
        return <AllRoundersScreen isEmbedded={isWeb} />;
      case 'Performance2':
        return <Performance2Screen isEmbedded={isWeb} />;
      default:
        return null;
    }
  };

  const CustomTabButton = ({ title, screenName }: { title: string; screenName: ActiveScreenType }) => (
    <TouchableOpacity
      style={[isWeb ? styles.webTab : styles.customTab, activeScreen === screenName && (isWeb ? styles.webTabActive : styles.customTabActive)]}
      onPress={() => setActiveScreen(screenName)}
    >
      <Text style={[styles.customTabText, activeScreen === screenName && (isWeb ? styles.webTabTextActive : styles.customTabTextActive)]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <View style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Results Dashboard</Text>
            <Text style={styles.webPageSubtitle}>View performance metrics</Text>
          </View>
          <View style={styles.webTabsContainer}>
            <CustomTabButton title="Team Performance" screenName="TeamPerformance" />
            <CustomTabButton title="Top 8" screenName="Top8" />
            <CustomTabButton title="All Rounders" screenName="AllRounders" />
            <CustomTabButton title="Performance 2" screenName="Performance2" />
          </View>
          <View style={styles.webScreenContentContainer}>
            {renderContent()}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopShape />
      <View style={styles.contentContainerParent}>
        <View style={styles.customTabsContainer}>
          <View style={styles.customTabsRow}>
            <CustomTabButton title="Team Performance" screenName="TeamPerformance" />
            <CustomTabButton title="Top 8" screenName="Top8" />
          </View>
          <View style={styles.customTabsRow}>
            <CustomTabButton title="All Rounders" screenName="AllRounders" />
            <CustomTabButton title="Performance 2" screenName="Performance2" />
          </View>
        </View>
        <View style={styles.screenContentContainer}>
          {renderContent()}
        </View>
      </View>
      <AdminBottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5faff',
  },
  topShapeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0, // Increased height to match other screens
    height: 150,
    zIndex: 1,
  },
  topShape: {
    backgroundColor: '#1565c0',
    height: '100%', // Fill the container
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    opacity: 0.15,
  },
  topBarContainer: {
    position: 'absolute',
    top: 0, // Align with top of safe area
    left: 0,
    right: 0,
    bottom: 0, // Stretch to bottom of shape container
    justifyContent: 'flex-end', // Align content to bottom
    paddingHorizontal: 20,
    paddingBottom: 10, // Space from bottom edge of shape - Keep this
  },
  topBarInternal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginTop: 10, // Add if needed to push content down slightly within the container
  },
  pageTitle: {
    fontSize: 24, // Match other screens
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 2, // Add space below title
  },
  pageSubtitle: {
    fontSize: 15, // Match other screens
    color: '#555',
    marginTop: 2, // Add space above subtitle
  },
  topBarLogo: {
    width: 100, // Match other screens
    height: 100, // Match other screens
    marginLeft: 10,
    marginTop: -10, // Adjust position to match other screens
  },
  contentContainerParent: { // Renamed from tabNavigatorContainer
    flex: 1,
    paddingTop: 150, // Match the new height of the TopShapeContainer
  },
  customTabsContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff', // Optional: background for the tab area
    elevation: 2,
  },
  customTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8, // Space between rows
  },
  customTab: {
    flex: 1, // Each button takes equal width in its row
    marginHorizontal: 4, // Space between buttons
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0', // Inactive tab background
    borderRadius: 8,
    minHeight: 50, // Ensure tabs have a decent touch area
  },
  customTabActive: {
    backgroundColor: '#1565c0', // Active tab background
  },
  customTabText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333', // Inactive tab text color
    textAlign: 'center',
  },
  customTabTextActive: {
    color: '#fff',
  },
  screenContentContainer: {
    flex: 1, // Takes remaining space
    // backgroundColor: '#f5faff', // Or keep it transparent
  },
  // Web-specific styles
  webContainer: { flexDirection: 'row', height: '100%', backgroundColor: '#f8f9fa' },
  webMainContent: { flex: 1, padding: 32, height: '100%' },
  webHeader: { marginBottom: 32 },
  webPageTitle: { fontSize: 32, fontWeight: 'bold', color: '#1A202C' },
  webPageSubtitle: { fontSize: 16, color: '#718096', marginTop: 4 },
  webTabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 24,
  },
  webTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  webTabActive: {
    borderBottomColor: '#1565c0',
  },
  webTabTextActive: {
    color: '#1565c0',
    fontWeight: '600',
  },
  webScreenContentContainer: {
    flex: 1,
  },
});
