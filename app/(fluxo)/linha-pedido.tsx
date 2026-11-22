/* eslint-disable @next/next/no-img-element -- logo pequena e estática */

/** Linha discreta com o pedido (no lugar do cartão azul do resumo depois da 1ª etapa). */
export function LinhaPedido({ texto }: { texto: string }) {
  return (
    <p className="ck-orderline">
      <img src="/vivo-logo.png" alt="Rede Vivo" width={52} height={16} />
      <span>{texto}</span>
    </p>
  );
}
