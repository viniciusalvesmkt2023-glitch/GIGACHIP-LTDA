# Guia — ligar a planilha do gestor (Google Planilhas)

O sistema usa um **"usuário robô"** do Google (conta de serviço). Ele só mexe nas planilhas que
forem **compartilhadas com ele**, do mesmo jeito que você compartilha com uma pessoa.

> 🔒 A chave do robô é um segredo: ela vai **só na Vercel**. Não mande no chat, por e-mail ou WhatsApp.

## 1. Criar o usuário robô (uma vez, ~10 minutos)

1. Entre em **console.cloud.google.com** com a sua conta Google (a mesma do Gmail serve).
2. No topo, clique no seletor de projeto → **Novo projeto** → nome `gigachip-planilha` → **Criar**.
   Confira que o projeto novo está selecionado no topo.
3. Menu ☰ → **APIs e serviços** → **Biblioteca** → procure **Google Sheets API** → **Ativar**.
4. Menu ☰ → **IAM e administrador** → **Contas de serviço** → **+ Criar conta de serviço**:
   - Nome: `robo-planilha` → **Criar e continuar**;
   - "Conceder acesso" e "Acesso de usuários": deixe em branco → **Concluir**.
5. Clique na conta criada → aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON** →
   **Criar**. Um arquivo `.json` é baixado. **Guarde com cuidado** (é a senha do robô).
   - Se aparecer que a criação de chaves está bloqueada por política da organização, me avise.

## 2. Colocar a chave na Vercel

1. Vercel → projeto → **Settings** → **Environment Variables** → **Add**.
2. Nome: `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Valor: abra o arquivo `.json` no Bloco de Notas (ou TextEdit), copie **todo** o conteúdo e cole.
4. Salve e faça **Redeploy**.
5. Depois de salvo na Vercel, apague o arquivo `.json` do computador (ou guarde num lugar seguro).

## 3. Compartilhar a planilha com o robô

1. No painel → **Integrações** → card "Google Planilhas": copie o **e-mail do robô**
   (termina com `iam.gserviceaccount.com`).
2. Abra a planilha do gestor → **Compartilhar** → cole o e-mail do robô → **Editor** → desmarque
   "Notificar pessoas" → **Compartilhar**.
   - Se o botão Compartilhar não deixar, peça para o **gestor** (dono da planilha) compartilhar
     com esse e-mail como Editor.

## 4. Ligar no painel

1. Painel → **Configurações** → "Planilha do gestor": cole o **link** da planilha (o endereço do
   navegador com ela aberta). Nome da aba: deixe em branco (o sistema procura em todas) ou digite o
   nome exato da aba das linhas. **Salvar**.
2. Painel → **Integrações** → **Testar planilha**. Ele mostra quais colunas achou e quantos números
   há — **não altera nada**. Confira se Cliente, Número, ICCID, Smart-Dados, Ativação, Venda final,
   Valor e Vencimento foram achados.
3. Painel → **Linhas** → **Ler planilha agora**. Os números sem cliente viram "Disponíveis" e as
   linhas com cliente entram como clientes antigos.

## Como funciona depois

| Quem | Faz o quê | O sistema |
|------|-----------|-----------|
| Gestor | Coloca números novos na planilha | Lê de hora em hora (ou "Ler planilha agora") → aparecem em "Ativar linha" |
| Dono | "Ativar linha" no pedido | Preenche Cliente, ICCID, Smart-Dados, Ativação, Venda final, Valor, Vencimento na linha do número |
| Dono | "Bloqueei na Vivo" (Inadimplência) | Pinta o nome do cliente de **vermelho** |
| Dono | "Desbloqueei na Vivo" | Volta o nome para preto |

- Número **disponível** = "Disponível" na coluna Cliente **e** ICCID Atual, Smart-Dados, Ativação,
  Venda Final, Valor e Vencimento vazios. Se algum estiver preenchido, o número fica fora da lista
  (o "Testar planilha" mostra a linha para arrumar).
- **Nunca** altera Login Vivo, Número, Plano PJ e Forma de pagamento.
- Se o número já tiver outro cliente escrito na planilha, ou aparecer **mais de uma vez**, o sistema
  **não escreve nada**: mostra um aviso
  em Linhas para você conferir.
- Se o Google estiver fora do ar, a escrita fica pendente e a rotina tenta de novo.
