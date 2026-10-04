import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import { getDatabase } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5M6aaF7AzSa0x03YNFhWrhhZUjSNPTAs",

  authDomain: "spotify-2-fbc02.firebaseapp.com",

  databaseURL: "https://spotify-2-fbc02-default-rtdb.firebaseio.com",

  projectId: "spotify-2-fbc02",

  storageBucket: "spotify-2-fbc02.firebasestorage.app",

  messagingSenderId: "851009413327",

  appId: "1:851009413327:web:35dfc90edd6d648280d7ba",

  measurementId: "G-XFMZVTN2MD",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getDatabase(app);