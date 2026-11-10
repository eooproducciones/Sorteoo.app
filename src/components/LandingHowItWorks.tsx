import React from 'react';
import { LinkIcon, Sliders, Play, Download } from 'lucide-react';

export const LandingHowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      icon: <LinkIcon className="w-5 h-5 text-rose-500" />,
      title: 'Elegí cómo sortear',
      description:
        'Seleccioná tu modalidad favorita: Sorteo Multimarcas, por usuario, enlace directo, lista de nombres, números o archivo CSV.',
    },
    {
      num: '02',
      icon: <Sliders className="w-5 h-5 text-purple-500" />,
      title: 'Configurá tus premios y reglas',
      description:
        'Definí la cantidad de ganadores, marcas participantes, suplentes de reserva y filtros opcionales como menciones mínimas.',
    },
    {
      num: '03',
      icon: <Play className="w-5 h-5 text-amber-500" />,
      title: 'Hacé clic en Sortear',
      description:
        'La animación visual en vertical 9:16 se genera automáticamente con ruleta, revelación individual de cada ganador y lista oficial.',
    },
    {
      num: '04',
      icon: <Download className="w-5 h-5 text-emerald-500" />,
      title: 'Descargá y publicá tu video',
      description:
        'Descargá el archivo de video en alta definición compatible con cualquier celular y compartilo directo en Stories o Reels con tu certificado oficial.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-[#F8F9FC] border-t border-neutral-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-black tracking-widest text-purple-600 uppercase bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
            Paso a paso
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight mt-3">
            Cómo funciona sorteoo.app
          </h2>
          <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
            Un flujo súper simple y rápido para realizar sorteos transparentes y alegres en menos de 2 minutos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="bg-white border border-neutral-200/80 rounded-3xl p-6 relative flex flex-col justify-between shadow-xs hover:shadow-xl transition-all hover:-translate-y-1 group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-neutral-50 border border-neutral-200 shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                    {s.icon}
                  </div>
                  <span className="font-mono text-2xl font-black text-neutral-300 group-hover:text-rose-400 transition-colors">
                    {s.num}
                  </span>
                </div>
                <h3 className="text-base font-black text-neutral-900 mb-2">{s.title}</h3>
                <p className="text-xs text-neutral-600 leading-relaxed font-medium">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
