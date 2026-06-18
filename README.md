# BX Conversation Trace - VS Code Extension MVP

Este bundle contém a primeira versão experimental da extensão **BX Conversation Trace**.

A ideia desta versão é simples:

> O usuário conversa com `@bx` no Chat do VS Code, e o BX registra cada interação em uma sessão estruturada dentro da pasta `.bx/` do projeto.

Esta versão **não tenta gerar código**, **não captura chat de outros participantes** e **não lê diffs automaticamente**. Ela é o primeiro tijolo: transformar conversa em evidência estruturada.

---

## 1. O que este MVP entrega

Comandos via Chat do VS Code:

```text
@bx /init
@bx /start cadastro de pacientes
@bx Quero criar um CRUD de pacientes usando FastAPI com CPF e data de nascimento.
@bx /status
@bx /summary
@bx /stop
```

Comandos via Command Palette:

```text
BX: Init Repository
BX: Start Session
BX: Show Session Status
BX: Generate Summary
BX: Stop Session
```

Arquivos gerados no projeto que estiver aberto no VS Code:

```text
.bx/
  bx.yaml
  sessions/
    <session-id>/
      session.json
      chat-events.jsonl
      summary.md
  reports/
  policies/
  templates/
```

---

## 2. Pré-requisitos

Você precisa ter instalado:

1. **Visual Studio Code**
2. **Node.js LTS**
3. **PowerShell**
4. Git, recomendado, mas não obrigatório para este MVP

### 2.1. Verificar se o Node.js está instalado

No PowerShell:

```powershell
node -v
```

O que esse comando faz:

- Chama o executável `node`.
- Mostra a versão instalada.
- Se aparecer algo como `v20.x.x` ou `v22.x.x`, está ok.

Depois rode:

```powershell
npm -v
```

O que esse comando faz:

- Chama o gerenciador de pacotes do Node.js.
- Ele será usado para instalar as dependências da extensão.

Se algum desses comandos não funcionar, instale o Node.js LTS pelo site oficial antes de continuar.

---

## 3. Como abrir o projeto da extensão

Extraia o ZIP em uma pasta de trabalho, por exemplo:

```text
C:\dev\bx-vscode-extension-bundle
```

No PowerShell:

```powershell
cd C:\dev\bx-vscode-extension-bundle
```

O que esse comando faz:

- `cd` significa *change directory*.
- Ele muda o diretório atual do PowerShell para a pasta do projeto da extensão.

Abra essa pasta no VS Code:

```powershell
code .
```

O que esse comando faz:

- `code` abre o Visual Studio Code.
- `.` significa “a pasta atual”.
- Então `code .` abre o projeto atual no VS Code.

Se `code .` não funcionar, abra o VS Code manualmente e use:

```text
File > Open Folder...
```

---

## 4. Instalar dependências

Dentro da pasta da extensão, rode:

```powershell
npm install
```

O que esse comando faz:

- Lê o arquivo `package.json`.
- Baixa as dependências de desenvolvimento, como TypeScript e tipos do VS Code.
- Cria a pasta `node_modules/`.
- Cria ou atualiza o arquivo `package-lock.json`.

Essa etapa precisa de internet.

---

## 5. Compilar a extensão

Depois de instalar as dependências, rode:

```powershell
npm run compile
```

O que esse comando faz:

- Executa o script `compile` definido no `package.json`.
- Esse script chama:

```powershell
tsc -p ./
```

- `tsc` é o compilador TypeScript.
- `-p ./` manda o TypeScript usar o arquivo `tsconfig.json` da pasta atual.
- O código em `src/` é compilado para JavaScript dentro da pasta `out/`.

Resultado esperado:

```text
out/
  extension.js
  bx/
    eventStore.js
    sessionManager.js
    chatParticipant.js
    summaryGenerator.js
    textMetrics.js
    types.js
```

Se esse comando falhar, veja a mensagem do terminal. Na maioria dos casos será dependência faltando ou versão antiga do Node.js.

---

## 6. Rodar a extensão em modo desenvolvimento

No VS Code, com o projeto da extensão aberto:

1. Pressione `F5`.
2. O VS Code abrirá uma segunda janela chamada **Extension Development Host**.
3. Essa segunda janela é onde a extensão roda para teste.

O que acontece nos bastidores:

- O VS Code usa `.vscode/launch.json`.
- Antes de abrir a janela de teste, ele roda a task `npm: compile`.
- A extensão é carregada a partir do projeto local, sem instalar nada globalmente.

---

## 7. Criar um projeto de teste

