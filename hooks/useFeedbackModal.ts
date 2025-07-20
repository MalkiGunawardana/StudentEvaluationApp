import { useCallback, useState } from 'react';
import { ModalType } from '../components/FeedbackModal';

export interface ShowModalOptions {
  autoClose?: boolean;
  autoCloseDelay?: number;
  onCloseCallback?: () => void;
}

export const useFeedbackModal = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMsg, setModalMsg] = useState('');
  const [modalType, setModalType] = useState<ModalType>('success');
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);

  const showModal = useCallback(
    (
      msg: string,
      type: ModalType = 'success',
      title?: string,
      options: ShowModalOptions = {}
    ) => {
      const { autoClose = true, autoCloseDelay = 2500, onCloseCallback } = options;
      setModalMsg(msg);
      setModalType(type);
      setModalTitle(title);
      setModalVisible(true);

      if (autoClose && type === 'success') { // Only auto-close success modals by default
        setTimeout(() => {
          setModalVisible(false);
          if (onCloseCallback) {
            onCloseCallback();
          }
        }, autoCloseDelay);
      }
    },
    []
  );

  const hideModal = useCallback(() => setModalVisible(false), []);

  return { modalVisible, modalMsg, modalType, modalTitle, showModal, hideModal };
};