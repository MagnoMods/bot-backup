const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { token, channelId, backup } = require('./config/config.json');
const archiver = require('archiver');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const mysqldump = require('mysqldump');

/**
 * Inicialização do cliente Discord com as permissões (intents) necessárias
 * - Guilds: Para acessar informações sobre os servidores
 * - GuildMessages: Para enviar mensagens nos canais do servidor
 * - MessageContent: Para ler o conteúdo das mensagens
 */
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Variável global para armazenar o nome do servidor
let serverName = '';

/**
 * Evento executado quando o bot está online e pronto
 * - Mostra mensagem de conexão no console
 * - Obtém o nome do primeiro servidor (guild) que o bot está conectado
 * - Sanitiza o nome do servidor para uso em nomes de arquivos
 * - Inicia a tarefa de backup automático
 */
client.once('ready', () => {
    console.log('[SISTEMA] Bot conectado!');
    console.log('[SISTEMA] Bot desenvolvido por Magneto');
    client.guilds.fetch().then(guilds => {
        if (guilds.size > 0) {
            const firstGuild = guilds.first();
            serverName = firstGuild.name.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitiza o nome do servidor
            console.log(`[SISTEMA] Nome do servidor detectado: ${serverName}`);
            taskBackup(); 
        } else {
            console.error('[ERRO] Nenhum servidor encontrado.');
        }
    }).catch(err => {
        console.error('[ERRO] Ao buscar servidores:', err);
    });
});

/**
 * Função para registrar logs do sistema
 * - Cria o diretório de logs se não existir
 * - Formata a mensagem com timestamp
 * - Armazena os logs em um arquivo específico para o servidor atual
 * @param {string} message - Mensagem a ser registrada no log
 */
const logBackup = async (message) => {
    const logDir = './logs';
    const logFile = path.join(logDir, `${serverName}_backup.log`);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    await fsp.appendFile(logFile, logMessage);
};

/**
 * Função que executa o backup do banco de dados
 * - Verifica se as configurações do banco de dados estão corretas
 * - Cria a estrutura de diretórios para o backup se não existir
 * - Executa o dump do banco de dados usando mysqldump
 * - Compacta o arquivo SQL em um arquivo ZIP
 * - Verifica se o arquivo compactado foi criado corretamente
 * - Remove o arquivo SQL original para economizar espaço
 * - Retorna o caminho do arquivo ZIP e a data do backup
 * @returns {Object|false} Objeto com o caminho do arquivo e data ou false em caso de erro
 */
