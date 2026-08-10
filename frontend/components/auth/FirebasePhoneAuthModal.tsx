import React from 'react';
import { View, Modal, StyleSheet, ActivityIndicator, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface FirebasePhoneAuthModalProps {
  visible: boolean;
  phoneNumber: string;
  onSuccess: (verificationId: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

const firebaseConfigJson = JSON.stringify({
  apiKey: "AIzaSyDs1LdPhLRYv7suAyBRgYFZFChhgZJiEhc",
  authDomain: "locals-6a592.firebaseapp.com",
  projectId: "locals-6a592",
  storageBucket: "locals-6a592.firebasestorage.app",
  messagingSenderId: "78798009324",
  appId: "1:78798009324:web:887177a8911a2d3775c6c9"
});

export const FirebasePhoneAuthModal: React.FC<FirebasePhoneAuthModalProps> = ({
  visible,
  phoneNumber,
  onSuccess,
  onError,
  onClose,
}) => {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${cleanPhone.slice(-10)}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #ffffff;
      padding: 20px;
      box-sizing: border-box;
    }
    .spinner {
      border: 4px solid rgba(0, 0, 0, 0.1);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border-left-color: #E23744;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .status {
      font-size: 15px;
      color: #374151;
      font-weight: 600;
      text-align: center;
    }
    #recaptcha-container {
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="status" id="status">Connecting Google Firebase SMS Gateway...</div>
  <div id="recaptcha-container"></div>

  <script>
    try {
      const firebaseConfig = ${firebaseConfigJson};
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible',
        'callback': function(response) {
          document.getElementById('status').innerText = 'reCAPTCHA verified. Sending SMS...';
        },
        'expired-callback': function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: 'reCAPTCHA expired. Please try again.' }));
        }
      });

      // Render reCAPTCHA widget first to prevent auth/internal-error
      window.recaptchaVerifier.render().then(function() {
        sendSms();
      }).catch(function(renderErr) {
        console.warn('reCAPTCHA render warning:', renderErr);
        sendSms();
      });

      function sendSms() {
        const phone = "${formattedPhone}";
        firebase.auth().signInWithPhoneNumber(phone, window.recaptchaVerifier)
          .then((confirmationResult) => {
            document.getElementById('status').innerText = 'SMS Sent Successfully!';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SUCCESS',
              verificationId: confirmationResult.verificationId
            }));
          })
          .catch((error) => {
            console.error('Firebase SMS error:', error);
            let userMsg = error.message || 'Firebase SMS send failed';
            if (error.code === 'auth/operation-not-allowed') {
              userMsg = 'Phone authentication is disabled in Firebase Console. Please enable Phone provider in Firebase Console.';
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              code: error.code,
              message: userMsg
            }));
          });
      }
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ERROR',
        message: err.message || 'Initialization error'
      }));
    }
  </script>
</body>
</html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Firebase SMS Verification</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent, baseUrl: 'https://locals-6a592.firebaseapp.com' }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'SUCCESS') {
                onSuccess(data.verificationId);
              } else if (data.type === 'ERROR') {
                onError(data.message);
              }
            } catch (e) {
              onError('Failed to process Firebase response');
            }
          }}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
});

export default FirebasePhoneAuthModal;
