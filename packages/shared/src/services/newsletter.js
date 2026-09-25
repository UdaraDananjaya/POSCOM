import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { COL } from '../constants.js';

export async function subscribeNewsletter(email) {
  await setDoc(doc(db, COL.NEWSLETTER_SUBSCRIBERS, email), { email, dateCreated: serverTimestamp() });
}
