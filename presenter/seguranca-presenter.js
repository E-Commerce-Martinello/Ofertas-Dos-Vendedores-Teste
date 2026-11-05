// v1.6.15 — Backups privados e auditoria administrativa.
// Somente a conta principal pode acessar esta seção. Sem persistência local
// de dados pessoais, sem alterações nas regras do Firebase e sem auto-restauração.
const SegurancaPresenter = {
    _esc(valor) { return String(valor??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    _permitido() {
        if (!AdminPresenter?._autorizado || AdminPresenter?.ehPrincipal !== true) {
            UI.erro('Somente a conta principal pode criar backups e consultar a auditoria.');
            return false;
        }
        return true;
    },
    _status(texto,erro=false) {
        const el=document.getElementById('segurancaStatus');
        if(el){el.textContent=texto;el.className='vendor-status '+(erro?'error':'ok');}
    },
    exibir() {
        const a=document.getElementById('segurancaFerramentas');
        const b=document.getElementById('segurancaAviso');
        const principal=AdminPresenter?.ehPrincipal===true;
        if(a)a.hidden=!principal;
        if(b)b.hidden=principal;
    },
    async criarBackupPlanilha() {
        if(!this._permitido())return;
        if(!confirm('Criar agora uma cópia COMPLETA da planilha no Drive PRIVADO da conta principal? Isso usará espaço no Drive.'))return;
        const btn=document.getElementById('btnBackupPlanilha');
        if(btn)btn.disabled=true;
        this._status('Criando cópia privada da planilha no Google Drive…');
        try {
            const r=await GoogleSheetsService.criarBackupPlanilha();
            if(!r.nome || !r.url || !/^https:\/\/(?:drive\.google\.com\/|docs\.google\.com\/spreadsheets\/d\/)/.test(r.url))throw new Error('A API não confirmou o arquivo do backup.');
            const link=document.getElementById('segurancaBackupLink');
            if(link){link.href=r.url;link.textContent='ABRIR BACKUP: '+r.nome;link.hidden=false;}
            this._status('Backup criado no Drive do proprietário. Verifique as permissões do arquivo e mantenha-o privado.');
            await this.carregarAuditoria();
        } catch(e){this._status('Falha no backup: '+(e.message||e),true);}
        finally{if(btn)btn.disabled=false;}
    },
    async exportarFirebase() {
        if(!this._permitido())return;
        if(!confirm('Baixar um arquivo JSON das OFERTAS e da APARÊNCIA do Firebase de TESTE para este dispositivo? Armazene o arquivo em local privado.'))return;
        const btn=document.getElementById('btnBackupFirebase');
        if(btn)btn.disabled=true;
        this._status('Lendo ofertas e aparência diretamente do Firebase…');
        try {
            const [ofertas,aparencia]=await Promise.all([
                ofertasRef.once('value'),
                AparenciaPortal.referencia.once('value')
            ]);
            const documento={
                formato:'martinello-backup-firebase',versao:1,ambiente:'TESTE',
                criadoEm:new Date().toISOString(),
                nota:'Backup manual. Não contém dados do Sheets nem permissões administrativas. Não restaurar automaticamente.',
                dados:{ofertasMartinello_TESTE:ofertas.val(),aparenciaPortal_TESTE:aparencia.val()}
            };
            const blob=new Blob([JSON.stringify(documento)],{type:'application/json;charset=utf-8'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download='Martinello_Firebase_TESTE_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
            a.style.display='none';document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URL.revokeObjectURL(url),30000);
            this._status('Arquivo preparado para download. Confira se ele realmente foi salvo no dispositivo.');
        }catch(e){this._status('Falha ao exportar: '+(e.message||e),true);}
        finally{if(btn)btn.disabled=false;}
    },
    async carregarAuditoria() {
        if(!this._permitido())return;
        const btn=document.getElementById('btnAtualizarAuditoria');
        if(btn)btn.disabled=true;
        const tbody=document.getElementById('segurancaAuditoriaLinhas');
        if(tbody)tbody.innerHTML='<tr><td colspan="6">Buscando histórico…</td></tr>';
        try {
            const r=await GoogleSheetsService.listarAuditoria();
            const rows=Array.isArray(r.eventos)?r.eventos:[];
            if(tbody)tbody.innerHTML=rows.map(ev=>`<tr>
                <td>${this._esc(ev.data)}</td><td>${this._esc(ev.ator)}</td>
                <td>${this._esc(ev.acao)}</td><td>${this._esc(ev.alvo)}</td>
                <td>${this._esc(ev.resumo)}</td><td>${this._esc(ev.origem==='cliente_declarado'?'Declarado pelo navegador':'Confirmado na API')}</td></tr>`).join('')||'<tr><td colspan="6">Nenhuma alteração registrada desde a ativação da auditoria.</td></tr>';
            const info=document.getElementById('segurancaAuditoriaTotal');
            if(info)info.textContent=`Exibindo ${rows.length} de ${Number(r.total||0)} registros mais recentes.`;
        }catch(e){
            if(tbody)tbody.innerHTML='<tr><td colspan="6">Não foi possível consultar o histórico.</td></tr>';
            this._status('Auditoria indisponível: '+(e.message||e),true);
        }finally{if(btn)btn.disabled=false;}
    },
    async registrarFirebase(tipo,alvo,campos=[]) {
        // Evento declarativo: não constitui trilha imutável de transações no Firebase.
        try {await GoogleSheetsService.registrarAuditoriaFirebase(tipo,String(alvo||'').slice(0,100),campos);}
        catch(e){
            console.warn('Auditoria informativa do Firebase indisponível:',e.message);
            this._status('Alteração salva, mas a auditoria informativa não foi registrada.',true);
        }
    }
};
