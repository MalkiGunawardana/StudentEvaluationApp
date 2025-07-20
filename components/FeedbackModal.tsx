import React from 'react';
import { Modal, StyleSheet, View } from 'react-native'; // Removed Card from here
import { Button, Card, Text } from 'react-native-paper'; // Added Button

export type ModalType = 'success' | 'error' | 'info'; // Added 'info'

interface FeedbackModalProps {
  visible: boolean;
  message: string;
  type: ModalType;
  onClose: () => void;
  title?: string; // Title is optional
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  message,
  type,
  onClose,
  title,
}) => {
  const getTitle = () => {
    if (title) return title;
    if (type === 'success') return 'Success!';
    if (type === 'error') return 'Error!';
    if (type === 'info') return 'Information';
    return ''; // Default empty title
  };
  
  const actualTitle = getTitle(); // Get the title string

  const getTitleStyle = () => {
    if (type === 'success') return styles.successTitle;
    if (type === 'error') return styles.errorTitle;
    if (type === 'info') return styles.infoTitle;
    return styles.defaultTitle; // Fallback style
  };

  const getMessageStyle = () => {
    if (type === 'success') return styles.successModalMessage;
    if (type === 'error') return styles.errorModalMessage;
    if (type === 'info') return styles.infoModalMessage;
    return styles.defaultModalMessage; // Fallback style
  };
  const actualMessage = typeof message === 'string' ? message.trim() : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Card style={styles.modalBox}>
          {typeof actualTitle === 'string' && actualTitle.trim() ? (
            <Card.Title title={actualTitle.trim()} titleStyle={[styles.baseTitleStyle, getTitleStyle()]} />
          ) : null}
          <Card.Content>
            {actualMessage ? (
              <Text style={[styles.baseMessageStyle, getMessageStyle()]}>{actualMessage}</Text>
            ) : null}
          </Card.Content>
          <Card.Actions style={styles.cardActions}>
            <Button 
              onPress={onClose} 
              mode="text"
              style={styles.closeButton}
              labelStyle={styles.closeButtonLabel}
            >Close</Button>
          </Card.Actions>
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    borderRadius: 10,
    // padding: 24, // Card component handles its own padding
    // alignItems: 'center', // Card.Title and Card.Content handle alignment
    // justifyContent: 'center',
    minWidth: 280, // Adjusted minWidth
    maxWidth: 340,
    marginHorizontal: 16,
    elevation: 5,
    backgroundColor: '#fff', // Ensure card has a background
  },
  baseTitleStyle: {
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    // marginBottom: 6, // Card.Title might have its own margin
  },
  errorTitle: { color: 'red' },
  successTitle: { color: 'green' },
  infoTitle: { color: '#1565c0' }, // Blue for info
  defaultTitle: { color: '#333' }, // Fallback

  baseMessageStyle: {
    fontSize: 16, // Slightly larger for better readability
    textAlign: 'center',
    // marginBottom: 4, // Card.Content might have its own margin
  },
  successModalMessage: { color: 'green' },
  errorModalMessage: { color: 'red' },
  infoModalMessage: { color: '#1565c0' }, // Blue for info
  defaultModalMessage: { color: '#333' }, // Fallback
  
  cardActions: {
    justifyContent: 'center', // Center the button
    paddingTop: 8,
    paddingBottom: 8, // Ensure button is not too close to edge
  },
  closeButton: {
    // Add any specific styling for the button itself if needed
  },
  closeButtonLabel: {
    // Style for the button text, e.g., color based on type
    // color: '#1565c0', // Example: always blue
  }
});