// ============================================
// firebase-config.js - CONFIGURAÇÃO DO FIREBASE
// ============================================

// Sua configuração do Firebase (colei aqui pra você!)
const firebaseConfig = {
  apiKey: "AIzaSyCxcM4BgmGk62qIC7KbM_7nrrjMKwS_TOc",
  authDomain: "ofertas-vendedores.firebaseapp.com",
  databaseURL: "https://ofertas-vendedores-default-rtdb.firebaseio.com",
  projectId: "ofertas-vendedores",
  storageBucket: "ofertas-vendedores.firebasestorage.app",
  messagingSenderId: "811095753027",
  appId: "1:811095753027:web:155270bef73de3e28b2ff6"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Conectar ao banco de dados
const database = firebase.database();

// Referência única para as ofertas (Certifique-se que este nome é o mesmo em todos os arquivos)
const ofertasRef = database.ref('ofertasMartinello');
