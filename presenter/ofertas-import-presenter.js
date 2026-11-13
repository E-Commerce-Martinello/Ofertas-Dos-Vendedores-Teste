// v1.6.18.1 — CSV UTF-8 sem conversão indevida; planilhas Excel continuam com SheetJS.
// Importação nunca altera uma oferta publicada ou um rascunho já existente.
const OfertasImportPresenter = {
    linhas:[],headers:[],mapeamento:{},previa:[],preparando:false,importando:false,
    campos:{sku:['sku','codigo','codigo_produto','id_produto','referencia'],
        titulo:['titulo','titulo_oferta','produto','nome','nome_produto','descricao_produto'],
        url:['url','link','url_produto','link_produto','pagina_produto'],
        texto:['texto','texto_oferta','mensagem','copy','descricao_oferta'],
        campanha:['campanha','campanha_oferta'],
        inicio:['inicio','data_inicio','inicio_oferta'],fim:['fim','data_fim','fim_oferta']},
    normalizar(x){return String(x??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');},
    _setStatus(s,erro=false){const el=document.getElementById('importOfertasStatus');if(el){el.textContent=s;el.style.color=erro?'var(--cor-importacao-erro,#b9232c)':'';}},
    // CSV do Google Sheets: respeita UTF-8, quebra de linha dentro de células e aspas duplas.
    _csv(texto){
        const s=String(texto).replace(/^\uFEFF/,'');
        const primeiraLinha=s.split(/\r?\n/)[0];
        const delim=(primeiraLinha.match(/;/g)||[]).length>(primeiraLinha.match(/,/g)||[]).length?';':',';
        let aspas=false,celula='',linha=[],matriz=[];
        const fechar=()=>{linha.push(celula);matriz.push(linha);linha=[];celula='';};
        for(let i=0;i<s.length;i++){
            const c=s[i];
            if(c==='"'){
                if(aspas && s[i+1]==='"'){celula+='"';i++;}
                else if(aspas || !celula)aspas=!aspas;
                else celula+=c;
            }else if(!aspas && c===delim){linha.push(celula);celula='';}
            else if(!aspas && (c==='\r'||c==='\n')){
                if(c==='\r'&&s[i+1]==='\n')i++;
                fechar();
            }else celula+=c;
        }
        if(aspas)throw Error('CSV inválido: há uma célula com aspas não fechadas.');
        if(celula || linha.length)fechar();
        return matriz.filter(r=>r.some(c=>String(c).trim()));
    },
    _data(v,final=false){
        const t=String(v||'').trim();if(!t)return '';
        let ano,mes,dia,hora=final?'23':'00',minuto=final?'59':'00';
        let m=t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
        if(m){[,ano,mes,dia]=m;hora=m[4]||hora;minuto=m[5]||minuto;}
        else{m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/);
            if(!m)return null;
            [,dia,mes,ano]=m;dia=dia.padStart(2,'0');mes=mes.padStart(2,'0');
            hora=m[4]||hora;minuto=m[5]||minuto;
        }
        const val=new Date(Date.UTC(Number(ano),Number(mes)-1,Number(dia)));
        if(val.getUTCFullYear()!==Number(ano)||val.getUTCMonth()+1!==Number(mes)||val.getUTCDate()!==Number(dia)
            ||Number(hora)>23||Number(minuto)>59)return null;
        return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    },
    async analisar(){
        if(this.preparando)return;
        const file=document.getElementById('importOfertasArquivo')?.files?.[0];
        if(!file){this._setStatus('Escolha um Excel ou CSV.',true);return;}
        if(!/\.(csv|xlsx)$/i.test(file.name)){this._setStatus('Formato permitido: .csv ou .xlsx.',true);return;}
        if(file.size>10*1024*1024){this._setStatus('Limite de 10 MB.',true);return;}
        this.preparando=true;this._setStatus('Lendo arquivo...');
        try{
            const buffer=await file.arrayBuffer();let matriz=[];
            if(/\.csv$/i.test(file.name)){
                let texto;
                try{texto=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
                catch(_){throw Error('CSV não está em UTF-8. No Google Sheets, use Arquivo → Fazer download → Valores separados por vírgulas (.csv), ou baixe em Excel (.xlsx).');}
                matriz=this._csv(texto);
            }else{
                await PlanilhaLoader.garantir();
                const book=XLSX.read(buffer,{type:'array',cellDates:false,raw:false});
                if(!book.SheetNames.length)throw Error('Arquivo sem abas.');
                matriz=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false,blankrows:false});
            }
            if(matriz.length<2)throw Error('Não há produtos na planilha.');
            if(matriz.length>501)throw Error('Limite de 500 linhas por análise. Divida a importação.');
            this.headers=matriz[0].map(String).map(s=>s.trim()).slice(0,60);
            if(this.headers.length<2)throw Error('É necessário ao menos um cabeçalho de título e URL.');
            this.linhas=matriz.slice(1).filter(r=>r.some(x=>String(x??'').trim())).slice(0,500);
            const norm=this.headers.map(x=>this.normalizar(x));
            this.mapeamento={};
            for(const [campo,aliases]of Object.entries(this.campos)){
                const i=norm.findIndex(h=>aliases.includes(h));this.mapeamento[campo]=i>=0?String(i):'';
            }
            for(const campo of Object.keys(this.campos)){
                const sel=document.getElementById('importMap'+campo);
                if(!sel)continue;
                sel.replaceChildren(new Option('Não importar',''));
                this.headers.forEach((x,i)=>sel.add(new Option(x||`Coluna ${i+1}`,String(i))));
                sel.value=this.mapeamento[campo];
            }
            document.getElementById('importOfertasMapeamento').hidden=false;
            this.prever();
        }catch(e){this.linhas=[];this._setStatus(e.message||'Falha ao ler planilha.',true);}
        finally{this.preparando=false;}
    },
    _ler(linha,campo){const valor=document.getElementById('importMap'+campo)?.value;
        return valor!=='' && valor!=null ? String(linha[Number(valor)]??'').trim():'';},
    _produto(linha,i){
        const raw=this._ler(linha,'url');let url='';
        try{const u=new URL(raw);if(u.protocol==='https:'&&['www.martinello.com.br','martinello.com.br'].includes(u.hostname))url=u.origin+u.pathname;}catch(_){}
        const sku=(this._ler(linha,'sku')||(url.match(/-(\d{3,12})\/?$/)||[])[1]||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);
        const titulo=this._ler(linha,'titulo').slice(0,160);
        const texto=this._ler(linha,'texto').slice(0,3000);
        const campanha=this._ler(linha,'campanha').toLowerCase();
        const inicioRaw=this._ler(linha,'inicio'),fimRaw=this._ler(linha,'fim');
        const inicio=this._data(inicioRaw),fim=this._data(fimRaw,true);
        const erros=[];
        if(!titulo)erros.push('Título ausente');
        if(!url)erros.push('Link Martinello inválido');
        if(texto.includes('\uFFFD'))erros.push('Texto contém caractere inválido (�)');
        if(campanha && !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(campanha))erros.push('Campanha inválida');
        if(inicio===null || fim===null)erros.push('Datas: informe dia, mês e ANO (ex.: 16/11/2026)');
        if(inicio && fim && inicio>fim)erros.push('Data final anterior à inicial');
        const criadas=[...(AdminPresenter.ofertas||[]),...(AdminPresenter.rascunhos||[])];
        const existente=criadas.some(o=>(sku&&String(o.sku||'')===sku)||(url && o.linkProduto===url));
        return {index:i+2,sku,titulo,url,texto,campanha,inicio:inicio||'',fim:fim||'',erros,existente,avisos:[]};
    },
    prever(){
        if(!this.linhas.length)return;
        const m=this.linhas.map((r,i)=>this._produto(r,i));this.previa=m;
        const vistosSku=new Set(),vistosUrl=new Set(),textos=new Map();
        for(const x of m){
            if((x.sku&&vistosSku.has(x.sku))||(x.url&&vistosUrl.has(x.url)))x.erros.push('Duplicado neste arquivo');
            if(x.sku)vistosSku.add(x.sku);if(x.url)vistosUrl.add(x.url);
            const texto=x.texto.replace(/\s+/g,' ').trim();
            if(texto){if(!textos.has(texto))textos.set(texto,[]);textos.get(texto).push(x);}
        }
        for(const grupo of textos.values()){
            if(grupo.length>1 && new Set(grupo.map(x=>x.sku||x.url)).size>1)
                grupo.forEach(x=>x.avisos.push('Mesmo texto utilizado em produtos diferentes — confira antes de publicar'));
        }
        const validos=m.filter(x=>!x.erros.length&&!x.existente);
        const existentes=m.filter(x=>x.existente).length;
        const erros=m.filter(x=>!x.existente&&x.erros.length).length;
        const alertas=m.filter(x=>x.avisos.length).length;
        this._setStatus(`${m.length} analisados · ${validos.length} novos para rascunho · ${existentes} já cadastrados · ${erros} com dados inválidos${alertas?' · '+alertas+' com alerta de texto repetido':''}.`);
        const corpo=document.getElementById('importOfertasPrevia');
        const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        corpo.innerHTML=m.slice(0,30).map(x=>{
            const tipo=x.existente?'existente':x.erros.length?'erro':'ok';
            const estado=x.existente?'Já cadastrado — preservado':x.erros.join(' · ')||'Pronto para rascunho';
            const resumo=x.texto.replace(/\s+/g,' ').slice(0,100) || 'Texto vazio';
            return `<tr><td>${x.index}</td><td>${esc(x.sku||'—')}</td><td>${esc(x.titulo)}</td>
              <td>${esc(resumo)}${x.avisos.length?'<small>⚠ '+esc(x.avisos.join(' · '))+'</small>':''}</td>
              <td><span class="import-situacao ${tipo}">${esc(estado)}</span></td></tr>`;
        }).join('');
        document.getElementById('importOfertasPreviaCard').hidden=false;
        document.getElementById('importOfertasConfirmar').disabled=!validos.length;
    },
    async importar(){
        if(this.importando)return;this.prever();
        const aprovadas=(this.previa||[]).filter(x=>!x.erros.length&&!x.existente);
        if(!aprovadas.length){this._setStatus('Nenhuma oferta nova válida para importar. Cadastros existentes não são substituídos.',true);return;}
        if(!confirm(`Importar ${aprovadas.length} oferta(s) como RASCUNHO? Nenhuma será publicada automaticamente.`))return;
        this.importando=true;let ok=0,falhas=0;
        const btn=document.getElementById('importOfertasConfirmar');btn.disabled=true;
        const vistosSku=new Set(),vistosUrl=new Set();
        try{
            for(const item of aprovadas){
                if((item.sku&&vistosSku.has(item.sku))||vistosUrl.has(item.url)){falhas++;continue;}
                vistosSku.add(item.sku);vistosUrl.add(item.url);
                const id='of_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
                const oferta={id,sku:item.sku,dataInicio:item.inicio||'',dataFim:item.fim||'',
                    linkProduto:item.url,tituloPagina:item.titulo,textoOferta:item.texto,
                    campanha:item.campanha,urlImagem:'',rascunho:true,destaqueDia:false,
                    dataCriacao:new Date().toISOString()};
                const r=await Storage.modificarRascunho({tipo:'criar',id,oferta});
                if(r.ok)ok++;
                else{falhas++;this._setStatus(`Falha de gravação após ${ok} cadastros. Revise os rascunhos antes de tentar novamente.`,true);break;}
            }
            AdminPresenter.renderLista();
            this._setStatus(`${ok} rascunho(s) salvos; ${falhas} falharam. Adicione as imagens e publique após revisar os textos.`);
            this.prever();
        }finally{this.importando=false;btn.disabled=false;}
    }
};
