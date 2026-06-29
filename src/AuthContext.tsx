/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from './types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, name: string, password: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  googleAccessToken: string | null;
  connectGoogleCalendar: () => Promise<void>;
  isCalendarDemoMode: boolean;
  enableCalendarDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isCalendarDemoMode, setIsCalendarDemoMode] = useState<boolean>(false);

  const enableCalendarDemoMode = () => {
    setIsCalendarDemoMode(true);
    setGoogleAccessToken("mock_demo_token");
  };

  // Load user profile from Firestore
  const fetchProfile = async (uid: string) => {
    const path = `users/${uid}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setProfile(userDoc.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          await fetchProfile(currentUser.uid);
        } catch (err) {
          console.error("Error loading user profile during auth state transition:", err);
        }
      } else {
        setProfile(null);
        setGoogleAccessToken(null);
        setIsCalendarDemoMode(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Signup with email and password
  const signUp = async (email: string, name: string, password: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = credential.user;
      
      // Update display name in Firebase Auth
      await updateProfile(newUser, { displayName: name });

      // Save user profile to Firestore
      const userProfile: UserProfile = {
        uid: newUser.uid,
        name,
        email,
        createdAt: new Date().toISOString()
      };

      const path = `users/${newUser.uid}`;
      try {
        await setDoc(doc(db, 'users', newUser.uid), userProfile);
        setProfile(userProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }

    } catch (error) {
      throw error;
    }
  };

  // Login with email and password
  const logIn = async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await fetchProfile(credential.user.uid);
    } catch (error) {
      throw error;
    }
  };

  // Logout
  const logOut = async () => {
    try {
      await signOut(auth);
      setProfile(null);
      setUser(null);
      setIsCalendarDemoMode(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Google Sign-In with Demo Fallback for iframe/console restrictions
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }
      
      const googleUser = result.user;

      // Check if user profile already exists in Firestore
      const path = `users/${googleUser.uid}`;
      const userDoc = await getDoc(doc(db, 'users', googleUser.uid));

      let userProfile: UserProfile;
      if (!userDoc.exists()) {
        // Create new user profile in Firestore
        userProfile = {
          uid: googleUser.uid,
          name: googleUser.displayName || 'Google Operator',
          email: googleUser.email || '',
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'users', googleUser.uid), userProfile);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      } else {
        userProfile = userDoc.data() as UserProfile;
      }

      setProfile(userProfile);
    } catch (error: any) {
      console.warn("Standard Google Auth failed inside iframe/environment, falling back to Sandbox Google Operator Mode:", error);
      try {
        // Try to sign in or sign up with a high-fidelity Demo Google Operator email
        const email = "demo.google.user@example.com";
        const password = "DemoGooglePassword123!";
        let credential;
        try {
          credential = await signInWithEmailAndPassword(auth, email, password);
        } catch (loginErr) {
          credential = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(credential.user, { displayName: "Google Operator" });
        }
        
        const googleUser = credential.user;
        const userDoc = await getDoc(doc(db, 'users', googleUser.uid));
        let userProfile: UserProfile;
        if (!userDoc.exists()) {
          userProfile = {
            uid: googleUser.uid,
            name: 'Google Operator (Demo)',
            email: googleUser.email || '',
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', googleUser.uid), userProfile);
        } else {
          userProfile = userDoc.data() as UserProfile;
        }
        
        setProfile(userProfile);
        setGoogleAccessToken("mock_demo_token");
        setIsCalendarDemoMode(true);
      } catch (fallbackError) {
        console.error("Demo Fallback also failed:", fallbackError);
        throw error;
      }
    }
  };

  // Dedicated Connect Google Calendar (with Simulated Sandbox fallback)
  const connectGoogleCalendar = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      } else {
        throw new Error("No Google Access Token retrieved from calendar connection.");
      }
    } catch (error) {
      console.warn("Standard Connect Google Calendar failed inside iframe, activating Simulated Demo Calendar Mode:", error);
      setGoogleAccessToken("mock_demo_token");
      setIsCalendarDemoMode(true);
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    logIn,
    logOut,
    refreshProfile,
    signInWithGoogle,
    googleAccessToken,
    connectGoogleCalendar,
    isCalendarDemoMode,
    enableCalendarDemoMode
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
