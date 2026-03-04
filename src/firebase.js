import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDDmi87GxpzBS5xDRC7qLQUN3hGptQQ70g",
    authDomain: "mundo-tereque.firebaseapp.com",
    projectId: "mundo-tereque",
    storageBucket: "mundo-tereque.firebasestorage.app",
    messagingSenderId: "498391783858",
    appId: "1:498391783858:web:791e21eac76dbeafee2cab",
    measurementId: "G-58HLHF8FTJ"
};

let app;
if (!firebase.apps.length) {
    try {
        app = firebase.initializeApp(firebaseConfig);
        firebase.firestore().enablePersistence().catch(err => console.log("Persistencia:", err.code));
    } catch (e) { console.error("Error Firebase", e); }
} else {
    app = firebase.app();
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const getBaseRef = () => db;
export default firebase;
