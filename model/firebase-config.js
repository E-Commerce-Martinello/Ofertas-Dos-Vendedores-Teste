// ============================================
// model/firebase-config.js
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyAO82H7GdseiIDD4VQVzVUk1pE25uCPJZM",
  authDomain: "ofertas-do-vendedor.firebaseapp.com",
  projectId: "ofertas-do-vendedor",
  storageBucket: "ofertas-do-vendedor.firebasestorage.app",
  messagingSenderId: "139304759090",
  appId: "1:139304759090:web:8dbc12dce295ff3c55312b"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const database   = firebase.database();
const ofertasRef = database.ref('ofertasMartinello');
