import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const app = getApps().length ? getApps()[0] : initializeApp();
export const db = getFirestore(app);
export const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
