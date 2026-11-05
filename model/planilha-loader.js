// v1.6.12 — leitor de planilhas é carregado somente na primeira importação.
// Os registros importados continuam sendo processados localmente no navegador.
const PlanilhaLoader = {
    promessa:null,
    garantir() {
        if (window.XLSX && typeof window.XLSX.read === 'function') return Promise.resolve();
        if (this.promessa) return this.promessa;
        this.promessa = new Promise((resolve, reject) => {
            const script=document.createElement('script');
            script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
            script.async=true;
            script.onload=()=>window.XLSX ? resolve() : reject(new Error('O leitor de planilhas não foi carregado.'));
            script.onerror=()=>reject(new Error('Falha ao carregar o leitor de planilhas. Confira a conexão com a internet.'));
            document.head.appendChild(script);
        }).catch(e=>{this.promessa=null;throw e;});
        return this.promessa;
    }
};
