# Pedido para o Lovable — visual do site Gigachip (só maquete)

Copie tudo a partir da linha abaixo e cole no Lovable.

---

Quero criar **apenas o visual (front-end estático)** do site da **Gigachip**, uma empresa que vende linhas de celular na rede Vivo pela internet.

## REGRAS IMPORTANTES (não quebrar)
- **Somente telas visuais.** NÃO conectar Supabase, NÃO criar banco de dados, NÃO criar login, NÃO criar backend/edge functions, NÃO integrar pagamento, NÃO enviar formulários para lugar nenhum. Os botões só navegam entre as telas.
- Os dados dos planos ficam fixos num arquivo `src/data/planos.ts`.
- Usar **React + Tailwind**. Componentes simples, sem bibliotecas pesadas de animação (animações em CSS).
- Tudo em **português do Brasil**. Pensado primeiro para **celular** (a maioria dos clientes usa celular), e bonito no computador.
- Não pode parecer "site feito por IA": nada de brilho neon em tudo, degradê em tudo, ícones flutuando, ilustração genérica. Visual **clean, moderno e profissional**, com bastante espaço em branco.

## IDENTIDADE VISUAL
- Logo: círculo preto com o "G" e o texto GIGACHIP em degradê azul → verde (vou enviar a imagem).
- Cores: **preto** `#04070D`, **branco**, cinza claro `#F6F6F3` para fundos de seção, e **azul da logo** `#01BAFE` como cor de destaque (versão mais escura `#0284C7` quando houver texto branco em cima).
- Fonte: **Poppins** (títulos em peso 700, textos em 400).
- Botões em formato de pílula (bem arredondados).
- Referências de estilo que eu gosto: associadofederal.com (topo escuro com chip em 3D, faixa rolando com frases curtas, cartões brancos arredondados, "como funciona" com números grandes apagados ao fundo) e postudo.com.br (títulos grandes e fortes, menu em pílula flutuante).

## TELAS

### 1. Início (`/`)
- **Menu** fixo no topo: logo à esquerda; "Como funciona", "Planos" (abre lista com os 3 planos), "Dúvidas"; botão "Ver planos" à direita. No celular, ícone ☰ abrindo um painel.
- **Topo**: etiqueta "Na rede Vivo · sem fidelidade"; título "Internet que dura o mês inteiro." (destaque em "o mês inteiro"); texto "Planos de 200GB a 400GB com ligações ilimitadas. Contrate pelo celular em poucos minutos, sem fidelidade e sem papelada."; botões "Ver planos" e "Como funciona"; selos "PIX ou cartão", "eSIM ou chip físico", "Contrato digital". Ao lado, uma imagem/ilustração do produto (celular mostrando "228 GB restantes, renova dia 20").
- **Números**: "até 400GB de internet por mês" · "Ligações ilimitadas" · "Zero fidelidade ou multa" · "100% online".
- **Planos** (3 cartões, o do meio em destaque "Mais escolhido"):
  - Plano 200GB — 100GB + 100GB de bônus todo mês — **R$ 124,99/mês**
  - Plano 300GB — 200GB + 100GB de bônus todo mês — **R$ 149,99/mês**
  - Plano 400GB — 300GB + 100GB de bônus todo mês — **R$ 179,99/mês**
  - Todos: "Ligações ilimitadas", "Bônus de 100GB renovado todo mês", "Sem fidelidade", "Rede Vivo". Botão "Quero este plano" e link "Ver detalhes".
- **Como funciona** (5 passos): 1 Escolha o plano · 2 Cadastre-se e pague (PIX ou cartão) · 3 Envie o ID do celular (print do *#06#) · 4 Assine o contrato (pelo e-mail, com documento e selfie) · 5 Linha ativada (você recebe o número por e-mail).
- **Dúvidas** (acordeão): A Gigachip é a Vivo? (Não, é parceira comercial; as linhas funcionam na rede Vivo) · Tem fidelidade? (Não) · Como pago? (PIX ou cartão; vence todo mês no dia da compra) · Se eu atrasar? (bloqueio no dia seguinte ao vencimento, desbloqueio após pagar) · eSIM ou chip físico? · Posso escolher o número? (Não, a equipe define na ativação).
- **Chamada final**: "Chega de ficar sem internet no fim do mês." + botão "Escolher meu plano".
- **Rodapé**: logo, "Empresa independente, parceira comercial da operadora Vivo. Este não é o site oficial da Vivo.", links (Planos, Perguntas frequentes, Termos, Privacidade), contato@gigachip.com.br, CNPJ 51.968.628/0001-16.
- Botão do WhatsApp flutuando no canto.

### 2. Página do plano (`/planos/300gb`)
Detalhes do plano escolhido, lista de benefícios, "Como contratar" em 4 passos e um quadro fixo com preço e botão "Contratar".

### 3. Cadastro (`/contratar/300gb`)
Resumo do plano no topo. Campos: Nome completo, CPF, Data de nascimento, E-mail, Celular para contato (WhatsApp). Escolha do tipo: **eSIM** ou **Chip físico** (cartões selecionáveis). Pagamento: **PIX** ou **Cartão de crédito**. Caixas: "Li e aceito os Termos de uso" e "Li e aceito a Política de privacidade". Botão "Continuar para o pagamento".

### 4. Pagamento (`/pedido/pagamento`)
"Pedido GC-2026-00001 · Plano 300GB · R$ 149,99". Caixa com QR Code do PIX (imagem de exemplo), código "copia e cola" e botão "Copiar código". Indicador "Aguardando confirmação do pagamento…".

### 5. Parabéns (`/pedido/pago`)
"🎉 Parabéns! Sua linha foi contratada." + botão "Próximo passo: formulário de ativação".

### 6. Formulário de ativação (`/ativacao`)
3 passos em sequência, com o passo atual destacado e os seguintes bloqueados:
1. **Envie o ID do celular**: instrução "Digite *#06# no discador e tire um print"; botão "Abrir o app de ligação"; área para enviar o print; campos IMEI e EID (ou ICCID para chip físico); botão "Enviar dados do aparelho".
2. **Assine o contrato no seu e-mail**: "Enviamos o contrato pela D4Sign. Ela vai pedir uma foto do documento e uma selfie."
3. **Chame a gente no WhatsApp**: botão verde "Enviar dados e pedir ativação no WhatsApp".

### 7. Perguntas frequentes (`/perguntas-frequentes`)
Lista completa em acordeão.
