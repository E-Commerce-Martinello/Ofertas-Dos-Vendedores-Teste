// ============================================
// ui.js - COMPONENTES DE INTERFACE
// ============================================

// Tema (Dark/Light mode)
const TEMA = {
    init() {
        const temaSalvo = localStorage.getItem('tema') || 'light';
        this.aplicar(temaSalvo);
    },
    
    aplicar(tema) {
        document.body.classList.toggle('dark-mode', tema === 'dark');
        localStorage.setItem('tema', tema);
        
        const icon = document.querySelector('.dark-mode-toggle i');
        if (icon) {
            icon.className = tema === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    },
    
    toggle() {
        const isDark = document.body.classList.contains('dark-mode');
        this.aplicar(isDark ? 'light' : 'dark');
    }
};

// Notificações
const NOTIFICACAO = {
    mostrar(mensagem, tipo = 'sucesso', duracao = 3000) {
        const div = document.createElement('div');
        div.className = `notificacao notificacao-${tipo}`;
        div.innerHTML = `
            <div class="notificacao-conteudo">
                <span class="notificacao-icone">${tipo === 'sucesso' ? '✅' : '❌'}</span>
                <span class="notificacao-texto">${mensagem}</span>
            </div>
        `;
        
        document.body.appendChild(div);
        
        setTimeout(() => {
            div.classList.add('notificacao-saindo');
            setTimeout(() => div.remove(), 300);
        }, duracao);
    },
    
    sucesso(msg) { this.mostrar(msg, 'sucesso'); },
    erro(msg) { this.mostrar(msg, 'erro'); }
};

// Loader/Spinner
const LOADER = {
    mostrar(elemento) {
        if (elemento) {
            elemento.disabled = true;
            elemento.dataset.textoOriginal = elemento.textContent;
            elemento.innerHTML = '<span class="spinner"></span>Processando...';
        }
    },
    
    esconder(elemento) {
        if (elemento) {
            elemento.disabled = false;
            elemento.textContent = elemento.dataset.textoOriginal || 'GERAR E ENVIAR';
        }
    }
};
