import React from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface RazorpayWebViewProps {
  isVisible: boolean;
  onClose: () => void;
  onPaymentSuccess: (paymentId: string) => void;
  onPaymentError: (error: any) => void;
  orderAmount: number;
  orderId: string;
  userEmail: string;
  userName: string;
}

const RazorpayWebView: React.FC<RazorpayWebViewProps> = ({
  isVisible,
  onClose,
  onPaymentSuccess,
  onPaymentError,
  orderAmount,
  orderId,
  userEmail,
  userName,
}) => {
  const razorpayKeyId = 'rzp_test_yfFeMeVDWcZCcO'; // Your Razorpay test key ID

  const getPaymentHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </head>
      <body style="background-color: #1a1b1e; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
        <div style="text-align: center; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;">
          <p>Initializing payment...</p>
        </div>
        <script>
          const options = {
            key: '${razorpayKeyId}',
            amount: ${orderAmount * 100},
            currency: 'INR',
            name: 'OmniHealth',
            description: 'Premium Subscription',
            order_id: '${orderId}',
            prefill: {
              name: '${userName}',
              email: '${userEmail}',
            },
            config: {
              display: {
                blocks: {
                  utpi: {
                    name: 'Pay using UPI',
                    instruments: [
                      {
                        method: 'upi',
                        flows: ['intent', 'collect', 'qr'],
                        apps: ['google_pay', 'phonepe', 'paytm', 'bhim']
                      }
                    ]
                  },
                  qr: {
                    name: 'Pay via QR',
                    instruments: [
                      {
                        method: 'qr',
                        flows: ['qr']
                      }
                    ]
                  },
                  other: {
                    name: 'Other Payment Methods',
                    instruments: [
                      { method: 'card' },
                      { method: 'netbanking' },
                      { method: 'wallet' }
                    ]
                  }
                },
                sequence: ['block.utpi', 'block.qr', 'block.other'],
                preferences: {
                  show_default_blocks: true
                }
              }
            },
            theme: {
              color: '#4F46E5',
            },
            modal: {
              ondismiss: function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MODAL_CLOSED' }));
              }
            },
            handler: function(response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                data: response
              }));
            },
          };
          
          const rzp = new Razorpay(options);
          
          rzp.on('payment.failed', function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_ERROR',
              data: response.error
            }));
          });
          
          setTimeout(() => {
            rzp.open();
          }, 1000);
        </script>
      </body>
      </html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'PAYMENT_SUCCESS':
          onPaymentSuccess(data.data.razorpay_payment_id);
          onClose();
          break;
        
        case 'PAYMENT_ERROR':
          onPaymentError(data.data);
          onClose();
          break;
        
        case 'MODAL_CLOSED':
          onClose();
          break;
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
      onPaymentError(error);
      onClose();
    }
  };

  return (
    <Modal
      visible={isVisible}
      onRequestClose={onClose}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.container}>
        <WebView
          source={{ html: getPaymentHTML() }}
          onMessage={handleMessage}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b1e',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default RazorpayWebView;
