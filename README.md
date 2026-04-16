# Bot de Filas Avançado V2 - Edição Completa

Este bot foi desenvolvido para ser a solução definitiva em gerenciamento de filas de apostas e partidas (x1) no Discord, utilizando as tecnologias mais recentes da `discord.js v14`.

## 🚀 Funcionalidades Principais

### 🎮 Sistema de Filas Inteligente
- **Slash Commands**: `/setup_fila` para criar painéis de fila instantaneamente.
- **Modos de Jogo**: Suporte a 1v1, 2v2, 4v4 e valores personalizados.
- **Confirmação de Partida**: Sistema de segurança onde ambos os jogadores devem confirmar antes de iniciar.
- **Tópicos Privados**: Criação automática de canais temporários para as partidas.

### 🛡️ Sistema de Mediador
- **Fila de Espera**: Mediadores entram em uma fila (`/mediadores`) e são chamados automaticamente para as partidas.
- **Integração PIX**: Exibição automática da chave PIX do mediador responsável.
- **Logs de Partida**: Registro de todas as atividades para auditoria.

### 💰 Sistema de Coins e Economia
- **Saldo**: Verifique seu saldo com `/coins`.
- **Economia Integrada**: Sistema pronto para expansão com apostas e recompensas.

### ⚙️ Painel de Configurações Avançado
- **Interface Intuitiva**: `/config_panel` com menus de seleção para gerenciar todo o bot.
- **Personalização**: Altere títulos, cores e emojis sem mexer no código.

### 📊 Sistema de Analista
- **Estatísticas**: `/analista` para ver o desempenho do servidor, lucro e atividade.

## 🛠️ Instalação e Configuração

1. **Requisitos**: Node.js v16.11.0 ou superior.
2. **Dependências**:
   ```bash
   npm install discord.js simpl.db dotenv ms
   ```
3. **Configuração**:
   - Crie um arquivo `.env` na raiz:
     ```env
     TOKEN=SEU_TOKEN_AQUI
     ```
   - Configure os emojis em `src/utils/config.js` se desejar usar os seus próprios.

4. **Execução**:
   ```bash
   npm start
   ```

## 📝 Comandos
- `/setup_fila`: Cria um painel de filas.
- `/mediadores`: Cria o painel para mediadores entrarem na fila.
- `/config_panel`: Abre as configurações do bot.
- `/coins`: Mostra o saldo de coins.
- `/analista`: Mostra estatísticas do bot.

---
Desenvolvido com foco em performance e facilidade de uso.