Na janela **Extension Development Host**, abra uma pasta qualquer para servir de projeto de teste.

Exemplo no PowerShell, fora ou dentro do VS Code:

```powershell
mkdir C:\dev\bx-test-project
cd C:\dev\bx-test-project
code .
```

O que cada comando faz:

```powershell
mkdir C:\dev\bx-test-project
```

- Cria uma pasta chamada `bx-test-project`.

```powershell
cd C:\dev\bx-test-project
```

- Entra nessa pasta.

```powershell
code .
```

- Abre essa pasta no VS Code.

Importante: a extensão precisa de uma pasta aberta para conseguir criar `.bx/`.

---

## 8. Testar pelo Chat do VS Code

Na janela **Extension Development Host**:

1. Abra o Chat do VS Code.
2. Digite:

```text
@bx /init
```

O que isso faz:

- Aciona o participante de chat `@bx`.
- Executa o comando `/init` dentro do handler da extensão.
- Cria a estrutura inicial `.bx/` no projeto aberto.

Resultado esperado:

```text
.bx/
  bx.yaml
  sessions/
  reports/
  policies/
  templates/
```

Agora inicie uma sessão:

```text
@bx /start cadastro de pacientes
```

O que isso faz:

- Cria uma sessão ativa na memória da extensão.
- Cria uma pasta dentro de `.bx/sessions/`.
- Salva `session.json`.
- Salva um evento `bx.session.started` em `chat-events.jsonl`.

Agora mande uma mensagem comum:

```text
@bx Quero criar um CRUD de pacientes usando FastAPI com CPF e data de nascimento.
```

O que isso faz:

- Registra a mensagem bruta do usuário.
- Infere uma intenção simples, por regra.
- Extrai entidades simples, como `patient`, `cpf` e `fastapi`.
- Detecta riscos simples, como `personal_or_health_data`.
- Calcula observability textual simples: `totalchars`, `estimatedTokens` e `tokenCountingMethod`.
- Salva tudo em JSONL.

Veja o status:

```text
@bx /status
```

Gere o resumo:

```text
@bx /summary
```

O que isso faz:

- Lê os eventos da sessão atual.
- Gera um arquivo `summary.md`.
- Retorna o caminho do arquivo no chat.

Encerre a sessão:

```text
@bx /stop
```

O que isso faz:

- Marca a sessão como `stopped`.
- Atualiza o `session.json`.
- Grava um evento `bx.session.stopped`.

---

## 9. Testar pela Command Palette

Você também pode testar sem chat.

Abra a Command Palette:

```text
Ctrl+Shift+P
```

Procure por:

```text
BX: Init Repository
BX: Start Session
BX: Show Session Status
BX: Generate Summary
BX: Stop Session
```

Esses comandos chamam os mesmos serviços internos usados pelo chat.

Observação: mensagens comuns só são logadas quando passam por `@bx`. A Command Palette serve para controlar a sessão, não para registrar conversas livres.

---

## 10. Onde olhar os logs

Depois de testar, abra:

```text
.bx/sessions/<session-id>/chat-events.jsonl
```

Cada linha é um evento JSON independente.

Exemplo:

```json
{"id":"evt_...","type":"bx.chat.user_message","sessionId":"...","timestamp":"...","payload":{"rawText":"Quero criar um CRUD de pacientes usando FastAPI com CPF e data de nascimento.","inferredIntent":"create_or_generate_code","entities":["patient","cpf","fastapi"],"riskFlags":["personal_or_health_data"],"observability":{"totalchars":83,"estimatedTokens":21,"tokenCountingMethod":"totalchars/4"}}}
```

Por que JSONL?

- É simples.
- É append-only.
- É fácil de auditar.
- Não precisa de banco no MVP.
- Dá para migrar para SQLite depois.

Observability textual no MVP:

```json
{
  "observability": {
    "totalchars": 83,
    "estimatedTokens": 21,
    "tokenCountingMethod": "totalchars/4"
  }
}
```

Esses tokens são uma estimativa de volume textual, não cobrança real de modelo. Como esta versão ainda não chama IA, não existe `billedTokens`.

---

## 11. Limitações conhecidas desta versão

1. O BX só registra mensagens enviadas para `@bx`.
2. O BX ainda não observa mensagens enviadas para outros participantes, como `@workspace`, `@terminal` ou Copilot.
3. O BX ainda não captura diffs de código.
4. O BX ainda não chama modelo de IA próprio.
5. A inferência de intenção é baseada em regras simples.
6. A detecção de risco é só um alerta inicial, não uma auditoria.

