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

const database = firebase.database();
// Mantém o teste em caminhos separados dentro do mesmo projeto Firebase.
// O site oficial continua usando os nós originais sem qualquer alteração.
const sufixoAmbiente = CONFIG.environment === 'TESTE' ? '_TESTE' : '';
const ofertasRef = database.ref('ofertasMartinello' + sufixoAmbiente);
