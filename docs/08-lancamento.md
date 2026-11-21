# 08 — Roteiro de lançamento (sair do teste e vender de verdade)

Faça **na ordem**, de preferência num horário calmo (ex.: à noite). Leva umas 2 horas.
Marque cada item ao concluir. ⚠️ = obrigatório antes do primeiro cliente real.

---

## Fase A — Antes do dia (pode ir fazendo com calma)

- [ ] ⚠️ **Advogado aprova** o contrato (PDF de teste do painel), os **termos de uso** e a
      **política de privacidade**. Me mande os textos aprovados: eu coloco nas páginas `/termos` e
      `/privacidade` (hoje estão "em elaboração") e tiro a marca d'água "TESTE" do contrato.
- [ ] ⚠️ **Vercel Pro** (US$ 20/mês). O plano grátis (Hobby) **não pode ser usado para fins
      comerciais** pelas regras da Vercel.
- [ ] ⚠️ **Supabase Pro** (US$ 25/mês). O grátis **não tem backup diário** e **pausa o projeto** se
      ficar 1 semana sem uso. Com clientes reais, backup é indispensável.
- [ ] **WhatsApp:** número comprado → Vercel `NEXT_PUBLIC_WHATSAPP_NUMBER` (só números, com DDD,
      ex.: `88999999999`) → Redeploy. Libera o botão do último passo do formulário e entra nos contratos.
- [ ] **D4Sign:** pedir aumento do limite de 10 chamadas/hora e confirmar se o reconhecimento
      facial consome créditos do plano.
- [ ] **Domínio** `gigachip.com.br` apontando para a Vercel (com seu pai, no painel do domínio):
      Vercel → Settings → Domains → Add `gigachip.com.br` e `www.gigachip.com.br` → copiar os
      registros que ela mostrar para o DNS. **Não mexer** nos registros de e-mail (MX) nem nos do
      Resend.
- [ ] **E-mail (DMARC)**, para não cair no spam: no DNS, TXT `_dmarc` com
      `v=DMARC1; p=none; rua=mailto:contato@gigachip.com.br`.

## Fase B — Asaas de verdade (no dia)

- [ ] ⚠️ Na conta **real** do Asaas (não o sandbox):
  - [ ] cadastrar a **chave PIX** da Gigachip (sem ela o QR Code não aparece);
  - [ ] **Integrações → Chaves de API → gerar chave** (copiar; não mandar no chat);
  - [ ] **Integrações → Webhooks → novo webhook**: URL `https://SEU-DOMINIO/api/webhooks/asaas`,
        token = uma senha nova (32+ caracteres), eventos de **Cobrança** marcados, fila ativa.
- [ ] ⚠️ Vercel → Environment Variables:
  - `ASAAS_API_URL` = `https://api.asaas.com/v3`
  - `ASAAS_API_KEY` = a chave real
  - `ASAAS_WEBHOOK_TOKEN` = o token do webhook real
  - `APP_URL` = `https://gigachip.com.br` (se o domínio já estiver ligado)

## Fase C — Limpar os testes e ligar a planilha verdadeira (no dia)

- [ ] ⚠️ Supabase → SQL Editor → rodar **`scripts/supabase/limpar-dados-de-teste.sql`** (apaga
      pedidos/clientes/linhas de teste; mantém equipe, planos e valor do gestor; pedidos voltam a
      GC-AAAA-00001). O resultado final deve mostrar 0 pedidos, 0 clientes, 0 linhas.
- [ ] ⚠️ Compartilhar a **planilha verdadeira** do gestor com o e-mail do robô (Editor).
- [ ] ⚠️ Painel → Configurações → colar o **link da planilha verdadeira** → Salvar.
- [ ] ⚠️ Painel → Integrações → **Testar planilha** (conferir colunas e contagem) → Linhas →
      **Ler planilha agora**.
- [ ] Se o domínio mudou: atualizar a **rotina de 10 min** (Supabase → SQL Editor →
      `scripts/supabase/agendar-rotinas.sql` com a URL nova e o mesmo CRON_SECRET).
- [ ] ⚠️ Vercel → **Redeploy** (para valer tudo o que foi trocado).

## Fase D — Primeira venda de verdade (no dia)

- [ ] Você mesmo compra o plano mais barato com **seu cartão/PIX real** e segue o fluxo inteiro:
      pagamento → e-mail → print do *#06# → contrato com documento + selfie → WhatsApp →
      "Ativar linha" → planilha preenchida → e-mail "Sua linha está ativa".
- [ ] No Asaas real, conferir a cobrança paga e a **assinatura mensal** criada.
- [ ] Se quiser, estornar essa 1ª cobrança no Asaas (o painel registra o estorno).

## Fase E — Segurança (no dia ou logo depois)

- [ ] Cada pessoa da equipe com **login próprio** e **2FA** (Painel → Equipe). Ninguém compartilha senha.
- [ ] Vercel: apagar `ADMIN_SETUP_TOKEN` (só servia para criar o 1º acesso).
- [ ] Trocar senhas/chaves que já apareceram em prints ou conversas.
- [ ] Guardar num cofre de senhas (ex.: Bitwarden): chaves do Asaas, D4Sign, Resend, Google
      (arquivo do robô), CRON_SECRET e senha do banco.

---

## Depois do lançamento — rotina

| Quando | O quê | Onde |
|--------|-------|------|
| Todo dia | Pedidos **Prontos para ativação** → ativar na Vivo → "Ativar linha" | Painel → Visão geral |
| Todo dia (manhã) | **Bloquear linha — sem pagamento** / **Desbloquear — pagou** | Painel → Inadimplência |
| Quando o estoque acabar | Gestor coloca números na planilha (com "Disponível") | Planilha |
| Se algo travar | Me chamar com print da tela e dos Logs da Vercel | — |
