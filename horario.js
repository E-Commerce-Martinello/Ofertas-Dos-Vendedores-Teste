// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO COM VALIDAÇÕES DE SEGURANÇA
// ============================================

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília
// ============================================
function getHorarioBrasilia() {
    try {
        const agora = new Date();
        
        // Verificar se a data é válida
        if (isNaN(agora.getTime())) {
            console.error('❌ Data inválida em getHorarioBrasilia');
            return new Date(); // Fallback
        }
        
        // Criar data no horário de Brasília usando o timezone correto
        const options = {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        };
        
        // Pegar a string no formato brasileiro
        const strBrasilia = agora.toLocaleString('pt-BR', options);
        
        // Converter string para partes
        const [data, hora] = strBrasilia.split(' ');
        const [dia, mes, ano] = data.split('/').map(Number);
        const [h, m, s] = hora.split(':').map(Number);
        
        // Verificar se as partes são válidas
        if (!ano || !mes || !dia || h === undefined || m === undefined) {
            console.error('❌ Erro ao processar partes da data:', {ano, mes, dia, h, m});
            return new Date();
        }
        
        // Criar data no UTC mas com os valores de Brasília
        return new Date(Date.UTC(ano, mes-1, dia, h, m, s || 0));
    } catch (error) {
        console.error('❌ Erro em getHorarioBrasilia:', error);
        return new Date(); // Fallback
    }
}

// ============================================
// FUNÇÃO 2: Converter data do INPUT (Brasília) para UTC para salvar
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    try {
        if (!dataBrasiliaStr) {
            console.error('❌ dataBrasiliaStr é null/undefined');
            return null;
        }
        
        const [dataParte, horaParte] = dataBrasiliaStr.split('T');
        if (!dataParte || !horaParte) {
            console.error('❌ Formato de data inválido:', dataBrasiliaStr);
            return null;
        }
        
        const [ano, mes, dia] = dataParte.split('-').map(Number);
        const [hora, minuto] = horaParte.split(':').map(Number);
        
        // Validar partes
        if (isNaN(ano) || isNaN(mes) || isNaN(dia) || isNaN(hora) || isNaN(minuto)) {
            console.error('❌ Partes da data inválidas:', {ano, mes, dia, hora, minuto});
            return null;
        }
        
        // Brasília para UTC = adicionar 3 horas
        return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
    } catch (error) {
        console.error('❌ Erro em brasiliaParaUTC:', error);
        return null;
    }
}

// ============================================
// FUNÇÃO 3: Converter UTC para formato do INPUT (Brasília)
// ============================================
function utcParaBrasiliaInput(utcStr) {
    try {
        if (!utcStr) return '';
        
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) {
            console.error('❌ Data UTC inválida:', utcStr);
            return '';
        }
        
        const ano = data.getUTCFullYear();
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const hora = String(data.getUTCHours() - 3).padStart(2, '0');
        const minuto = String(data.getUTCMinutes()).padStart(2, '0');
        
        return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    } catch (error) {
        console.error('❌ Erro em utcParaBrasiliaInput:', error);
        return '';
    }
}

// ============================================
// FUNÇÃO 4: Formatar data UTC para exibição (Brasília) - COM VALIDAÇÃO
// ============================================
function formatarBrasilia(utcStr) {
    try {
        if (!utcStr) {
            console.warn('⚠️ utcStr vazio em formatarBrasilia');
            return 'Data inválida';
        }
        
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) {
            console.warn('⚠️ Data inválida em formatarBrasilia:', utcStr);
            return 'Data inválida';
        }
        
        const ano = data.getUTCFullYear();
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const hora = String(data.getUTCHours() - 3).padStart(2, '0');
        const minuto = String(data.getUTCMinutes()).padStart(2, '0');
        const segundo = String(data.getUTCSeconds()).padStart(2, '0');
        
        return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
    } catch (error) {
        console.error('❌ Erro em formatarBrasilia:', error);
        return 'Data inválida';
    }
}

// ============================================
// FUNÇÃO 5: Verificar se uma oferta está ativa AGORA
// ============================================
function isOfertaAtiva(oferta) {
    try {
        if (!oferta || !oferta.dataInicio || !oferta.dataFim) {
            console.warn('⚠️ Oferta inválida em isOfertaAtiva');
            return false;
        }
        
        const agoraBrasilia = getHorarioBrasilia();
        const dataInicio = new Date(oferta.dataInicio);
        const dataFim = new Date(oferta.dataFim);
        
        if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
            console.warn('⚠️ Datas da oferta inválidas');
            return false;
        }
        
        return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
    } catch (error) {
        console.error('❌ Erro em isOfertaAtiva:', error);
        return false;
    }
}

// ============================================
// FUNÇÃO 6: DEBUG - Mostrar informações no console (COM VALIDAÇÃO)
// ============================================
function debugHorario() {
    try {
        console.log('=== DEBUG HORARIO.JS ===');
        
        const agora = getHorarioBrasilia();
        if (agora && !isNaN(agora.getTime())) {
            console.log('getHorarioBrasilia():', agora.toISOString());
            console.log('formatarBrasilia():', formatarBrasilia(agora.toISOString()));
        } else {
            console.log('getHorarioBrasilia(): ❌ Erro ao obter horário');
        }
        
        // Testar com uma data fixa
        console.log('Teste com data fixa 2026-03-05T10:00:00.000Z:');
        console.log('formatarBrasilia("2026-03-05T10:00:00.000Z"):', formatarBrasilia('2026-03-05T10:00:00.000Z'));
        
    } catch (error) {
        console.error('❌ Erro em debugHorario:', error);
    }
}

// Executar debug automático ao carregar
setTimeout(debugHorario, 500);
