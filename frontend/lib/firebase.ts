import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCJHnFOejfvroJ983E3A1DlqG1mA13nPQY',
  authDomain: 'free-backed.firebaseapp.com',
  projectId: 'free-backed',
  storageBucket: 'free-backed.firebasestorage.app',
  messagingSenderId: '191619962728',
  appId: '1:191619962728:web:6aa39c38f5c87519a828dd',
  measurementId: 'G-0M1FB5YLEE',
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth: Auth = getAuth(app);
export default app;
