import { IconCheck } from "./icons";

/** Celular mostrando o uso da internet (o produto de verdade, no lugar de ilustração genérica). */
export function PhoneMock() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]" aria-hidden>
      <div className="rounded-[46px] bg-ink p-2.5 shadow-[0_40px_80px_-30px_rgb(4_7_13/0.45)]">
        <div className="overflow-hidden rounded-[38px] bg-[#fbfbf9]">
          <div className="flex items-center justify-between px-6 pb-2 pt-4 text-[11px] font-semibold text-ink">
            <span>9:41</span>
            <span className="h-5 w-20 rounded-full bg-ink" />
            <span>5G</span>
          </div>
          <div className="space-y-3 px-4 pb-6 pt-3">
            <p className="px-1 text-xs text-ink/50">Olá, Ana</p>
            <div className="rounded-3xl bg-white p-5 ring-1 ring-ink/[0.07]">
              <p className="text-xs font-medium text-ink/50">Internet do mês</p>
              <p className="font-heading mt-1 text-3xl font-extrabold text-ink">
                228<span className="ml-1 text-base font-bold text-ink/40">GB restantes</span>
              </p>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
                <div className="h-full w-[76%] rounded-full bg-ink" />
              </div>
              <p className="mt-2 flex justify-between text-[11px] text-ink/50">
                <span>72GB usados de 300GB</span>
                <span>renova dia 20</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white p-4 ring-1 ring-ink/[0.07]">
                <p className="text-[11px] text-ink/50">Ligações</p>
                <p className="mt-1 font-bold text-ink">Ilimitadas</p>
              </div>
              <div className="rounded-3xl bg-neon-lime p-4">
                <p className="text-[11px] text-ink/60">Bônus</p>
                <p className="mt-1 font-bold text-ink">+100GB</p>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-4 ring-1 ring-ink/[0.07]">
              <p className="text-[11px] text-ink/50">Próxima mensalidade</p>
              <p className="mt-1 flex items-center justify-between font-bold text-ink">
                R$ 149,99 <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold text-ink/60">PIX</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* aviso que chega por e-mail */}
      <div className="absolute -bottom-6 -left-16 hidden w-56 items-start gap-3 rounded-2xl bg-white p-3.5 shadow-[0_20px_40px_-16px_rgb(4_7_13/0.3)] ring-1 ring-ink/[0.07] sm:flex">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-neon-lime text-ink"><IconCheck className="h-4 w-4" /></span>
        <span className="text-xs leading-snug text-ink/70"><strong className="block text-sm text-ink">Linha ativada</strong>Seu número chegou no e-mail.</span>
      </div>
    </div>
  );
}
