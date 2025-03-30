# Bot de Backup Automático para Discord

Bot desenvolvido para realizar backups automáticos de banco de dados MySQL e os envia para um canal do Discord.

## Funcionalidades

- Backup automático de banco de dados MySQL
- Envio do backup para um canal do Discord específico com apresentação visual moderna
- Sistema de limpeza automática de backups antigos
- Logs detalhados de operações de backup
- Visualização detalhada com tamanho do arquivo, horário do próximo backup e outras informações
- Sistema de recuperação automática em caso de falhas
- Tratamento robusto de erros para operação contínua

## Requisitos

- Node.js 16.x ou superior
- NPM
- Banco de dados MySQL
- Bot registrado no Discord com token válido

## Instalação

1. Clone este repositório
2. Execute o arquivo `install.bat` ou use o comando `npm install` para instalar as dependências

## Configuração

Edite o arquivo `config/config.json` com suas informações:

```json
{
    "token": "seu-token-do-discord",
    "channelId": "id-do-canal-discord",
    "backup": {
        "cooldown": 1440,
        "user": "usuario-do-mysql",
        "password": "senha-do-mysql",
        "host": "127.0.0.1",
        "database": "nome-da-database",
        "retentionDays": 30
    }
}
```

### Detalhes da configuração:

- `token`: Token de autenticação do seu bot Discord
- `channelId`: ID do canal onde os backups serão enviados
- `backup.cooldown`: Intervalo entre backups em minutos (padrão: 1440 = 24 horas)
- `backup.user`: Nome de usuário do MySQL
- `backup.password`: Senha do MySQL
- `backup.host`: Endereço do servidor MySQL
- `backup.database`: Nome do banco de dados para backup
- `backup.retentionDays`: Número de dias para manter os backups antigos (padrão: 30)

## Execução

Execute o arquivo `menu.bat` ou use o comando `node .` para iniciar o bot.

## Visualização no Discord

O bot envia mensagens elegantes para o Discord contendo:

- Nome do servidor e data/hora do backup
- Tamanho do arquivo de backup em MB
- Nome do banco de dados
- Previsão do próximo backup agendado
- Arquivo ZIP contendo o dump do banco de dados

## Personalização

Para personalizar o visual dos embeds no Discord, você pode editar:

- A cor do embed (padrão: verde)
- A imagem de thumbnail (atualmente usando uma imagem do Imgur)
- O texto do rodapé
- Os emojis utilizados nos campos

Estas configurações podem ser alteradas no arquivo `index.js` na função `taskBackup()`.

## Recursos de segurança e robustez

O sistema inclui várias proteções para garantir funcionamento contínuo:

- **Recuperação automática**: Em caso de falha, o sistema tentará novamente após 5 minutos
- **Validação de arquivos**: Verifica se os arquivos de backup foram criados corretamente
- **Limpeza automática**: Remove arquivos temporários e backups antigos
- **Logs detalhados**: Registra todas as operações e erros para facilitar a depuração
- **Limite de cooldown**: Impõe um intervalo mínimo de 1 minuto entre backups para evitar sobrecarga

## Estrutura de diretórios

- `/backups`: Armazena os arquivos de backup criados
- `/config`: Contém o arquivo de configuração
- `/logs`: Armazena os logs de operação do sistema
- `/cache`: Diretório para arquivos temporários

## Solução de problemas

### O bot não conecta ao Discord
- Verifique se o token no arquivo config.json está correto
- Verifique se as intents do bot estão habilitadas no portal do desenvolvedor Discord

### Falhas no backup do banco de dados
- Verifique se as credenciais do MySQL estão corretas no config.json
- Verifique se o usuário do MySQL tem permissões para acessar o banco de dados
- Verifique os logs em `/logs` para detalhes dos erros

### Arquivo de backup não é enviado para o Discord
- Verifique se o ID do canal no config.json está correto
- Verifique se o bot tem permissão para enviar mensagens e arquivos no canal
- Verifique se o tamanho do arquivo não excede o limite do Discord (8MB para contas normais, 50MB para Nitro)

### Erros frequentes nos logs
- Consulte os logs detalhados em `/logs` para identificar a causa raiz
- Se ocorrerem erros de conexão com o banco de dados, verifique se o servidor MySQL está acessível
- Para problemas persistentes, reinicie o bot e verifique os logs novamente 
