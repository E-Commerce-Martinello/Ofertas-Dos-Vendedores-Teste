// ============================================
// model/storage.js — CAMADA DE DADOS UNIFICADA
// ============================================

const Storage = {

    _salvando: false,

    // ---------- UTILITÁRIOS DE QUOTA ----------

    // Remove imagem base64 de uma oferta para cache leve
    _ofertaSemImagem(oferta) {
        if (!oferta) return oferta;
        const { urlImagem, ...resto } = oferta;
        // Manter urlImagem só se for uma URL real (não base64)
        const isBase64 = urlImagem && urlImagem.startsWith('data:');
        return isBase64 ? resto : oferta;
    },

    _salvarLocalSafe(chave, valor) {
        try {
            localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('⚠️ localStorage cheio — limpando dados pesados...');
                this._limparDadosPesados();
                try {
                    localStorage.setItem(chave, JSON.stringify(valor));
                    console.log('✅ Salvo após limpeza');
                    return true;
                } catch {
                    console.error('❌ localStorage ainda cheio após limpeza');
                    return false;
                }
            }
            return false;
        }
    },

    // Remove apenas as imagens base64 do localStorage (mantém o resto)
    _limparDadosPesados() {
        try {
            // Limpar imagens base64 das ofertas em cache
            const raw = localStorage.getItem('ofertasMartinello');
            if (raw) {
                const ofertas = JSON.parse(raw);
                const semImagens = ofertas.map(o => this._ofertaSemImagem(o));
                localStorage.setItem('ofertasMartinello', JSON.stringify(semImagens));
                console.log('🧹 Imagens base64 removidas do cache de ofertas');
            }

            // Limpar imagem da oferta ativa
            const rawAtiva = localStorage.getItem('ofertaAtiva');
            if (rawAtiva) {
                const ativa = JSON.parse(rawAtiva);
                localStorage.setItem('ofertaAtiva', JSON.stringify(this._ofertaSemImagem(ativa)));
            }

            // Limpar imagem da config em breve
            const rawCfg = localStorage.getItem('configTelaEmBreve');
            if (rawCfg) {
                const cfg = JSON.parse(rawCfg);
                if (cfg.imagem?.startsWith('data:')) {
                    cfg.imagem = 'img/produto.png';
                    localStorage.setItem('configTelaEmBreve', JSON.stringify(cfg));
                    console.log('🧹 Imagem base64 removida da config Em Breve');
                }
            }
        } catch (e) {
            console.error('Erro ao limpar dados pesados:', e);
        }
    },

    // ---------- INICIALIZAÇÃO ----------

    // Chamar na inicialização para garantir que o localStorage não está estourado
    verificarQuota() {
        try {
            // Teste rápido de escrita
            localStorage.setItem('_quota_test', '1');
            localStorage.removeItem('_quota_test');
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('⚠️ localStorage cheio na inicialização — limpando...');
                this._limparDadosPesados();
            }
        }
    },

    // ---------- OFERTAS ----------

    async carregarOfertas() {
        if (this._salvando) {
            console.log('⏳ Save em andamento — usando localStorage');
            const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
            this._atualizarAtiva(local);
            return local;
        }

        try {
            console.log('📡 Buscando ofertas no Firebase...');
            const snap  = await ofertasRef.once('value');
            const dados = snap.val();
            const arr   = Array.isArray(dados) ? dados
                        : dados && typeof dados === 'object' ? Object.values(dados)
                        : [];

            console.log(`✅ ${arr.length} oferta(s) carregada(s) do Firebase`);

            if (arr.length > 0 || dados !== null) {
                // Salvar SEM imagens base64 no localStorage (economiza quota)
                const semImagens = arr.map(o => this._ofertaSemImagem(o));
                this._salvarLocalSafe('ofertasMartinello', semImagens);
            }

            this._atualizarAtiva(arr); // usa array completo (com imagem) para a oferta ativa
            return arr;
        } catch (e) {
            console.warn('⚠️ Firebase indisponível — usando localStorage:', e.message);
            const local = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
            this._atualizarAtiva(local);
            return local;
        }
    },

    async salvarOfertas(ofertas) {
        console.log('💾 Salvando', ofertas.length, 'oferta(s)...');

        // Salvar SEM imagens base64 no localStorage
        const semImagens = ofertas.map(o => this._ofertaSemImagem(o));
        this._salvarLocalSafe('ofertasMartinello', semImagens);
        this._atualizarAtiva(ofertas);

        // Firebase recebe com imagem completa
        this._salvando = true;
        try {
            await ofertasRef.set(ofertas);
            this._salvando = false;
            console.log('☁️ Sincronizado com Firebase!');
            return true;
        } catch (e) {
            this._salvando = false;
            console.warn('⚠️ Firebase offline — salvo apenas localmente:', e.message);
            return false;
        }
    },

    _atualizarAtiva(ofertas) {
        const agora = getHorarioBrasilia();
        const ativa = ofertas.find(o => isOfertaAtiva(o, agora)) || null;
        if (ativa) {
            // Salvar oferta ativa SEM imagem base64 (a imagem vem do Firebase diretamente)
            this._salvarLocalSafe('ofertaAtiva', this._ofertaSemImagem(ativa));
            console.log('🟢 Oferta ativa:', ativa.tituloPagina);
        } else {
            localStorage.removeItem('ofertaAtiva');
            console.log('⏸️ Nenhuma oferta ativa no momento');
        }
        return ativa;
    },

    ofertaAtivaDoCache() {
        try {
            const raw = localStorage.getItem('ofertaAtiva');
            if (!raw) return null;
            const oferta = JSON.parse(raw);
            if (isOfertaAtiva(oferta, getHorarioBrasilia())) {
                console.log('⚡ Oferta carregada do cache:', oferta.tituloPagina);
                return oferta;
            }
            console.log('⌛ Oferta do cache expirou — removendo');
            localStorage.removeItem('ofertaAtiva');
            return null;
        } catch { return null; }
    },

    // ---------- CONFIG EM BREVE ----------

    carregarConfigEmBreve() {
        try { return JSON.parse(localStorage.getItem('configTelaEmBreve') || 'null'); }
        catch { return null; }
    },

    salvarConfigEmBreve(config) {
        // Não salvar imagem base64 no localStorage se for muito grande
        const cfgParaSalvar = { ...config };
        if (cfgParaSalvar.imagem?.startsWith('data:') && cfgParaSalvar.imagem.length > 100000) {
            console.warn('⚠️ Imagem da config Em Breve muito grande — não salva no cache local');
            cfgParaSalvar.imagem = 'img/produto.png';
        }
        this._salvarLocalSafe('configTelaEmBreve', cfgParaSalvar);
        console.log('💾 Config "Em Breve" salva');
    },

    // ---------- PREFERÊNCIAS ----------

    salvarTema(tema)            { localStorage.setItem('tema', tema); },
    carregarTema()              { return localStorage.getItem('tema') || 'light'; },
    salvarUltimaMatricula(cod)  { this._salvarLocalSafe('ultimaMatricula', cod); },
    carregarUltimaMatricula() { return (localStorage.getItem('ultimaMatricula') || '').replace(/\D/g, ''); },
};
