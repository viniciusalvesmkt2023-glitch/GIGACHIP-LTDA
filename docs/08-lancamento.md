# 08 — Roteiro de lançamento (versão 2 — 22/11/2026)

Tudo o que falta para colocar o site e o painel novos no ar e **vender de verdade**.
Marque cada item ao concluir. ⚠️ = obrigatório antes do primeiro cliente real.
Quem faz: **[Claude]** = eu, no código · **[Sócios]** = vocês (contas, pagamentos, documentos).

---

## O que já está pronto (no rascunho, ainda não está no ar)

- ✅ **Página inicial nova** (celular grande, planos estilo Vivo com coroa no "MAIS ESCOLHIDO",
  "Poucos passos", "Por que a Gigachip", perguntas frequentes, rodapé com Reclame Aqui).
- ✅ **Painel inteiro redesenhado**: login (formato do EngajaEu 2.0), Visão geral com gráfico de
  vendas, Pedidos, Linhas, Inadimplência, Equipe, Integrações e Configurações.
- ✅ **Número do pedido simplificado**: "#8" em vez de "GC-2026-00008" (painel, e-mails, contrato,
  D4Sign e Asaas). A busca aceita "8" ou "#8".
- ✅ **Planilha do gestor**:
  - mostra o motivo do erro em vez de "escrevendo…" para sempre;
  - coluna **Gestor** vira "Gestor Ativo" na ativação;
  - em Configurações dá para mudar sozinho os **nomes das colunas**, **o que escrever** em cada
    uma e as **regras** (ao ativar, bloquear e desbloquear) — D34, D35 e D36.
- ✅ Contratação, pagamento, ativação e Área do Cliente **desenhadas no Lovable** (só visual).

---

## Fase 0 — Terminar o sistema [Claude]

- [ ] ⚠️ Trazer do Lovable para o sistema real a **contratação nova**:
  - 3 passos;
  - data de nascimento com "/" automático;
  - resumo azul só no 1º passo;
  - **sem** a caixinha de aceitar Termos/Privacidade.
- [ ] ⚠️ **Pagamento novo**:
  - PIX com QR Code, "copia e cola" e passo a passo;
  - cartão pela página segura do Asaas;
  - tela "Pagamento confirmado".
- [ ] ⚠️ **Ativação nova**:
  - **eSIM**: guia animado (iPhone ou Android) com "print do registro do eSIM" e botão de copiar
    o código;
  - **chip físico**: foto do verso da embalagem lacrada (ICCID), com a opção "envio depois".
- [ ] **Área do Cliente** com o cabeçalho simples e o botão "Sair" (faturas ficam para a 2ª fase).
- [ ] Tirar os links de Termos e Privacidade dos rodapés (pedido dos sócios). Ver o aviso na Fase A.
- [ ] (Opcional) Botão **"Remover acesso"** na Equipe, para quando alguém sair.
- [ ] ⚠️ Juntar tudo numa versão só e rodar todas as verificações:
  - lint, tipos, testes e regras do banco;
  - um pedido de teste do começo ao fim.
- [ ] ⚠️ **Mostrar a lista final do que muda e esperar a aprovação dos sócios** antes de publicar.

## Fase A — Contas e documentos (pode ir fazendo já) [Sócios]

- [ ] ⚠️ **Advogado aprova o contrato** (PDF de teste no painel). Depois disso eu tiro a marca
  d'água "TESTE".
- [ ] ⚠️ **Perguntar ao advogado sobre privacidade (LGPD).** Vocês pediram para tirar as páginas e
  a caixinha de Termos/Privacidade. A LGPD exige informar o cliente sobre o uso dos dados (CPF,
  documento, selfie). O advogado diz se basta o que está no contrato da D4Sign ou se precisa de um
  aviso no site. Se precisar, eu coloco de volta de um jeito discreto.
- [ ] ⚠️ **Vercel Pro** (US$ 20/mês). O plano grátis não pode ser usado para vender (regra da Vercel).
- [ ] ⚠️ **Supabase Pro** (US$ 25/mês). Sem ele não há backup diário e o banco pausa se ficar parado.
- [ ] ⚠️ **WhatsApp**: número definitivo → Vercel `NEXT_PUBLIC_WHATSAPP_NUMBER` (só números, com
  DDD) → Redeploy. Painel → Integrações mostra se está configurado.
- [ ] **E-mails (Resend)**: conferir em Integrações que "E-mails" está **Configurado**
  (`RESEND_API_KEY` e `EMAIL_FROM` na Vercel). Sem isso, o cliente não recebe o link da ativação.
- [ ] **D4Sign**: pedir aumento do limite de 10 chamadas por hora e confirmar se o reconhecimento
  facial gasta créditos.
- [ ] **Domínio** `gigachip.com.br` apontando para a Vercel:
  - Vercel → Settings → Domains → adicionar `gigachip.com.br` e `www.gigachip.com.br`;
  - copiar os registros para o DNS **sem mexer** nos de e-mail (MX) nem nos do Resend.
- [ ] **DMARC**, para os e-mails não caírem no spam: TXT `_dmarc` com
  `v=DMARC1; p=none; rua=mailto:contato@gigachip.com.br`.