const executeBackup = async () => { 
    if (!backup || typeof backup != 'object' || !backup.host || !backup.database || !backup.user) { 
        console.error('[ERRO] Configurações incorretas no arquivo config.json');
        await logBackup('[ERRO] Configurações incorretas no arquivo config.json');
        return false;
    }
    
    try {
        const date = new Date();
        const folder = `./backups/${serverName}/${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        const fileName = `${serverName}-${date.toISOString().replace(/:/g, '-')}.sql`;
        const fileDir = path.join(folder, fileName);
        const zipName = fileName.replace('.sql', '.zip');
        const zipDir = path.join(folder, zipName);

        // Certifique-se que a pasta de backup existe
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        try {
            await mysqldump({
                connection: {
                    host: backup.host, 
                    user: backup.user,
                    password: backup.password, 
                    database: backup.database, 
                },
                dumpToFile: fileDir
            });
        } catch (err) {
            await logBackup(`[ERRO] Falha ao criar o arquivo de backup: ${err.message}`);
            return false;
        }

        const output = fs.createWriteStream(zipDir);
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Manipular eventos de erro do arquivo de saída
        output.on('error', async (err) => {
            await logBackup(`[ERRO] Erro no stream de saída: ${err.message}`);
            return false;
        });

        archive.pipe(output);
        archive.file(fileDir, { name: fileName });

        try {
            await archive.finalize();
        } catch (err) {
            await logBackup(`[ERRO] Falha ao compactar o arquivo de backup: ${err.message}`);
            return false;
        }

        // Verifica o tamanho do arquivo compactado
        const stats = fs.statSync(zipDir);
        if (stats.size === 0) {
            await logBackup('[ERRO] O arquivo compactado está vazio.');
            try {
                await fsp.rm(zipDir, { force: true });
            } catch (err) {
                console.error('[ERRO] Não foi possível remover o arquivo ZIP vazio:', err);
            }
            return false;
        }

        // Remove o arquivo SQL original
        try {
            await fsp.rm(fileDir, { force: true });
        } catch (err) {
            console.error('[ERRO] Não foi possível remover o arquivo SQL:', err);
            await logBackup(`[AVISO] Não foi possível remover o arquivo SQL: ${err.message}`);
            // Continuamos mesmo se não conseguirmos remover o arquivo SQL
        }

        await logBackup(`[SUCESSO] Backup criado com sucesso: ${zipDir}`);
        return { zipDir, date }; 
    } catch (err) {
        await logBackup(`[ERRO] Erro inesperado durante o backup: ${err.message}`);
        return false;
    }
};

/**
 * Função para limpar backups antigos
 * - Usa o período de retenção definido na configuração (padrão: 30 dias)
 * - Verifica a idade de cada arquivo/pasta no diretório de backups
 * - Remove arquivos/pastas que excedem o período de retenção
 * - Registra as ações de limpeza no log
 */
const cleanOldBackups = async () => {
    const retentionDays = backup.retentionDays || 30; // Padrão para 30 dias
    const now = Date.now();
    const backupDir = `./backups/${serverName}`;
    
    if (fs.existsSync(backupDir)) {
        const files = await fsp.readdir(backupDir, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(backupDir, file.name);
            const stats = await fsp.stat(filePath);
            const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
            if (ageDays > retentionDays) {
                try {
                    await fsp.rm(filePath, { recursive: true, force: true });
                    await logBackup(`[INFO] Backup antigo removido: ${filePath}`);
                } catch (err) {
                    await logBackup(`[ERRO] Falha ao remover backup antigo: ${err.message}`);
                }
            }
        }
    }
};

/**
 * Função principal que gerencia o ciclo de backup
 * - Verifica as configurações básicas
 * - Limpa os backups antigos
 * - Executa o backup do banco de dados
 * - Envia o arquivo de backup para o canal do Discord
 * - Agenda a próxima execução baseado no cooldown configurado
 */
const taskBackup = async () => { 
    try {
        if (!backup || typeof backup != 'object' || !backup.database) { 
            console.error('[ERRO] Configurações incorretas no arquivo config.json');
            return;
        } 
        
        await cleanOldBackups(); // Limpa backups antigos antes de criar novos
        const result = await executeBackup(); 
        
        if (result && result.zipDir && result.date) {
            const { zipDir, date } = result;
            try {
                const channel = await client.channels.fetch(channelId);
                if (channel && channel.type === ChannelType.GuildText) {
                    // Obter o tamanho do arquivo em MB
                    const stats = fs.statSync(zipDir);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    
                    // Formatar data e hora
                    const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    }).format(date);
                    
                    // Calcular próximo backup
                    const proximoBackup = new Date(date.getTime() + (backup.cooldown || 10) * 60 * 1000);
                    const proximoBackupFormatado = new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).format(proximoBackup);
                    
                    // Usar uma imagem estática mais confiável para o thumbnail
                    const thumbnailUrl = 'https://i.imgur.com/FmqaGDI.png'; // Imagem de backup no imgur
                    
                    // Criar embed
                    const embed = {
                        color: 0x00FF00, // Cor verde para sucesso
                        title: '📦 Sistema de Backup Automático',
                        thumbnail: {
                            url: thumbnailUrl,
                        },
                        fields: [
                            {
                                name: '📊 Informações do Backup',
                                value: [
                                    `📅 **Data:** ${dataFormatada}`,
                                    `🔢 **Tamanho:** ${fileSizeMB} MB`,
                                    `🗃️ **Database:** \`${backup.database}\``,
                                    `💾 **Local:** \`${path.basename(zipDir)}\``
                                ].join('\n'),
                                inline: false
                            },
                            {
                                name: '⏱️ Próximo Backup',
                                value: `Agendado para: **${proximoBackupFormatado}**`,
                                inline: false
                            }
                        ],
                        timestamp: date,
                        footer: {
                            text: `Backup "Nome da sua cidade" • Servidor: ${serverName.replace(/_/g, ' ')}`
                        }
                    };
                    
                    // Enviar mensagem com embed e arquivo
                    await channel.send({
                        embeds: [embed],
                        files: [{ 
                            attachment: zipDir,
                            name: path.basename(zipDir)
                        }]
                    });
                    
                    await logBackup(`[SUCESSO] Backup enviado para o canal do Discord. Tamanho: ${fileSizeMB} MB`);
                } else {
                    await logBackup('[ERRO] Canal não encontrado ou não é um canal de texto.');
                    console.log('[ERRO] Canal não encontrado ou não é um canal de texto.');
                }
            } catch (err) {
                await logBackup(`[ERRO] Falha ao enviar backup para o Discord: ${err.message}`);
                console.error('[ERRO] Falha ao enviar backup para o Discord:', err);
            }
        } else {
            await logBackup('[ERRO] Não foi possível criar o backup. Verificar logs para mais detalhes.');
        }
        
        // Agenda a próxima execução com cooldown mínimo de 1 minuto para evitar execução excessiva
        const cooldown = Math.max(1, backup.cooldown || 10) * 60 * 1000;
        setTimeout(taskBackup, cooldown); 
    } catch (err) {
        await logBackup(`[ERRO] Erro inesperado na rotina de backup: ${err.message}`);
        console.error('[ERRO] Erro inesperado na rotina de backup:', err);
        
        // Mesmo em caso de erro, agenda a próxima execução
        setTimeout(taskBackup, 5 * 60 * 1000); // Tenta novamente em 5 minutos em caso de erro
    }
};

/**
 * Inicia o bot Discord com o token configurado
 * Após a conexão, o evento 'ready' será disparado
 */
client.login(token); 

