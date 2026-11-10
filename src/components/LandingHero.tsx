import React from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  AtSign,
  Link as LinkIcon,
  FileText,
  Hash,
  FileSpreadsheet,
} from 'lucide-react';

interface LandingHeroProps {
  onStartGiveaway: (initialQuery?: string) => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onStartGiveaway }) => {
  const modalities = [
    { label: 'Sorteo Multimarcas', icon: <Layers className="w-3.5 h-3.5 text-rose-500" /> },
    { label: 'Por usuario', icon: <AtSign className="w-3.5 h-3.5 text-pink-500" /> },
    { label: 'Por enlace', icon: <LinkIcon className="w-3.5 h-3.5 text-purple-500" /> },
    { label: 'Lista de nombres', icon: <FileText className="w-3.5 h-3.5 text-amber-500" /> },
    { label: 'Por números', icon: <Hash className="w-3.5 h-3.5 text-orange-500" /> },
    { label: 'Archivo CSV', icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> },
  ];

  return (
    <section className="relative pt-6 pb-16 md:pt-14 md:pb-24 w-full max-w-full overflow-hidden bg-white">
      {/* Background soft ambient cheerful glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[420px] bg-gradient-to-b from-rose-100/40 via-amber-50/30 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Headline, Modalities Slash & Big SORTEAR CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Tag / Badge: Sorteos Certificados */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 border border-rose-200/80 rounded-full text-xs font-black text-rose-600 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500 fill-current" />
              <span>Sorteos Certificados</span>
            </div>

            {/* Main Title: Hace tu sorteo, facil y rapido */}
            <h1 className="text-4xl sm:text-6xl lg:text-6xl font-black text-neutral-900 tracking-tight leading-[1.12] text-balance">
              Hacé tu sorteo,{' '}
              <span className="bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] bg-clip-text text-transparent">
                fácil y rápido
              </span>
              .
            </h1>

            {/* Options Animation: Continuous Running Marquee without slashes */}
            <div className="pt-1 space-y-2 max-w-full overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#DD2A7B] animate-pulse" />
                  Elegí cómo querés sortear:
                </p>
              </div>

              {/* Running Animated Ribbon */}
              <div
                className="relative w-full overflow-hidden py-2 bg-gradient-to-r from-neutral-50 via-rose-50/30 to-amber-50/30 rounded-2xl border border-neutral-200/90 shadow-xs"
                style={{
                  maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
                }}
              >
                <div className="animate-marquee flex items-center gap-3 select-none">
                  {/* First repetition */}
                  {modalities.map((item) => (
                    <button
                      key={`m1-${item.label}`}
                      type="button"
                      onClick={() => onStartGiveaway()}
                      className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white hover:bg-gradient-to-r hover:from-amber-50 hover:to-rose-50 border-2 border-neutral-200 hover:border-[#DD2A7B] text-xs sm:text-sm font-black text-neutral-800 hover:text-[#DD2A7B] transition-all cursor-pointer shadow-xs shrink-0 active:scale-95 group"
                    >
                      <span className="p-1 rounded-full bg-neutral-100 group-hover:bg-gradient-to-tr group-hover:from-[#F58529] group-hover:via-[#DD2A7B] group-hover:to-[#8134AF] group-hover:text-white transition-all">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                  {/* Second repetition for continuous smooth loop */}
                  {modalities.map((item) => (
                    <button
                      key={`m2-${item.label}`}
                      type="button"
                      onClick={() => onStartGiveaway()}
                      className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white hover:bg-gradient-to-r hover:from-amber-50 hover:to-rose-50 border-2 border-neutral-200 hover:border-[#DD2A7B] text-xs sm:text-sm font-black text-neutral-800 hover:text-[#DD2A7B] transition-all cursor-pointer shadow-xs shrink-0 active:scale-95 group"
                    >
                      <span className="p-1 rounded-full bg-neutral-100 group-hover:bg-gradient-to-tr group-hover:from-[#F58529] group-hover:via-[#DD2A7B] group-hover:to-[#8134AF] group-hover:text-white transition-all">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main CTA: Big SORTEAR Button with Instagram Sunset Gradient */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                type="button"
                onClick={() => onStartGiveaway()}
                className="w-full sm:w-auto px-14 py-5 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-95 text-white font-black text-lg sm:text-xl rounded-2xl shadow-xl shadow-[#DD2A7B]/30 ring-4 ring-[#DD2A7B]/20 hover:ring-[#DD2A7B]/40 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 cursor-pointer uppercase tracking-wider"
              >
                <span>SORTEAR</span>
                <ArrowRight className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            {/* Trust Line: Sin suscripciones. Sin loguearte. Sin esperas. Verificador oficial. (All with green check icon) */}
            <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1.5 text-xs font-bold text-neutral-700">
              <span className="inline-flex items-center gap-1.5 text-neutral-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Sin suscripciones</span>
              </span>
              <span className="text-neutral-300">·</span>
              <span className="inline-flex items-center gap-1.5 text-neutral-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Sin loguearte</span>
              </span>
              <span className="text-neutral-300">·</span>
              <span className="inline-flex items-center gap-1.5 text-neutral-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Sin esperas</span>
              </span>
              <span className="text-neutral-300">·</span>
              <span className="inline-flex items-center gap-1.5 text-neutral-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Verificador oficial</span>
              </span>
            </div>

            {/* Enclosed rounded box for key stats to avoid visual clutter */}
            <div className="mt-5 p-4 sm:p-5 rounded-3xl bg-neutral-50/90 border border-neutral-200/90 shadow-xs max-w-lg mx-auto lg:mx-0">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="space-y-0.5">
                  <span className="block text-2xl sm:text-3xl font-black bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
                    100%
                  </span>
                  <span className="text-xs font-bold text-neutral-600 block leading-tight">
                    Auditado y certificado
                  </span>
                </div>
                <div className="space-y-0.5 border-x border-neutral-200/80 px-2">
                  <span className="block text-2xl sm:text-3xl font-black bg-gradient-to-r from-rose-500 to-purple-500 bg-clip-text text-transparent">
                    9:16
                  </span>
                  <span className="text-xs font-bold text-neutral-600 block leading-tight">
                    Video Reels & Stories
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="block text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-500 to-amber-500 bg-clip-text text-transparent">
                    +1.4M
                  </span>
                  <span className="text-xs font-bold text-neutral-600 block leading-tight">
                    Comentarios sorteados
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Cheerful Sortealo-style Polaroid Showcase with Cartoon Gift Mascot */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <div className="relative w-full max-w-[340px] sm:max-w-[370px]">
              {/* Fun floating stickers (like competitor Sortealo style) */}
              <div className="absolute -top-4 -left-3 z-30 bg-white border-2 border-neutral-900 shadow-md rounded-2xl px-3 py-1.5 flex items-center gap-2 transform -rotate-6 animate-pulse">
                <span className="text-sm">🎁</span>
                <span className="text-xs font-black text-neutral-900 uppercase">
                  ¡Sorteo en vivo!
                </span>
              </div>

              <div className="absolute -bottom-3 -right-2 z-30 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg rounded-2xl px-3.5 py-1.5 flex items-center gap-1.5 transform rotate-3">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-black uppercase">Certificado Real</span>
              </div>

              {/* Main Cheerful Card */}
              <div className="bg-white rounded-3xl p-5 shadow-2xl shadow-neutral-300/50 border-2 border-neutral-200/90 relative overflow-hidden space-y-4">
                {/* Header with Cartoon Gift Mascot and Sorteoo Brand */}
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/assets/aistudio/Regalo_sonriente_con_lazo_y_destellos_f63477b8.png"
                      alt="Regalo feliz"
                      className="w-12 h-12 object-contain drop-shadow-md animate-bounce"
                    />
                    <div>
                      <span className="text-base font-black text-neutral-900 block leading-tight">
                        sorteoo<span className="text-rose-500">.app</span>
                      </span>
                      <span className="text-[11px] font-bold text-neutral-400 block">
                        Fácil, alegre y confiable
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 font-black text-[11px] border border-rose-200">
                    CERTIFICADO 🎁
                  </span>
                </div>

                {/* Simulated Post Card in Cheerful Style */}
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-800 p-4 text-white shadow-inner aspect-[4/3] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-rose-300">
                      Instagram Post
                    </span>
                    <span className="text-[11px] font-bold text-neutral-300">
                      @tu_emprendimiento
                    </span>
                  </div>

                  <div className="text-center py-2 space-y-1">
                    <span className="text-3xl block">🎉</span>
                    <strong className="text-base font-black text-white block">
                      ¡Gran Sorteo Multimarcas!
                    </strong>
                    <p className="text-xs text-neutral-300 line-clamp-1">
                      Mencioná a tus amigos para participar
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="bg-white/10 px-2 py-0.5 rounded-md text-emerald-400">
                      💬 1,450 comentarios
                    </span>
                    <span className="text-amber-400">
                      ❤️ 2,890 likes
                    </span>
                  </div>
                </div>

                {/* Sortealo-style Interactive Winner Selector Box */}
                <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-500 to-amber-500 text-white flex items-center justify-center text-sm font-black shadow-md">
                      👑
                    </div>
                    <div>
                      <span className="text-xs font-black text-neutral-900 block leading-tight">
                        ¿Cuántos ganadores?
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 block">
                        + Suplentes incluidos
                      </span>
                    </div>
                  </div>

                  <div className="px-3.5 py-1.5 rounded-xl bg-white border border-neutral-200 font-black text-neutral-900 text-sm shadow-xs">
                    x1
                  </div>
                </div>

                {/* Bottom Video Recording Feature Callout */}
                <div className="p-3 bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 rounded-2xl border border-rose-200/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="font-extrabold text-neutral-800">
                      Video vertical 9:16 automático
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-rose-600 bg-white px-2 py-0.5 rounded-md shadow-2xs border border-rose-200">
                    REELS & STORIES
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
