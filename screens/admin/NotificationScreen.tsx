import DesktopSideBar from "@/components/admin/DesktopSideBar";
import AdminBottomNavBar from "@/components/BottomNavBar";
import { FeedbackModal, ModalType } from "@/components/FeedbackModal";
import { useFeedbackModal } from "@/hooks/useFeedbackModal";
import { useAuth } from "@/utils/AuthContext";
import { EditRequest, fetchAllAdminRequests, fetchAllMarkEntryNotifications, updateEditRequestStatus } from "@/utils/firebaseRest";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Paragraph, SegmentedButtons, Title } from "react-native-paper";


const NotificationScreen = ({ navigation }: any) => {
    const isWeb = Platform.OS === 'web';
    const { auth } = useAuth();
    const idToken = auth?.idToken;
    const [requests, setRequests] = useState<EditRequest[]>([]);
    const [markNotifications, setMarkNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState<'marks' | 'requests'>('marks');
    const { modalVisible, modalMsg, modalType, modalTitle, showModal, hideModal } = useFeedbackModal();

    // Fetch both admin requests and mark notifications
    const loadNotifications = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch admin requests
            let allRequests: EditRequest[] = [];
            if (idToken) {
                allRequests = await fetchAllAdminRequests(idToken);
            }
            setRequests(allRequests);

            // Fetch mark entry notifications using backend function (like admin requests)
            let allMarkNotifications: any[] = [];
            if (idToken) {
                allMarkNotifications = await fetchAllMarkEntryNotifications(idToken);
            }
            setMarkNotifications(allMarkNotifications);
        } catch (error: any) {
            showModal(`Failed to load notifications: ${error.message}`, 'error', 'Load Error');
        } finally {
            setLoading(false);
        }
    }, [idToken, showModal]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleRequestUpdate = async (requestId: string, newStatus: 'approved' | 'rejected') => {
        if (!idToken) return;
        try {
            await updateEditRequestStatus(requestId, newStatus, idToken);
            showModal(`Request has been ${newStatus}.`, 'success', 'Update Success');
            setRequests(prev =>
                prev.map(req => (req.id === requestId ? { ...req, status: newStatus } : req))
            );
        } catch (error: any) {
            showModal(`Failed to update request: ${error.message}`, 'error', 'Update Error');
        }
    };

    const TopBarContent = () => (
        <View style={styles.topBarInternal}>
            <View style={{ flex: 1 }}>
                <Title style={styles.pageTitle}>Notifications</Title>
                <Paragraph style={styles.pageSubtitle}>Check your notifications here.</Paragraph>
            </View>
            <Image source={require('@/assets/images/logobgr.png')} style={styles.topBarLogo} resizeMode="contain" />
        </View>
    );

    // Render admin edit requests
    const renderRequestItem = ({ item }: { item: EditRequest }) => (
        <Card style={isWeb ? styles.webCard : styles.card}>
            <Card.Content>
                <Title style={styles.cardTitle}>Request from {item.supervisorName}</Title>
                <Paragraph style={styles.cardText}>
                    Wants to edit marks for <Text style={{fontWeight: 'bold'}}>{item.studentName}</Text> in the event <Text style={{fontWeight: 'bold'}}>{item.eventName}</Text>.
                </Paragraph>
            </Card.Content>
            <Card.Actions style={styles.cardActions}>
                {item.status === 'pending' ? (
                    <>
                        <Button mode="outlined" color="red" onPress={() => handleRequestUpdate(item.id!, 'rejected')}>Reject</Button>
                        <Button mode="contained" buttonColor="#1565c0" onPress={() => handleRequestUpdate(item.id!, 'approved')}>Approve</Button>
                    </>
                ) : (
                    <Text style={item.status === 'approved' ? styles.approvedText : styles.rejectedText}>
                         {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                )}
            </Card.Actions>
        </Card>
    );

    // Render mark entry notifications
    const renderMarkNotification = ({ item }: { item: any }) => (
        <Card style={isWeb ? styles.webCard : styles.card}>
            <Card.Content>
                <Title style={styles.cardTitle}>Marks Entered: {item.studentName}</Title>
                <Paragraph style={styles.cardText}>
                    <Text style={{fontWeight: 'bold'}}>ID:</Text> {item.studentId}{"\n"}
                    <Text style={{fontWeight: 'bold'}}>Province:</Text> {item.province}{"\n"}
                    <Text style={{fontWeight: 'bold'}}>Event:</Text> {item.eventName}{"\n"}
                    <Text style={{fontWeight: 'bold'}}>D Mark:</Text> {item.D}{"\n"}
                    <Text style={{fontWeight: 'bold'}}>Final Mark:</Text> {item.finalMark}
                </Paragraph>
            </Card.Content>
        </Card>
    );

    if (isWeb) {
        return (
            <View style={styles.webContainer}>
                <DesktopSideBar />
                <View style={styles.webMainContent}>
                    <View style={styles.webHeader}>
                        <Text style={styles.webPageTitle}>Notifications</Text>
                        <Text style={styles.webPageSubtitle}>Approve/reject requests and view mark entries</Text>
                    </View>
                    <SegmentedButtons
                        value={selectedTab}
                        onValueChange={setSelectedTab}
                        buttons={[
                            { value: 'marks', label: 'Mark Entry Notifications' },
                            { value: 'requests', label: 'Admin Edit Requests' },
                        ]}
                        style={styles.segmentedControl}
                        theme={{
                            colors: {
                                secondaryContainer: '#e3eafc', // background for selected
                                onSecondaryContainer: '#1565c0', // text for selected
                                surfaceVariant: 'transparent', // background for unselected
                                outline: 'transparent', // remove border
                            },
                        }}
                        density="small"
                    />
                    {loading ? (
                        <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 50 }} />
                    ) : (
                        <View style={{ flex: 1 }}>
                            {selectedTab === 'marks' ? (
                                <FlatList
                                    data={markNotifications}
                                    renderItem={renderMarkNotification}
                                    keyExtractor={item => item.id}
                                    ListEmptyComponent={<Text style={styles.emptyText}>No mark notifications.</Text>}
                                    contentContainerStyle={{marginBottom:24}}
                                    style={{ flex: 1, minHeight: 300 }}
                                />
                            ) : (
                                <FlatList
                                    data={requests}
                                    renderItem={renderRequestItem}
                                    keyExtractor={item => item.id!}
                                    ListEmptyComponent={<Text style={styles.emptyText}>No pending requests.</Text>}
                                    onRefresh={loadNotifications}
                                    refreshing={loading}
                                    style={{ flex: 1, minHeight: 300 }}
                                />
                            )}
                        </View>
                    )}
                </View>
                <FeedbackModal visible={modalVisible} message={modalMsg} type={modalType as ModalType} title={modalTitle} onClose={hideModal} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.topShapeContainer}><View style={styles.topShape} /><View style={styles.topBarContainer}><TopBarContent /></View></View>
            <View style={styles.mainContentContainer}>
                <SegmentedButtons
                    value={selectedTab}
                    onValueChange={setSelectedTab}
                    buttons={[
                        { value: 'marks', label: 'Mark Entry Notifications' },
                        { value: 'requests', label: 'Admin Edit Requests' },
                    ]}
                    style={styles.segmentedControl}
                    theme={{
                        colors: {
                            secondaryContainer: '#e3eafc',
                            onSecondaryContainer: '#1565c0',
                            surfaceVariant: 'transparent',
                            outline: 'transparent',
                        },
                    }}
                    density="small"
                />
                {loading ? (
                    <ActivityIndicator size="large" color="#1565c0" style={{ marginTop: 50 }} />
                ) : (
                    <View style={{ flex: 1 }}>
                        {selectedTab === 'marks' ? (
                            <FlatList
                                data={markNotifications}
                                renderItem={renderMarkNotification}
                                keyExtractor={item => item.id}
                                ListEmptyComponent={<Text style={styles.emptyText}>No mark notifications.</Text>}
                                contentContainerStyle={{marginBottom:24}}
                                style={{ flex: 1, minHeight: 300 }}
                            />
                        ) : (
                            <FlatList
                                data={requests}
                                renderItem={renderRequestItem}
                                keyExtractor={item => item.id!}
                                ListEmptyComponent={<Text style={styles.emptyText}>No pending requests.</Text>}
                                onRefresh={loadNotifications}
                                refreshing={loading}
                                style={{ flex: 1, minHeight: 300 }}
                            />
                        )}
                    </View>
                )}
            </View>
            <FeedbackModal visible={modalVisible} message={modalMsg} type={modalType as ModalType} title={modalTitle} onClose={hideModal} />
            <AdminBottomNavBar navigation={navigation} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#f5faff" }, 
    mainContentContainer: { flex: 1, paddingTop: 160, paddingHorizontal: 16 }, 
    topShapeContainer: { position: "absolute", top: 0, left: 0, right: 0, height: 150, zIndex: 1 }, 
    topShape: { backgroundColor: "#1565c0", height: 150, borderBottomLeftRadius: 60, borderBottomRightRadius: 60, opacity: 0.15 }, 
    topBarContainer: { position: "absolute", top: 0, left: 0, right: 0, height: 110, justifyContent: "flex-end", paddingHorizontal: 20, paddingTop: 20 }, 
    topBarInternal: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, 
    pageTitle: { fontSize: 24, color: "#1565c0", fontWeight: "bold" }, 
    pageSubtitle: { fontSize: 15, color: "#555" }, 
    topBarLogo: { width: 100, height: 100, marginLeft: 10, marginTop: -10 }, 
    card: { marginVertical: 8, elevation: 2 },
    cardTitle: { fontSize: 16, color: '#1565c0' }, 
    cardText: { fontSize: 14, lineHeight: 20 }, 
    cardActions: { justifyContent: 'flex-end', paddingTop: 10, paddingRight: 8, minHeight: 48 }, 
    emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#666' },
    approvedText: { color: 'green', fontWeight: 'bold', fontSize: 14 },
    rejectedText: { color: 'red', fontWeight: 'bold', fontSize: 14 },
    // Web-specific styles
    segmentedControl: {
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#f5faff',
        borderWidth: 0,
        elevation: 0,
        shadowColor: 'transparent',
        overflow: 'hidden',
    },
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
    webCard: { marginVertical: 8, elevation: 2, width: '100%', maxWidth: 800 },
});


export default NotificationScreen;