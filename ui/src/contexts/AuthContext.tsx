import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes, signOut as amplifySignOut } from 'aws-amplify/auth';

type AuthContextType = {
  isAuthenticated: boolean;
  username: string;
  email: string;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: '',
  email: '',
  signOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const user = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        setIsAuthenticated(true);
        setUsername(user.username);
        setEmail(attributes.email || '');
      } catch (error) {
        setIsAuthenticated(false);
        console.log('Not authenticated');
      }
    };

    checkAuthStatus();
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('Signing out user:', username);
      await amplifySignOut();
      setIsAuthenticated(false);
      setUsername('');
      setEmail('');
    } catch (error) {
      console.error('Error signing out: ', error);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, email, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
