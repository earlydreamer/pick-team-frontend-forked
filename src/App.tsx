import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/features/user/auth/context/AuthContext';
import { WorkspaceProvider } from '@/features/workspace/core/context/WorkspaceContext';
import { RenewalProvider } from '@/features/renewal/context/RenewalContext';
import { ChatProvider } from '@/features/workspace/chat/context/ChatContext';
import Router from '@/Router';

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <RenewalProvider>
                <ChatProvider>
                  <Router />
                </ChatProvider>
              </RenewalProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </Provider>
  );
}

export default App;