## Fase B — Banco e Asaas de verdade (no dia) [Sócios, eu acompanho]

- [ ] ⚠️ Painel → **Integrações**: se aparecer "Migração pendente", rodar no Supabase → SQL Editor
  os arquivos indicados, na ordem.
- [ ] ⚠️ Na conta **real** do Asaas (não o sandbox):
  - [ ] cadastrar a **chave PIX** da Gigachip (sem ela o QR Code não aparece);
  - [ ] Integrações → Chaves de API → **gerar chave** (não mandar no chat);
  - [ ] Integrações → Webhooks → **novo webhook**:
    - URL `https://SEU-DOMINIO/api/webhooks/asaas`;
    - token = uma senha nova, com 32 caracteres ou mais;
    - eventos de **Cobrança** marcados e fila ativa.
- [ ] ⚠️ Vercel → Environment Variables:
  - `ASAAS_API_URL` = `https://api.asaas.com/v3`
  - `ASAAS_API_KEY` = a chave real
  - `ASAAS_WEBHOOK_TOKEN` = o token do webhook real
  - `APP_URL` = `https://gigachip.com.br` (se o domínio já estiver ligado)
- [ ] ⚠️ Conferir em Painel → Integrações: Asaas em **"Produção — cobranças reais"**.

## Fase C — Publicar, limpar os testes e ligar a planilha verdadeira (no dia)

- [ ] ⚠️ **[Claude]** Publicar a versão aprovada na Fase 0 (o site e o painel novos entram no ar).
- [ ] ⚠️ Supabase → SQL Editor → rodar **`scripts/supabase/limpar-dados-de-teste.sql`**:
  - apaga pedidos, clientes e linhas de teste;
  - mantém a equipe, os planos e o valor do gestor;
  - os pedidos voltam a começar do **#1**;
  - no final deve mostrar 0 pedidos, 0 clientes e 0 linhas.
- [ ] ⚠️ Compartilhar a **planilha verdadeira** do gestor com o e-mail do robô como **Editor**
  (o e-mail aparece em Integrações).
- [ ] ⚠️ Painel → Configurações → colar o **link da planilha verdadeira** → Salvar.
- [ ] Painel → Configurações → conferir **Nomes das colunas**, **O que escrever** e **Regras**
  (de fábrica já vem: Gestor → "Gestor Ativo"; nome vermelho no bloqueio e preto no desbloqueio).
- [ ] ⚠️ Painel → Integrações → **Testar planilha**: todas as colunas achadas, nenhum aviso de
  coluna faltando, contagem de números certa.
- [ ] ⚠️ Painel → Linhas → **Ler planilha agora** → conferir os números disponíveis.
- [ ] Se o domínio mudou: atualizar a rotina de 10 minutos (Supabase → SQL Editor →
  `scripts/supabase/agendar-rotinas.sql` com a URL nova e o mesmo CRON_SECRET).
- [ ] ⚠️ Vercel → **Redeploy** (para valer tudo o que foi trocado).

## Fase D — Primeira venda de verdade (no dia)

- [ ] Um de vocês compra o plano mais barato com **cartão ou PIX de verdade** e segue o fluxo
  inteiro (D28):
  1. pagamento → e-mail de confirmação;
  2. formulário de ativação: **print do registro do eSIM** ou **foto do verso do chip**;
  3. contrato no e-mail (documento + selfie);
  4. botão do WhatsApp;
  5. ativar na Vivo → Painel → **"Ativar linha"**;
  6. conferir a planilha (linha preenchida e Gestor = "Gestor Ativo");
  7. e-mail "Sua linha está ativa".
- [ ] No Asaas real, conferir a cobrança paga e a **assinatura mensal** criada.
- [ ] Se quiser, estornar essa primeira cobrança no Asaas (o painel registra o estorno).

## Fase E — Segurança (no dia ou logo depois) [Sócios]

- [ ] Cada pessoa da equipe com **login próprio** e **2FA** (Painel → Equipe). Ninguém compartilha senha.
- [ ] Vercel: apagar `ADMIN_SETUP_TOKEN` (só servia para criar o primeiro acesso).
- [ ] Trocar senhas e chaves que já apareceram em prints ou conversas.
- [ ] Guardar num cofre de senhas (ex.: Bitwarden): chaves do Asaas, D4Sign, Resend e Google
  (arquivo do robô), CRON_SECRET e senha do banco.

---

## Depois do lançamento — rotina

| Quando | O quê | Onde |
|--------|-------|------|
| Todo dia | Pedidos **Prontos para ativar** → ativar na Vivo → "Ativar linha" | Painel → Pedidos |
| Todo dia (manhã) | **Bloquear na Vivo** (sem pagamento) / **Desbloquear** (pagou, até 24 h) | Painel → Inadimplência |
| Quando o estoque acabar | Gestor coloca números na planilha com "Disponível" | Planilha |
| Se o gestor mudar a planilha | Ajustar nomes das colunas, o que escrever e as regras | Painel → Configurações |
| Se algo travar | Me chamar com print da tela (sem dados de clientes) e dos Logs da Vercel | — |

## Depois (2ª fase)

- Área do Cliente com **faturas** (2ª via, histórico de pagamentos).
- Botão "Remover acesso" da equipe, se não entrar na Fase 0.
