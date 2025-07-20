import React, { useEffect, useState } from "react";
import { FlatList, Image, Modal, SafeAreaView, StyleSheet, View } from "react-native";
import { Button, IconButton, Text, TextInput } from "react-native-paper";
import BottomNavBar from "../../components/BottomNavBar";
import { useAuth } from "../../utils/AuthContext";
import { addBatch, deleteBatch, fetchBatchesWithIds, updateBatch } from "../../utils/firebaseRest";

export default function AddBatchScreen({ navigation }: any) {
  const { auth } = useAuth();
  const [batch, setBatch] = useState("");
  const [errors, setErrors] = useState<{ batch?: string }>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMsg, setModalMsg] = useState("");
  const [modalType, setModalType] = useState<"success" | "error">("success");

  // Batch list
  const [batches, setBatches] = useState<{ id: string; batch: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editBatchId, setEditBatchId] = useState<string | null>(null);
  const [editBatchValue, setEditBatchValue] = useState("");

  // Delete confirm modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
    // eslint-disable-next-line
  }, [auth.idToken]);

  const loadBatches = async () => {
    if (!auth.idToken) return;
    setLoading(true);
    const list = await fetchBatchesWithIds(auth.idToken);
    setBatches(list);
    setLoading(false);
  };

  const showModal = (msg: string, type: "success" | "error" = "success", autoClose = true) => {
    setModalMsg(msg);
    setModalType(type);
    setModalVisible(true);
    if (autoClose) {
      setTimeout(() => setModalVisible(false), 1500);
    }
  };

  const handleSave = async () => {
    setErrors({});
    let newErrors: { batch?: string } = {};
    if (!batch.trim()) newErrors.batch = "Batch is required";
    else if (!/^\d{4}\/\d{4}$/.test(batch.trim())) newErrors.batch = "Format must be YYYY/YYYY";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      if (!auth.idToken) {
        showModal("Authentication error. Please log in again.", "error");
        return;
      }
      await addBatch({ batch: batch.trim() }, auth.idToken);
      showModal("Batch added successfully!", "success");
      setBatch("");
      loadBatches();
    } catch (e) {
      showModal("Failed to save batch.", "error");
    }
  };

  // Edit batch handlers
  const openEditModal = (id: string, value: string) => {
    setEditBatchId(id);
    setEditBatchValue(value);
    setEditModalVisible(true);
  };
  const handleEditSave = async () => {
    if (!editBatchValue.trim() || !/^\d{4}\/\d{4}$/.test(editBatchValue.trim())) {
      showModal("Format must be YYYY/YYYY", "error");
      return;
    }
    try {
      if (!auth.idToken || !editBatchId) return;
      await updateBatch(editBatchId, editBatchValue.trim(), auth.idToken);
      showModal("Batch updated!", "success");
      setEditModalVisible(false);
      loadBatches();
    } catch {
      showModal("Failed to update batch.", "error");
    }
  };

  // Delete batch handlers
  const openDeleteModal = (id: string) => {
    setDeleteBatchId(id);
    setDeleteModalVisible(true);
  };
  const handleDelete = async () => {
    try {
      if (!auth.idToken || !deleteBatchId) return;
      await deleteBatch(deleteBatchId, auth.idToken);
      showModal("Batch deleted!", "success");
      setDeleteModalVisible(false);
      loadBatches();
    } catch {
      showModal("Failed to delete batch.", "error");
    }
  };

  const TopShape = () => (
    <View style={styles.topShapeContainer}>
      <View style={styles.topShape} />
      <View style={styles.topBarContainer}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Add Batch</Text>
            <Text style={styles.pageSubtitle}>add batch details here</Text>
          </View>
          <Image
            source={require("../../assets/images/logobgr.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5faff" }}>
      <TopShape />
      <View style={styles.container}>
        <TextInput
          label="Batch (e.g. 2018/2019)"
          value={batch}
          onChangeText={setBatch}
          style={styles.input}
          mode="outlined"
          left={<TextInput.Icon icon="calendar" />}
          placeholder="2018/2019"
        />
        {errors.batch ? <Text style={styles.error}>{errors.batch}</Text> : null}

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.button}
          buttonColor="#1565c0"
          labelStyle={{ color: "#fff", fontWeight: "bold", fontSize: 17 }}
        >
          Save Batch
        </Button>

        {/* Batch List */}
        <Text style={styles.sectionTitle}>All Batches</Text>
        <FlatList
          data={batches}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.batchRow}>
              <Text style={styles.batchText}>{item.batch}</Text>
              <View style={styles.iconGroup}>
                <IconButton
                  icon="pencil"
                  size={22}
                  onPress={() => openEditModal(item.id, item.batch)}
                  style={styles.iconBtn}
                  accessibilityLabel="Edit batch"
                />
                <IconButton
                  icon="delete"
                  size={22}
                  onPress={() => openDeleteModal(item.id)}
                  style={styles.iconBtn}
                  accessibilityLabel="Delete batch"
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ color: "#888", textAlign: "center", marginTop: 20 }}>No batches found.</Text>
            ) : null
          }
          style={{ marginTop: 8 }}
          contentContainerStyle={{ paddingBottom: 80 }} // Added padding
        />
      </View>

      {/* Notification Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={modalType === "error" ? styles.error : styles.success}>{modalMsg}</Text>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={styles.sectionTitle}>Edit Batch</Text>
            <TextInput
              label="Batch (e.g. 2018/2019)"
              value={editBatchValue}
              onChangeText={setEditBatchValue}
              style={styles.input}
              mode="outlined"
              left={<TextInput.Icon icon="calendar" />}
              placeholder="2018/2019"
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
              <Button mode="outlined" onPress={() => setEditModalVisible(false)} style={{ flex: 1, marginRight: 8 }}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleEditSave} style={{ flex: 1, backgroundColor: "#1565c0" }}>
                Save
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}>Delete Batch</Text>
            <Text style={{ marginBottom: 20 }}>Are you sure you want to delete this batch?</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
              <Button mode="outlined" onPress={() => setDeleteModalVisible(false)} style={{ flex: 1, marginRight: 8 }}>
                Cancel
              </Button>
              <Button mode="contained" onPress={handleDelete} style={{ flex: 1, backgroundColor: "#e53935" }}>
                Delete
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNavBar navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topShapeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: 1,
  },
  topShape: {
    backgroundColor: "#1565c0",
    height: 150,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    opacity: 0.15,
  },
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  logo: {
    width: 100,
    height: 100,
    marginLeft: 10,
    marginTop: -10,
  },
  pageTitle: {
    fontWeight: "bold",
    fontSize: 24,
    color: "#1565c0",
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 15,
    color: "#444",
    marginBottom: 2,
    marginTop: 2,
  },
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 160,
    paddingBottom: 10,
    backgroundColor: "#f5faff",
  },
  input: {
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1565c0",
    marginBottom: 8,
    marginTop: 8,
  },
  batchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
    elevation: 1,
    justifyContent: "space-between",
  },
  batchText: {
    fontSize: 16,
    color: "#222",
    flex: 1,
  },
  iconGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  iconBtn: {
    marginHorizontal: 0,
  },
  error: {
    color: "red",
    marginBottom: 2,
    marginLeft: 4,
    textAlign: "left",
    fontSize: 14,
  },
  success: {
    color: "green",
    marginBottom: 8,
    textAlign: "center",
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 250,
    maxWidth: 340,
    marginHorizontal: 16,
    elevation: 5,
  },
});
