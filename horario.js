// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO SEM ERROS NO CONSOLE
// ============================================

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília (VERSÃO SIMPLIFICADA)
// ============================================
function getHorarioBrasilia() {
    try {
        const agora = new Date();
        
        // Método mais simples e confiável: usar UTC e subtrair 3 horas
        const utc = Date.UTC(
            agora.getUTCFullYear(),
            agora.getUTCMonth(),
            agora.getUTCDate(),
            agora.getUTCHours(),
            agora.getUTCMinutes(),
            agora.getUTCSeconds()
        );
        
        // Brasília = UTC - 3 horas
        return new Date(utc - (3 * 60 * 60 * 1000));
    } catch (error) {
        console.error('Erro em getHorarioBrasilia:', error);
        return new Date();
    }
}

// ============================================
// FUNÇÃO 2: Formatar data UTC para exibição (Brasília)
// ============================================
function formatarBrasilia(utcStr) {
    try {
        if (!utcStr) return 'Data inválida';
        
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return 'Data inválida';
        
        // Converter UTC para Brasília (subtrair 3 horas)
        const dataBrasilia = new Date(data.getTime() - (3 * 60 * 60 * 1000));
        
        const dia = String(dataBrasilia.getUTCDate()).padStart(2, '0');
        const mes = String(dataBrasilia.getUTCMonth() + 1).padStart(2, '0');
        const ano = dataBrasilia.getUTCFullYear();
        const hora = String(dataBrasilia.getUTCHours()).padStart(2, '0');
        const minuto = String(dataBrasilia.getUTCMinutes()).padStart(2, '0');
        const segundo = String(dataBrasilia.getUTCSeconds()).padStart(2, '0');
        
        return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
    } catch (error) {
        return 'Data inválida';
    }
}

// ============================================
// FUNÇÃO 3: Converter data do INPUT (Brasília) para UTC para salvar
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    try {
        if (!dataBrasiliaStr) return null;
        
        const [dataParte, horaParte] = dataBrasiliaStr.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(Number);
        const [hora, minuto] = horaParte.split(':').map(Number);
        
        // Brasília para UTC = adicionar 3 horas
        return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
    } catch (error) {
        console.error('Erro em brasiliaParaUTC:', error);
        return null;
    }
}

// ============================================
// FUNÇÃO 4: Converter UTC para formato do INPUT (Brasília)
// ============================================
function utcParaBrasiliaInput(utcStr) {
    try {
        if (!utcStr) return '';
        
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return '';
        
        const ano = data.getUTCFullYear();
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const hora = String(data.getUTCHours() - 3).padStart(2, '0');
        const minuto = String(data.getUTCMinutes()).padStart(2, '0');
        
        return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    } catch (error) {
        return '';
    }
}

// ============================================
// FUNÇÃO 5: Verificar se uma oferta está ativa AGORA
// ============================================
function isOfertaAtiva(oferta) {
    try {
        if (!oferta || !oferta.dataInicio || !oferta.dataFim) return false;
        
        const agoraBrasilia = getHorarioBrasilia();
        const dataInicio = new Date(oferta.dataInicio);
        const dataFim = new Date(oferta.dataFim);
        
        if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) return false;
        
        return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
    } catch (error) {
        return false;
    }
}

// ============================================
// FUNÇÃO 6: DEBUG (opcional - pode remover)
// ============================================
function debugHorario() {
    const agora = getHorarioBrasilia();
    console.log('=== Horário Brasília ===', formatarBrasilia(agora.toISOString()));
}
