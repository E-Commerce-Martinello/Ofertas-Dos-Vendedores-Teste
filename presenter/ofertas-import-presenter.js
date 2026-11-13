// v1.6.18 — pré-cadastro seguro: importa Excel/CSV como RASCUNHOS, sem imagem e sem publicação.
const OfertasImportPresenter = {
    linhas:[], headers:[], mapeamento:{}, preparando:false, importando:false,
    campos:{sku:['sku','codigo','codigo_produto','id_produto','referencia'],
        titulo:['titulo','titulo_oferta','produto','nome','nome_produto','descricao_produto'],
        url:['url','link','url_produto','link_produto','pagina_produto'],
        texto:['texto','texto_oferta','mensagem','copy','descricao_oferta'],
        campanha:['campanha','campanha_oferta'],
        inicio:['inicio','data_inicio','inicio_oferta'], fim:['fim','data_fim','fim_oferta']},
    normalizar(x){return String(x??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');},
    _setStatus(s,erro=false){const el=document.getElementById('importOfertasStatus');if(el){el.textContent=s;el.style.color=erro?'#bd2830':'';}},
    async analisar(){
        if(this.preparando)return;
        const file=document.getElementById('importOfertasArquivo')?.files?.[0];
        if(!file){this._setStatus('Escolha um Excel ou CSV.',true);return;}
        if(!/\.(csv|xlsx)$/i.test(file.name)){this._setStatus('Formato permitido: .csv ou .xlsx.',true);return;}
        if(file.size>10*1024*1024){this._setStatus('Limite de 10 MB.',true);return;}
        this.preparando=true;this._setStatus('Lendo arquivo...');
        try{
            await PlanilhaLoader.garantir();
            const buffer=await file.arrayBuffer();
            const book=XLSX.read(buffer,{type:'array',cellDates:false,raw:false});
            if(!book.SheetNames.length)throw Error('Arquivo sem abas.');
            const sheet=book.Sheets[book.SheetNames[0]];
            const matriz=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});
            if(matriz.length<2)throw Error('Não há produtos na planilha.');
            if(matriz.length>501)throw Error('Limite de 500 linhas por análise. Divida a importação.');
            this.headers=matriz[0].map(String).map(s=>s.trim()).slice(0,60);
            if(this.headers.length<2)throw Error('É necessário ao menos um cabeçalho de título e URL.');
            this.linhas=matriz.slice(1).filter(r=>r.some(x=>String(x??'').trim())).slice(0,500);
            const normalizados=this.headers.map(x=>this.normalizar(x));
            this.mapeamento={};
            for(const [campo,aliases] of Object.entries(this.campos)){
                const i=normalizados.findIndex(h=>aliases.includes(h));
                this.mapeamento[campo]=i>=0?String(i):'';
            }
            for(const campo of Object.keys(this.campos)){
                const sel=document.getElementById('importMap'+campo);sel.replaceChildren(new Option('Não importar',''));
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
        const raw=this._ler(linha,'url'); let url='';
        try{const u=new URL(raw);if(u.protocol==='https:'&&['www.martinello.com.br','martinello.com.br'].includes(u.hostname))url=u.origin+u.pathname;}catch(_){}
        const sku=(this._ler(linha,'sku')||(url.match(/-(\d{3,12})\/?$/)||[])[1]||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);
        const titulo=this._ler(linha,'titulo').slice(0,160);
        const texto=this._ler(linha,'texto').slice(0,3000);
        const campanha=this._ler(linha,'campanha').toLowerCase();
        const inicio=this._ler(linha,'inicio');const fim=this._ler(linha,'fim');
        const erros=[];
        if(!titulo)erros.push('título ausente');
        if(!url)erros.push('link Martinello inválido');
        if(texto.includes('\uFFFD'))erros.push('texto com caractere � (revisar codificação UTF-8)');
        if(campanha && !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(campanha))erros.push('campanha inválida');
        const criadas=[...(AdminPresenter.ofertas||[]),...(AdminPresenter.rascunhos||[])];
        if(criadas.some(o=>(sku&&o.sku===sku)||(url && o.linkProduto===url)))erros.push('já existente');
        return {index:i+2,sku,titulo,url,texto,campanha,inicio,fim,erros};
    },
    prever(){
        if(!this.linhas.length)return;
        const m=this.linhas.map((r,i)=>this._produto(r,i));
        this.previa=m;
        const vistosSku=new Set(),vistosUrl=new Set();
        for(const x of m){if((x.sku&&vistosSku.has(x.sku))||(x.url&&vistosUrl.has(x.url)))x.erros.push('duplicado neste arquivo');
            if(x.sku)vistosSku.add(x.sku);if(x.url)vistosUrl.add(x.url);}
        const validos=m.filter(x=>!x.erros.length);
        this._setStatus(`${m.length} produtos analisados · ${validos.length} prontos para rascunho · ${m.length-validos.length} exigem correção.`);
        const corpo=document.getElementById('importOfertasPrevia');
        const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        corpo.innerHTML=m.slice(0,30).map(x=>`<tr><td>${x.index}</td><td>${esc(x.sku||'—')}</td><td>${esc(x.titulo)}</td><td>${esc(x.erros.join(' · ')||'Pronto para rascunho')}</td></tr>`).join('');
        document.getElementById('importOfertasPreviaCard').hidden=false;
        document.getElementById('importOfertasConfirmar').disabled=!validos.length;
    },
    async importar(){
        if(this.importando)return;
        this.prever();
        const aprovadas=(this.previa||[]).filter(x=>!x.erros.length);
        if(!aprovadas.length){this._setStatus('Nenhuma linha válida.',true);return;}
        if(!confirm(`Importar ${aprovadas.length} oferta(s) como RASCUNHO? Não serão exibidas aos vendedores até a publicação manual.`))return;
        this.importando=true;let ok=0,falhas=0;
        const btn=document.getElementById('importOfertasConfirmar');btn.disabled=true;
        const vistosSku=new Set(),vistosUrl=new Set();
        try{
            for(const item of aprovadas){
                // Não duplicar SKUs ou URLs repetidos dentro do mesmo lote.
                if((item.sku&&vistosSku.has(item.sku))||vistosUrl.has(item.url)){falhas++;continue;}
                vistosSku.add(item.sku);vistosUrl.add(item.url);
                const id='of_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);
                const oferta={id,sku:item.sku,dataInicio:item.inicio||'',dataFim:item.fim||'',
                    linkProduto:item.url,tituloPagina:item.titulo,textoOferta:item.texto,
                    campanha:item.campanha,urlImagem:'',rascunho:true,destaqueDia:false,
                    dataCriacao:new Date().toISOString()};
                const r=await Storage.modificarRascunho({tipo:'criar',id,oferta});
                if(r.ok){ok++; /* sincronização Firebase já atualiza AdminPresenter.rascunhos */}
                else {falhas++;this._setStatus(`Falha de gravação após ${ok} cadastros. Confira os rascunhos antes de tentar novamente.`,true);break;}
            }
            AdminPresenter.renderLista();
            this._setStatus(`${ok} rascunhos salvos; ${falhas} ignorados/falharam. Adicione as imagens e publique individualmente.`);
            this.prever();
        }finally{this.importando=false;btn.disabled=false;}
    }
};
