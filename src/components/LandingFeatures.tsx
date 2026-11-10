import React from 'react';
import {
  Video,
  ShieldCheck,
  Filter,
  Instagram,
  Database,
  Sliders,
  Layers,
} from 'lucide-react';

export const LandingFeatures: React.FC = () => {
  const features = [
    {
      icon: <Video className="w-6 h-6 text-rose-500" />,
      title: 'Grabación Automática 9:16',
      description:
        'Al hacer clic en Sortear, la plataforma graba la animación completa en resolución vertical de 1080×1920. Sin botones adicionales ni software externo.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
      title: 'Verificador Criptográfico Real',
      description:
        'Selección con PRNG seguro Web Crypto, generación de código único y hash SHA-256 inmutable. Los resultados son fijos y verificables por cualquier usuario.',
    },
    {
      icon: <Filter className="w-6 h-6 text-purple-500" />,
      title: 'Filtros Profesionales de Comentarios',
      description:
        'Exige menciones mínimas (@amigos), elimina usuarios duplicados para dar 1 chance por persona, o filtra por palabras clave y hashtags.',
    },
    {
      icon: <Layers className="w-6 h-6 text-rose-500" />,
      title: 'Sorteos Multimarcas',
      description:
        'Unificá participantes de varias publicaciones o historias de marcas con historial persistente (>24h) y regla estricta de 1 participación por persona.',
    },
    {
      icon: <Instagram className="w-6 h-6 text-pink-500" />,
      title: 'Listo para Stories y Reels',
      description:
        'Descarga el archivo de video vertical o compártelo al instante a través de Web Share API en iOS y Android sin marcas de agua molestas.',
    },
    {
      icon: <Database className="w-6 h-6 text-amber-500" />,
      title: 'Historial y Videos en la Nube',
      description:
        'Cada sorteo se almacena en tu cuenta personal. Consulta certificados, ganadores y descarga nuevamente tus videos desde cualquier navegador.',
    },
    {
      icon: <Sliders className="w-6 h-6 text-cyan-500" />,
      title: 'Ganadores Múltiples y Suplentes',
      description:
        'Asigna tantos ganadores como premios tengas y configura suplentes de reserva en orden prioritario para máxima transparencia.',
    },
  ];

  return (
    <section className="py-20 bg-white border-t border-neutral-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-black tracking-widest text-rose-500 uppercase bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
            Ventajas competitivas
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight mt-3">
            La plataforma definitiva para creadores y marcas
          </h2>
          <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
            Diseñada para ofrecer entretenimiento visual, fiabilidad técnica absoluta y máxima comodidad para compartir en redes sociales.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="bg-neutral-50/80 border border-neutral-200/80 hover:border-rose-300 hover:bg-white rounded-3xl p-6 transition-all hover:shadow-xl hover:shadow-rose-500/5 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-xs flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                {feat.icon}
              </div>
              <h3 className="text-base font-black text-neutral-900 mb-2">{feat.title}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed font-medium">{feat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
