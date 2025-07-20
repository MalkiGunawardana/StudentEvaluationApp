import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, TextInput } from "react-native-paper";
import DesktopSideBar from "../../components/admin/DesktopSideBar";
import BottomNavBar from "../../components/BottomNavBar";
import { FeedbackModal } from "../../components/FeedbackModal"; // Import FeedbackModal
import { ShowModalOptions, useFeedbackModal } from "../../hooks/useFeedbackModal"; // Import useFeedbackModal
import { useAuth } from "../../utils/AuthContext";
import { addEvent, deleteEvent, EventData, EventDocument, fetchEvents, updateEvent } from "../../utils/firebaseRest"; // Removed fetchBatches

const genders = ["Male", "Female", "Other"];

export default function AddEventScreen({ navigation }: any) {
  const { auth } = useAuth();
  const isWeb = Platform.OS === 'web';

  // const [filterBatch, setFilterBatch] = useState(""); // Batch filter removed
  const [filterGender, setFilterGender] = useState("");
  // const [batches, setBatches] = useState<string[]>([]); // Batch list removed
  const [events, setEvents] = useState<EventDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearchedOrFiltered, setHasSearchedOrFiltered] = useState(false);
  const [fetchErrorOccurred, setFetchErrorOccurred] = useState(false); // New state to track fetch errors
  // Use the centralized feedback modal
  const { modalVisible: feedbackModalVisible, modalMsg: feedbackModalMsg, modalType: feedbackModalType, modalTitle: feedbackModalTitle, showModal: showFeedbackModal, hideModal: hideFeedbackModal } = useFeedbackModal();



  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<EventDocument | null>(null);

  const [modalEventName, setModalEventName] = useState("");
  // const [modalBatch, setModalBatch] = useState(""); // Modal batch removed
  const [modalGender, setModalGender] = useState("");
  const [modalErrors, setModalErrors] = useState<Partial<Record<'eventName' | 'batch' | 'gender', string>>>({});

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

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
      autoCloseDelay: type === "success" ? 2000 : 4000, // Default delays, errors might stay longer or need manual close
    };
    // If errors should not auto-close by default, set autoClose to false for errors
    if (type === "error") defaultOptions.autoClose = false;

    const finalOptions = { ...defaultOptions, ...options };
    showFeedbackModal(message, type, effectiveTitle, finalOptions);
  }, [showFeedbackModal]);

  const loadEventsInternal = useCallback(async (/*batchToFilter: string,*/ genderToFilter: string, isSearchTriggered: boolean) => { // batchToFilter removed
    if (!auth.idToken) {
        displayModal("Authentication token is missing. Please log in again.", "error", "Auth Error");
        setLoading(false);
        return;
    }
    setFetchErrorOccurred(false); // Reset error state on new load attempt
    setLoading(true);
    // console.log(`Attempting to fetch events with Gender: '${genderToFilter}', SearchTriggered: ${isSearchTriggered}`); // Batch log removed
    try {
      // const effectiveBatch = batchToFilter === "" ? undefined : batchToFilter; // Batch filter removed
      const effectiveGender = genderToFilter === "" ? undefined : genderToFilter;

      const fetchedEvents = await fetchEvents(auth.idToken, undefined /* effectiveBatch */, effectiveGender); // Pass undefined for batch
      setEvents(fetchedEvents);
      if (isSearchTriggered && fetchedEvents.length === 0 && (/*effectiveBatch ||*/ effectiveGender)) { // Batch condition removed
        displayModal("No events found for the selected filter.", "success", "Search Results");
      } else if (isSearchTriggered && fetchedEvents.length === 0 && !effectiveGender) { // Removed !effectiveBatch
        // This case handles when search is triggered with no filters and no results
        displayModal("No events found.", "success", "Search Results");
      }
    } catch (e: any) {
      // The detailed Firestore error is logged in firebaseRest.tsx's fetchEvents
      console.error("AddEventScreen.tsx - loadEventsInternal - Error caught:", e.message); 
      // Use a more user-friendly message for the notification modal
      const userFriendlyErrorMessage = "Failed to fetch events. Please check your connection or try again later.";
      displayModal(userFriendlyErrorMessage, "error", "Fetch Error");
      setEvents([]); 
      setFetchErrorOccurred(true); // Set that a fetch error occurred
    } finally {
      setLoading(false);
    }
  }, [auth.idToken, displayModal]);

  const loadInitialScreenData = useCallback(async () => {
    if (!auth.idToken) {
      displayModal("Authentication token is missing. Please log in again to load data.", "error", "Auth Error");
      setLoading(false); 
      return;
    }
    setLoading(true);
    setHasSearchedOrFiltered(false); 
    try {
      // Batch fetching and setting were removed here, which is correct.
      // Load all events initially.
      await loadEventsInternal(/*"",*/ "", false); // Load all events initially, batch arg removed
    } catch (error: any) {
      console.error("Load initial screen data error:", error); // Simplified error log
      displayModal(error.message || "Failed to load initial event data.", "error", "Load Error");
      // setLoading(false); // setLoading is handled in loadEventsInternal's finally block
    }
    // setLoading(false); // setLoading is handled in loadEventsInternal's finally block
  }, [auth.idToken, loadEventsInternal, displayModal]);

  useEffect(() => {
    loadInitialScreenData();
  }, [loadInitialScreenData]); 

  // Reactive filtering for web
  useEffect(() => {
    if (isWeb) {
      loadEventsInternal(filterGender, true);
    }
  }, [isWeb, filterGender, loadEventsInternal]);

  const handleSearch = () => {
    setHasSearchedOrFiltered(true);
    loadEventsInternal(/*filterBatch,*/ filterGender, true); // filterBatch removed
  };

  const handleClearGenderFilter = () => {
    setFilterGender("");
    // Reload events with the cleared gender filter
    loadEventsInternal(/*"",*/ "", true); // Pass true for isSearchTriggered to show "No events found" if applicable
  };

  const resetModalFields = () => {
    setModalEventName("");
    // setModalBatch(""); // Modal batch removed
    setModalGender("");
    setModalErrors({});
  };

  const openAddEventModal = () => {
    setIsEditing(false);
    setCurrentEvent(null);
    resetModalFields();
    setEventModalVisible(true);
  };

  const openEditEventModal = useCallback((event: EventDocument) => {
    setIsEditing(true);
    setCurrentEvent(event);
    setModalEventName(event.eventName);
    // setModalBatch(event.batch); // Modal batch removed
    setModalGender(event.gender);
    setModalErrors({});
    setEventModalVisible(true);
  }, []); 

  const openDeleteModal = useCallback((id: string) => {
    setDeleteEventId(id);
    setDeleteModalVisible(true);
  }, []); 

  const validateModalForm = () => {
    const errors: Partial<Record<'eventName' | 'batch' | 'gender', string>> = {};
    if (!modalEventName.trim()) errors.eventName = "Event name is required";
    // if (!modalBatch) errors.batch = "Batch is required"; // Modal batch validation removed
    if (!modalGender) errors.gender = "Gender is required";
    setModalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEvent = async () => {
    if (!validateModalForm()) return;
    if (!auth.idToken) {
      displayModal("Authentication error. Cannot save event.", "error", "Auth Error");
      return;
    }
    const eventData: EventData = {
      // batch: "N/A", // Batch field is removed from EventData interface and Firestore documents
      gender: modalGender,
      eventName: modalEventName.trim(),
    };
    setLoading(true);
    try {
      if (isEditing && currentEvent) {
        await updateEvent(currentEvent.id, eventData, auth.idToken);
        displayModal("Event updated successfully!", "success", "Update Success");
      } else {
        await addEvent(eventData, auth.idToken);
        displayModal("Event added successfully!", "success", "Add Success");
      }
      setEventModalVisible(false);
      // Refresh list based on current main screen filters, or all if no filters were set
      await loadEventsInternal(/*filterBatch,*/ filterGender, hasSearchedOrFiltered); // filterBatch removed
    } catch (e: any) {
      console.error("Save event error:", e);
      displayModal(e.message || "Failed to save event. Check console for details.", "error", "Save Error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!auth.idToken || !deleteEventId) {
        displayModal("Authentication error or no event selected for deletion.", "error", "Delete Error");
        return;
    }
    setLoading(true);
    try {
      await deleteEvent(deleteEventId, auth.idToken);
      displayModal("Event deleted successfully!", "success", "Delete Success");
      setDeleteModalVisible(false);
      setDeleteEventId(null);
      await loadEventsInternal(/*filterBatch,*/ filterGender, hasSearchedOrFiltered); // filterBatch removed
    } catch (e: any) { 
      console.error("Delete event error:", e);
      displayModal(e.message || "Failed to delete event. Check console for details.", "error", "Delete Error");
    } finally {
      setLoading(false);
    }
  };

  const TopShape = React.memo(() => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Create Events</Text>
            <Text style={styles.pageSubtitle}>Add or find event details here</Text>
          </View>
          <Image
            source={require("../../assets/images/logobgr.png")}
            style={styles.topBarLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  ));

  const renderEventItem = useCallback(({ item }: { item: EventDocument }) => ( // Added isWeb to dependency array
    <View style={isWeb ? styles.webEventRow : styles.eventRow}>
      <View style={{ flex: 1 }}>
        <Text style={isWeb ? styles.webEventNameText : styles.eventNameText}>{item.eventName}</Text>
        <Text style={isWeb ? styles.webEventDetailText : styles.eventDetailText}>Gender: {item.gender}</Text>
      </View>
      <View style={styles.iconGroup}>
        <IconButton
          icon="pencil"
          size={22}
          onPress={() => openEditEventModal(item)}
          style={styles.iconBtn}
          accessibilityLabel="Edit event"
        />
        <IconButton
          icon="delete"
          size={22}
          onPress={() => openDeleteModal(item.id)}
          style={styles.iconBtn}
          accessibilityLabel="Delete event"
        />
      </View>
    </View>
  ), [isWeb, openEditEventModal, openDeleteModal]);

  const EventModal = () => (
    <Modal visible={eventModalVisible} transparent animationType="fade" onRequestClose={() => setEventModalVisible(false)}>
      <View style={styles.modalContainer}>
        <ScrollView contentContainerStyle={styles.modalScrollContainer}>
          <View style={styles.modalBoxLarge}>
            <Text style={styles.sectionTitleModal}>{isEditing ? "Edit Event" : "Add New Event"}</Text>
            <View style={[styles.pickerContainerModal, modalErrors.gender ? styles.errorBorder : {}]}>
              <Picker selectedValue={modalGender} onValueChange={setModalGender} style={styles.pickerModal}>
                <Picker.Item label="Select Gender" value="" />
                {genders.map((g) => (<Picker.Item key={g} label={g} value={g} />))}
              </Picker>
            </View>
            {modalErrors.gender && <Text style={styles.errorTextModal}>{modalErrors.gender}</Text>}
            <TextInput
              label="Event Name"
              value={modalEventName}
              onChangeText={setModalEventName}
              style={styles.inputModal}
              mode="outlined"
              error={!!modalErrors.eventName}
            />
            {modalErrors.eventName && <Text style={styles.errorTextModal}>{modalErrors.eventName}</Text>}
            <View style={styles.modalButtonRow}>
              <Button mode="outlined" onPress={() => setEventModalVisible(false)} style={styles.modalButton}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleSaveEvent} style={[styles.modalButton, styles.modalSaveButton]} disabled={loading}>
                {isEditing ? "Save Changes" : "Save Event"}
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const DeleteConfirmModal = () => (
    <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalBox}>
          <Text style={styles.deleteModalTitle}>Delete Event</Text>
          <Text style={styles.deleteModalMessage}>Are you sure you want to delete this event?</Text>
          <View style={styles.modalButtonRow}>
            <Button mode="outlined" onPress={() => setDeleteModalVisible(false)} style={styles.modalButton}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleDeleteEvent} style={[styles.modalButton, styles.modalDeleteButton]} disabled={loading}>
              Delete
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        <DesktopSideBar />
        <View style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webPageTitle}>Manage Events</Text>
            <Text style={styles.webPageSubtitle}>Add, edit, or remove events</Text>
          </View>

          <View style={styles.webControlsContainer}>
            <View style={[styles.webPickerContainer, { flex: 0.5, marginRight: 16 }]}>
              <Picker selectedValue={filterGender} onValueChange={setFilterGender} style={styles.picker}>
                <Picker.Item label="All Genders" value="" />
                {genders.map((g) => (<Picker.Item key={g} label={g} value={g} />))}
              </Picker>
            </View>
            <Button
              mode="contained"
              onPress={openAddEventModal}
              style={styles.webAddButton}
              buttonColor="#1565c0"
              icon="plus"
            >
              Add New Event
            </Button>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={events}
              keyExtractor={(item) => item.id}
              renderItem={renderEventItem}
              numColumns={2}
              key={'web-list'}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              ListEmptyComponent={<Text style={styles.emptyListText}>No events found.</Text>}
            />
          )}
        </View>
        <FeedbackModal visible={feedbackModalVisible} message={feedbackModalMsg} type={feedbackModalType} title={feedbackModalTitle} onClose={hideFeedbackModal} />
        <EventModal />
        <DeleteConfirmModal />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopShape />
      <View style={styles.container}>
        <View style={styles.filterSearchRow}>
          {/* <View style={[styles.pickerContainer, { flex: 1, marginRight: 4 }]}>
            <Picker selectedValue={filterBatch} onValueChange={setFilterBatch} style={styles.picker}>
              <Picker.Item label="Select Batch..." value="" />
              {batches.map((b) => (<Picker.Item key={b} label={b} value={b} />))}
            </Picker>
          </View> */}
          {/* Gender Filter Row */}
          <View style={styles.genderFilterRow}>
            <View style={[styles.pickerContainer, { flex: 1 }]}>
              <Picker selectedValue={filterGender} onValueChange={setFilterGender} style={styles.picker}>
                <Picker.Item label="Select Gender..." value="" />
                {genders.map((g) => (<Picker.Item key={g} label={g} value={g} />))}
              </Picker>
            </View>
            {filterGender.length > 0 && (
              <IconButton
                icon="close-circle-outline" // Or "close"
                size={24}
                onPress={handleClearGenderFilter}
                style={styles.clearIconBtn} // Re-use or create a similar style
                accessibilityLabel="Clear gender filter"
              />
            )}
          </View>
          <IconButton
            icon="magnify"
            size={28}
            onPress={handleSearch}
            style={styles.searchIconBtn}
            disabled={loading}
            accessibilityLabel="Search events"
          />
        </View>

        <Button
          mode="contained"
          onPress={openAddEventModal}
          style={styles.addEventButton}
          buttonColor="#1565c0"
          disabled={loading}
          icon="plus-circle-outline"
        >
          Add New Event
        </Button>

        <Text style={styles.sectionTitle}>Events</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#1565c0" style={styles.loader} />
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={renderEventItem}
            ListEmptyComponent={ // Updated logic for ListEmptyComponent
              loading ? null : fetchErrorOccurred ? null : ( // If loading or error, show nothing (modal handles error)
                hasSearchedOrFiltered && events.length === 0 ? (
                  <Text style={styles.emptyListText}>
                    No events found. Try different filters or add a new event.
                  </Text>
                ) : !hasSearchedOrFiltered && events.length === 0 ? (
                  <Text style={styles.emptyListText}>
                    No events available. Add a new event to get started.
                  </Text>
                ) : null
              )
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

      <EventModal />
      <DeleteConfirmModal />

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
  filterSearchRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 },
  genderFilterRow: { // New style for gender picker and its clear button
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8, // Space before the main search icon
  },
  pickerContainer: { borderWidth: 1, borderColor: "#bbb", borderRadius: 8, backgroundColor: "#fff", overflow: "hidden", height: 48, justifyContent: 'center' },
  picker: { height: 48, width: "100%", color: '#333' }, // Ensure selected item text (including placeholder) is visible
  searchIconBtn: { backgroundColor: "#e0e0e0", borderRadius: 8, marginHorizontal: 0, height: 48, width: 48, justifyContent: 'center', alignItems: 'center' },
  addEventButton: { marginHorizontal: 4, marginBottom: 16, height: 48, justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1565c0", marginBottom: 8, marginTop: 8, paddingHorizontal: 4 },
  loader: { marginTop: 20, alignSelf: 'center' },
  flatList: { marginTop: 8, flex: 1 },
  flatListContent: { paddingBottom: 80 }, // Adjusted padding
  clearIconBtn: { // Style for the clear filter icon button
    marginLeft: 0, // Adjust as needed
    marginRight: -4, // Adjust to align nicely
    alignSelf: "center",
    backgroundColor: 'transparent', // Or a very light grey if preferred
    // No border or elevation needed for a simple clear icon
  },
  emptyListText: { color: "#888", textAlign: "center", marginTop: 20, fontSize: 15 },
  eventRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10, elevation: 2, justifyContent: "space-between" },
  eventNameText: { fontSize: 16, fontWeight: "bold", color: "#222", marginBottom: 4 },
  eventDetailText: { fontSize: 14, color: "#555", marginBottom: 2 },
  iconGroup: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  iconBtn: { marginHorizontal: -2, marginVertical: -2 },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalScrollContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 20 },
  modalBox: { backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", minWidth: 280, maxWidth: 340, marginHorizontal: 16, elevation: 5 },
  modalBoxLarge: { backgroundColor: "#fff", borderRadius: 10, padding: 24, alignItems: "center", justifyContent: "center", width: "90%", maxWidth: 400, marginHorizontal: 16, elevation: 5 },
  successModalText: { color: "green", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  errorModalText: { color: "red", fontWeight: 'bold', fontSize: 16, textAlign: "center" },
  modalCloseButton: { marginTop: 12 },
  errorTextModal: { color: "red", marginBottom: 6, marginLeft: 4, textAlign: "left", fontSize: 13, width: '100%' },
  inputModal: { width: "100%", marginBottom: 8, backgroundColor: "#fff" },
  pickerContainerModal: { width: "100%", borderWidth: 1, borderColor: "#bbb", borderRadius: 8, marginBottom: 10, backgroundColor: "#fff", overflow: "hidden", height: 48, justifyContent: 'center' },
  pickerModal: { height: 48, width: "100%", color: '#333' }, // Ensure selected item text (including placeholder) is visible
  sectionTitleModal: { fontSize: 18, fontWeight: "bold", color: "#1565c0", marginBottom: 16, textAlign: 'center' },
  errorBorder: { borderColor: 'red' },
  modalButtonRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 16 },
  modalButton: { flex: 1, marginHorizontal: 8 },
  modalSaveButton: { backgroundColor: "#1565c0" },
  modalDeleteButton: { backgroundColor: "#e53935" },
  deleteModalTitle: { fontWeight: "bold", fontSize: 18, marginBottom: 12 },
  deleteModalMessage: { marginBottom: 20, fontSize: 15, textAlign: 'center' },
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
  webAddButton: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  webEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 2,
    width: '48%',
    justifyContent: 'space-between',
  },
  webEventNameText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  webEventDetailText: { fontSize: 14, color: '#666', marginTop: 2 },
});
  