Isso é intencional. O objetivo desta sprint é validar a mecânica central: **sessão + evento estruturado + resumo**.

---

## 12. Próximos passos técnicos naturais

Depois que este MVP estiver rodando, as próximas evoluções seriam:

1. Capturar arquivos abertos e arquivo ativo no momento da mensagem.
2. Capturar seleção de código junto com a mensagem.
3. Capturar diffs desde o início da sessão.
4. Associar mensagem de chat com arquivos alterados depois.
5. Gerar `decision-points.jsonl` e `risk-flags.jsonl`.
6. Criar CLI `bx status`, `bx summary`, `bx export`.
7. Adicionar SQLite quando JSONL começar a ficar limitado.
8. Trocar estimativa textual por uso real de modelo quando o BX chamar IA.
9. Integrar com Langfuse ou OpenTelemetry GenAI em uma fase posterior.

---

## 13. Estrutura interna do código

```text
src/
  extension.ts
  bx/
    chatParticipant.ts
    eventStore.ts
    sessionManager.ts
    summaryGenerator.ts
    textMetrics.ts
    types.ts
```

### `extension.ts`

Ponto de entrada da extensão.

Responsável por:

- ativar a extensão;
- registrar comandos da Command Palette;
- registrar o participante de chat `@bx`.

### `chatParticipant.ts`

Recebe mensagens do Chat do VS Code direcionadas a `@bx`.

Responsável por:

- interpretar `/init`, `/start`, `/status`, `/summary`, `/stop`;
- registrar mensagens comuns como eventos de chat.

### `sessionManager.ts`

Controla a sessão ativa.

Responsável por:

- criar sessão;
- encerrar sessão;
- registrar mensagem do usuário;
- registrar resposta do BX;
- inferir intenção simples;
- detectar riscos simples;
- calcular observability textual simples por mensagem.

### `eventStore.ts`

Camada de persistência local.

Responsável por:

- criar `.bx/`;
- salvar `session.json`;
- anexar eventos em `chat-events.jsonl`;
- gerar `summary.md`.

### `summaryGenerator.ts`

Gera um resumo markdown a partir dos eventos da sessão. Também soma `totalchars` e `estimatedTokens` das mensagens registradas.

### `textMetrics.ts`

Calcula o bloco `observability` textual:

```ts
{
  totalchars: text.length,
  estimatedTokens: Math.ceil(totalchars / 4),
  tokenCountingMethod: 'totalchars/4'
}
```

### `types.ts`

Define os contratos TypeScript principais.

---

## 14. Instalar como VSIX, opcional

Depois que compilar, você pode empacotar a extensão:

```powershell
npm run package
```

O que esse comando faz:

- Executa `vsce package`.
- Gera um arquivo `.vsix`, que é o pacote instalável da extensão.

Exemplo de saída:

```text
bx-vscode-0.0.1.vsix
```

Para instalar manualmente no VS Code:

```powershell
code --install-extension .\bx-vscode-0.0.1.vsix
```

O que esse comando faz:

- Pede ao VS Code para instalar a extensão a partir do pacote local `.vsix`.

Para desenvolvimento inicial, prefira `F5`. Empacotar só vale quando você quiser testar fora do modo desenvolvimento.

---

## 15. Diagnóstico rápido

### Erro: `BX requires an open workspace folder.`

Você abriu o VS Code sem uma pasta de projeto.

Resolva abrindo uma pasta:

```powershell
mkdir C:\dev\bx-test-project
cd C:\dev\bx-test-project
code .
```

### O `@bx` não aparece no chat

Verifique:

1. Você está na janela **Extension Development Host**?
2. Você rodou `F5` a partir do projeto da extensão?
3. O projeto compilou sem erro?
4. Seu VS Code tem suporte ao Chat/Copilot Chat habilitado?

### `npm install` falha

Verifique:

```powershell
node -v
npm -v
```

Se Node.js ou npm não existirem, instale o Node.js LTS.

### `npm run compile` falha

Rode:

```powershell
npm install
npm run compile
```

Se ainda falhar, leia o erro. TypeScript costuma apontar arquivo e linha.

---

## 16. Filosofia desta primeira versão

Esta versão evita sofisticação desnecessária.

Ela não tenta ser o Cursor.
Ela não tenta ser Copilot.
Ela não tenta ser governança corporativa com crachá e café ruim.

Ela faz o básico importante:

> cria uma sessão, captura conversas do `@bx`, estrutura eventos e gera um resumo auditável.

