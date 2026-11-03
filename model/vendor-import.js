// ============================================
// model/vendor-import.js
// Importação local de relatórios XLS/XLSX/ODS. Apenas campos mínimos são enviados.
// SheetJS é carregado localmente no navegador via script oficial do projeto.
// ============================================
const VendorImportPresenter = {
    arquivo: null,
    registros: [],
    resumo: null,
    processando: false,
    conflitos: [],
    registrosSemConflito: [],

    _texto(v) { return String(v == null ? '' : v).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); },
    _digitos(v) { return this._texto(v).replace(/\D/g, ''); },
    _normalizar(v) {
        return this._texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    },
    _escapar(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },

    aoSelecionarArquivo(input) {
        this.arquivo = input && input.files && input.files[0] ? input.files[0] : null;
        this.registros = [];
        this.resumo = null;
        this.conflitos = [];
        this.registrosSemConflito = [];
        const status = document.getElementById('arquivoRelatorioSelecionado');
        const botao = document.getElementById('btnAnalisarRelatorio');
        const previa = document.getElementById('painelPreviaImportacao');
        if (previa) { previa.style.display = 'none'; previa.innerHTML = ''; }
        if (status) status.innerHTML = this.arquivo
            ? `<i class="fas fa-file-excel"></i><span>${this._escapar(this.arquivo.name)} — ${(this.arquivo.size / 1024).toFixed(1)} KB</span>`
            : '<i class="fas fa-info-circle"></i><span>Nenhum arquivo selecionado.</span>';
        if (botao) botao.disabled = !this.arquivo;
    },

    _encontrarColuna(cabecalhos, tipo) {
        const listas = {
            matricula: ['matricula','rubi','codigocolaborador','codigofuncionario','codfuncionario','matriculafuncionario','numeromatricula','rubifuncionario'],
            nome: ['nome','nomecompleto','nomedocolaborador','nomedofuncionario','nomedovendedor','nomecolaborador','colaborador','funcionario'],
            filial: ['filial','nomefilial','descricaofilial','descricaodafilial','filialdescricao','filialloja','loja','nomeloja','unidade','estabelecimento','localdetrabalho','unidadedetrabalho','lotacao'],
            situacao: ['situacao','status','situacaofuncional','statusfuncional','situacaodocolaborador','statusdocolaborador']
        };
        const aliases = listas[tipo].map(x => this._normalizar(x));
        return cabecalhos.findIndex(h => {
            const n = this._normalizar(h);
            return aliases.some(a => n === a || (a.length >= 7 && n.includes(a)));
        });
    },

    _lerCabecalho(rows) {
        const limite = Math.min(rows.length, 35);
        for (let i = 0; i < limite; i++) {
            const row = rows[i] || [];
            const h = row.map(v => this._texto(v));
            const matricula = this._encontrarColuna(h, 'matricula');
            const nome = this._encontrarColuna(h, 'nome');
            if (matricula >= 0 && nome >= 0) {
                return {
                    linha: i,
                    matricula,
                    nome,
                    filial: this._encontrarColuna(h, 'filial'),
                    situacao: this._encontrarColuna(h, 'situacao')
                };
            }
        }
        return null;
    },

    _filialDoCabecalho(valor) {
        const t = this._texto(valor);
        if (!t) return '';
        // Ex.: "1.0001, MARTINELLO, F0001 LUCAS DO RIO VERDE"
        const m = t.match(/\bF\s*0*(\d{3,6})\s+(.+)$/i);
        if (m) return this._texto(m[2]).replace(/^[,;:\-\s]+/, '').replace(/[;,\s]+$/, '');
        return '';
    },

    _situacaoAtiva(valor) {
        const s = this._normalizar(valor);
        if (!s) return { ativo: true, situacaoFuncional: 'OK' };
        if (/(inativo|desligado|demitido|rescindido|afastado|naoativo)/.test(s)) return { ativo: false, situacaoFuncional: this._texto(valor) };
        if (/(ativo|apto|ok|trabalhando)/.test(s)) return { ativo: true, situacaoFuncional: this._texto(valor) };
        return { ativo: true, situacaoFuncional: this._texto(valor) };
    },

    _parseSheet(rows, sheetName) {
        const result = [];
        let filialAtual = '';
        const cab = this._lerCabecalho(rows);
        if (cab) {
            // Alguns relatórios colocam o nome da filial antes do cabeçalho da tabela.
            for (let i = 0; i < cab.linha; i++) {
                const secao = (rows[i] || []).map(c => this._filialDoCabecalho(c)).find(Boolean);
                if (secao) filialAtual = secao;
            }
            for (let i = cab.linha + 1; i < rows.length; i++) {
                const row = rows[i] || [];
                const filialCab = row.map(c => this._filialDoCabecalho(c)).find(Boolean);
                if (filialCab) filialAtual = filialCab;
                const matricula = this._digitos(row[cab.matricula]);
                const nome = this._texto(row[cab.nome]);
                if (!matricula || !nome) continue;
                const filialDaColuna = cab.filial >= 0 ? this._texto(row[cab.filial]) : '';
                const filial = filialDaColuna || filialAtual;
                if (!filial) continue;
                const situacao = cab.situacao >= 0 ? this._situacaoAtiva(row[cab.situacao]) : {ativo:true, situacaoFuncional:'OK'};
                result.push({ matricula, nome, filial, ativo:situacao.ativo, situacaoFuncional:situacao.situacaoFuncional, origemPlanilha:sheetName, linhaRelatorio:i+1 });
            }
            return result;
        }

        // Layout formatado por blocos: linha de filial seguida de matrícula e nome.
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i] || [];
            const a = this._texto(row[0]);
            const filialCab = this._filialDoCabecalho(a);
            if (filialCab) { filialAtual = filialCab; continue; }
            const matricula = this._digitos(a);
            const nome = this._texto(row[1]);
            if (!filialAtual || !matricula || !/^\d{1,12}$/.test(matricula) || !nome) continue;
            result.push({ matricula, nome, filial:filialAtual, ativo:true, situacaoFuncional:'OK', origemPlanilha:sheetName, linhaRelatorio:i+1 });
        }
        return result;
    },

    _extrairRegistros(workbook) {
        const encontrados = [];
        workbook.SheetNames.forEach(nome => {
            const sheet = workbook.Sheets[nome];
            const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:'', raw:false, blankrows:false });
            encontrados.push(...this._parseSheet(rows, nome));
        });
        // Preserva TODAS as ocorrências conflitantes, mostrando as linhas de origem.
        // Nunca escolhe um vendedor automaticamente: o operador revisa e decide.
        const grupos = new Map();
        encontrados.forEach(r => {
            if (!grupos.has(r.matricula)) grupos.set(r.matricula, []);
            grupos.get(r.matricula).push(r);
        });
        const registros = [], conflitos = [];
        grupos.forEach((ocorrencias, matricula) => {
            const assinaturas = new Set(ocorrencias.map(r => `${this._normalizar(r.nome)}|${this._normalizar(r.filial)}`));
            if (assinaturas.size === 1) registros.push(ocorrencias[0]);
            else conflitos.push({ matricula, ocorrencias });
        });
        return { registros, conflitos };
    },

    async analisar() {
        if (this.processando) return;
        if (!this.arquivo) { UI.erro('Escolha o relatório antes de analisar.'); return; }
        if (!window.XLSX || typeof XLSX.read !== 'function') { UI.erro('O leitor de planilhas não carregou. Atualize a página e tente novamente.'); return; }
        if (!VendedoresPresenter.registros.length) { UI.erro('Conecte e carregue a base de vendedores antes de importar.'); return; }
        this.processando = true;
        const botao = document.getElementById('btnAnalisarRelatorio');
        if (botao) { botao.disabled = true; botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ANALISANDO...'; }
        try {
            const bytes = await this.arquivo.arrayBuffer();
            const workbook = XLSX.read(bytes, { type:'array', codepage:1252, cellDates:true, cellText:true, cellFormula:false, cellHTML:false });
            const resultado = this._extrairRegistros(workbook);
            this.registrosSemConflito = resultado.registros;
            this.conflitos = resultado.conflitos;
            if (!resultado.registros.length && !resultado.conflitos.length) throw new Error('Não encontrei uma tabela reconhecível. O relatório precisa ter colunas de matrícula, nome e filial, ou estar organizado em blocos por filial como o arquivo formatado.');
            if (this.conflitos.length) {
                this.registros = [];
                this.resumo = null;
                this._renderizarConflitos();
                return;
            }
            this._calcularResumo(resultado.registros);
        } catch (erro) {
            console.error('Falha ao analisar relatório:', erro);
            UI.erro(erro.message || 'Não foi possível ler o relatório.');
        } finally {
            this.processando = false;
            if (botao) { botao.disabled = !this.arquivo; botao.innerHTML = '<i class="fas fa-search"></i> ANALISAR RELATÓRIO'; }
        }
    },

    _calcularResumo(registros) {
            const atual = new Map(VendedoresPresenter.registros.map(v => [VendedoresPresenter._matricula(v.matricula), v]));
            let novos = 0, alterados = 0, iguais = 0, ausentes = 0, desativadosNoArquivo = 0;
            const detalhes = [];
            const importadas = new Set(registros.map(r => r.matricula));
            registros.forEach(r => {
                const existente = atual.get(r.matricula);
                if (!existente) { novos++; detalhes.push({tipo:'NOVO',...r}); return; }
                const mudou = this._normalizar(existente.nome) !== this._normalizar(r.nome) || this._normalizar(existente.filial) !== this._normalizar(r.filial);
                if (mudou) { alterados++; detalhes.push({tipo:'ATUALIZAR',...r}); } else iguais++;
                if (!r.ativo) desativadosNoArquivo++;
            });
            VendedoresPresenter.registros.forEach(v => {
                if (!importadas.has(VendedoresPresenter._matricula(v.matricula)) && v.ativo) {
                    ausentes++;
                    if (detalhes.length < 100) detalhes.push({tipo:'AUSENTE', matricula:v.matricula, nome:v.nome, filial:v.filial});
                }
            });
            this.registros = registros;
            this.resumo = { total:registros.length, novos, alterados, iguais, ausentes, desativadosNoArquivo, detalhes, arquivo:this.arquivo.name };
            this._renderizarPrevia();
    },

    _renderizarConflitos() {
        const painel = document.getElementById('painelPreviaImportacao');
        if (!painel) return;
        painel.style.display = 'block';
        const itens = this.conflitos.map((grupo, i) => `
          <div class="vendor-import-warning" style="margin:12px 0;padding:14px;border-left:4px solid #d97706;">
            <strong>Matrícula ${this._escapar(grupo.matricula)}</strong>
            <p class="vendor-subtext">Foram encontradas ${grupo.ocorrencias.length} linhas com informações diferentes. Se forem cabeçalhos interpretados como cadastro, escolha Ignorar. Caso sejam registros válidos, escolha o correto.</p>
            ${grupo.ocorrencias.map((r, j) => `<label style="display:block;margin:9px 0;cursor:pointer;overflow-wrap:anywhere;">
              <input type="radio" name="decisaoConflito${i}" value="${j}">
              <strong>${this._escapar(r.nome)}</strong> — ${this._escapar(r.filial)}
              <small>(aba ${this._escapar(r.origemPlanilha)}, linha ${Number(r.linhaRelatorio)||'?'} )</small>
            </label>`).join('')}
            <label style="display:block;margin:9px 0;cursor:pointer;"><input type="radio" name="decisaoConflito${i}" value="ignorar"> Ignorar todas as ocorrências desta matrícula neste relatório</label>
          </div>`).join('');
        painel.innerHTML = `
          <h3 style="margin:10px 0;">REVISAR REGISTROS DO RELATÓRIO</h3>
          <p class="vendor-subtext">Identificamos ${this.conflitos.length} matrícula(s) com dados diferentes no arquivo <strong>${this._escapar(this.arquivo?.name||'')}</strong>. A matrícula apresentada é o número do registro — não a quantidade de erros. <strong>Nada foi alterado na planilha.</strong></p>
          ${itens}
          <div class="vendor-actions" style="margin-top:14px;">
            <button type="button" class="btn-primary" onclick="VendorImportPresenter.confirmarConflitos()"><i class="fas fa-check"></i> CONFIRMAR E VER PRÉVIA</button>
            <button type="button" class="btn-outline" onclick="VendorImportPresenter.cancelar()">CANCELAR</button>
          </div>`;
    },

    confirmarConflitos() {
        if (!this.conflitos.length) return;
        const registros = [...this.registrosSemConflito];
        for (let i = 0; i < this.conflitos.length; i++) {
            const marcado = document.querySelector(`input[name="decisaoConflito${i}"]:checked`);
            if (!marcado) { UI.erro(`Escolha uma opção para a matrícula ${this.conflitos[i].matricula}.`); return; }
            if (marcado.value !== 'ignorar') {
                const selecionado = this.conflitos[i].ocorrencias[Number(marcado.value)];
                if (!selecionado) { UI.erro('Seleção inválida. Analise novamente o relatório.'); return; }
                registros.push(selecionado);
            }
        }
        this.conflitos = [];
        this._calcularResumo(registros);
    },

    _renderizarPrevia() {
        const painel = document.getElementById('painelPreviaImportacao');
        if (!painel || !this.resumo) return;
        const r = this.resumo;
        const exemplos = r.detalhes.slice(0, 12);
        painel.style.display = 'block';
        painel.innerHTML = `
            <h3 style="margin:10px 0;">PRÉVIA DA IMPORTAÇÃO</h3>
            <p class="vendor-subtext">Arquivo: <strong>${this._escapar(r.arquivo)}</strong>. Foram encontrados ${r.total.toLocaleString('pt-BR')} registros válidos. Nenhuma alteração foi gravada ainda.</p>
            <div class="vendor-import-summary">
                <div class="vendor-import-kpi"><strong>${r.total.toLocaleString('pt-BR')}</strong><span>No relatório</span></div>
                <div class="vendor-import-kpi"><strong>${r.novos.toLocaleString('pt-BR')}</strong><span>Novos</span></div>
                <div class="vendor-import-kpi"><strong>${r.alterados.toLocaleString('pt-BR')}</strong><span>Nome/filial alterados</span></div>
                <div class="vendor-import-kpi"><strong>${r.ausentes.toLocaleString('pt-BR')}</strong><span>Atuais ausentes</span></div>
            </div>
            <p class="vendor-subtext">Sem alteração: ${r.iguais.toLocaleString('pt-BR')} · Marcados inativos no relatório: ${r.desativadosNoArquivo.toLocaleString('pt-BR')}</p>
            <div class="vendor-import-warning">A importação atualiza matrícula, nome, filial e situação funcional. Telefones, validações, observações e histórico serão preservados. Cadastros ausentes só serão desativados se você marcar a opção; cadastros manuais ficam preservados.</div>
            <label class="vendor-checkbox"><input type="checkbox" id="marcarAusentesInativosImportacao"> Marcar como INATIVO quem está na base atual, mas não aparece neste relatório</label>
            ${exemplos.length ? `<div class="vendor-import-preview-scroll"><table class="vendor-import-table"><thead><tr><th>Tipo</th><th>Matrícula</th><th>Nome</th><th>Filial</th></tr></thead><tbody>${exemplos.map(x=>`<tr><td>${this._escapar(x.tipo)}</td><td>${this._escapar(x.matricula)}</td><td>${this._escapar(x.nome)}</td><td>${this._escapar(x.filial||'')}</td></tr>`).join('')}</tbody></table></div>` : ''}
            <div class="vendor-actions" style="margin-top:14px;">
                <button type="button" class="btn-primary" id="btnAplicarImportacao" onclick="VendorImportPresenter.aplicar()"><i class="fas fa-check"></i> APLICAR IMPORTAÇÃO</button>
                <button type="button" class="btn-outline" onclick="VendorImportPresenter.cancelar()">CANCELAR</button>
            </div>`;
    },

    async aplicar() {
        if (this.processando || !this.registros.length || !this.resumo) return;
        const ausentes = !!document.getElementById('marcarAusentesInativosImportacao')?.checked;
        const r = this.resumo;
        const confirmacao = `Aplicar relatório com ${r.total} registros?\n\nNovos: ${r.novos}\nAtualizar: ${r.alterados}\nSem alteração: ${r.iguais}\nAusentes: ${r.ausentes}${ausentes ? `\n\nOs ${r.ausentes} cadastros ausentes serão marcados como INATIVOS.` : '\n\nOs cadastros ausentes serão mantidos como estão.'}\n\nTelefones e validações serão preservados.`;
        if (!window.confirm(confirmacao)) return;
        const botao = document.getElementById('btnAplicarImportacao');
        this.processando = true;
        if (botao) { botao.disabled = true; botao.textContent = 'APLICANDO...'; }
        try {
            const cfg = VendedoresPresenter._validarConfiguracao();
            const resposta = await GoogleSheetsService.importarFuncionarios(this.registros, ausentes, this.arquivo?.name || 'Relatorio');
            const dados = resposta.resultado || {};
            UI.ok(`Importação concluída: ${dados.novos || 0} novos, ${dados.atualizados || 0} atualizados e ${dados.inativados || 0} inativados.`);
            this.cancelar();
            await VendedoresPresenter._carregar(cfg.url, cfg.token);
        } catch (erro) {
            console.error('Falha ao aplicar importação:', erro);
            UI.erro(erro.message || 'Não foi possível aplicar a importação.');
            if (botao) { botao.disabled = false; botao.innerHTML = '<i class="fas fa-check"></i> APLICAR IMPORTAÇÃO'; }
        } finally {
            this.processando = false;
        }
    },

    cancelar() {
        this.arquivo = null;
        this.registros = [];
        this.resumo = null;
        this.conflitos = [];
        this.registrosSemConflito = [];
        const input = document.getElementById('arquivoRelatorioFuncionarios');
        if (input) input.value = '';
        const status = document.getElementById('arquivoRelatorioSelecionado');
        if (status) status.innerHTML = '<i class="fas fa-info-circle"></i><span>Nenhum arquivo selecionado.</span>';
        const botao = document.getElementById('btnAnalisarRelatorio');
        if (botao) botao.disabled = true;
        const painel = document.getElementById('painelPreviaImportacao');
        if (painel) { painel.style.display = 'none'; painel.innerHTML = ''; }
    }
};
