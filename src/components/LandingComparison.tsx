import React from 'react';
import { Check, X, Zap } from 'lucide-react';

export const LandingComparison: React.FC = () => {
  const comparisonRows = [
    {
      feature: 'Grabación de video del sorteo',
      sorteoo: 'Automática en formato vertical 9:16 nativo (1080×1920)',
      traditional: 'Requiere grabar la pantalla manualmente',
    },
    {
      feature: 'Privacidad durante la grabación',
      sorteoo: 'Solo captura la animación del sorteo (sin notificaciones privadas)',
      traditional: 'Expone notificaciones de WhatsApp y llamadas personales',
    },
    {
      feature: 'Persistencia del historial y videos',
      sorteoo: 'Guardado seguro en tu cuenta con acceso multidispositivo',
      traditional: 'Se pierde al cerrar la pestaña o recargar',
    },
    {
      feature: 'Certificado de transparencia',
      sorteoo: 'Firma criptográfica SHA-256 + Verificador público oficial',
      traditional: 'Captura estática sin mecanismo de verificación',
    },
    {
      feature: 'Exportación a Instagram Stories / Reels',
      sorteoo: 'Descarga universal compatible con iPhone, Android, Mac y Windows',
      traditional: 'Requiere recortar y editar el video a mano',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-white border-t border-neutral-100 w-full overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="text-xs font-black tracking-widest text-emerald-600 uppercase bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            Comparativa
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-neutral-900 tracking-tight mt-3">
            ¿Por qué elegir sorteoo.app?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600 leading-relaxed font-medium">
            Diseñamos sorteoo.app pensando en los problemas reales a los que se enfrentan los creadores de contenido cada semana.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-white border-2 border-neutral-200/90 rounded-3xl overflow-hidden shadow-xl shadow-neutral-200/40 w-full">
          <div className="grid grid-cols-12 bg-neutral-50/90 p-4 sm:p-5 border-b border-neutral-200 text-xs font-black text-neutral-700">
            <div className="col-span-5 sm:col-span-4 uppercase tracking-wider">Característica</div>
            <div className="col-span-7 sm:col-span-4 text-rose-600 flex items-center gap-1.5 font-black uppercase tracking-wider">
              <Zap className="w-4 h-4 fill-current text-amber-500" />
              <span>sorteoo.app</span>
            </div>
            <div className="hidden sm:block sm:col-span-4 text-neutral-400 font-bold uppercase tracking-wider">
              Otras plataformas
            </div>
          </div>

          <div className="divide-y divide-neutral-100">
            {comparisonRows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 p-4 sm:p-5 text-xs items-center hover:bg-neutral-50/60 transition-colors"
              >
                <div className="col-span-5 sm:col-span-4 font-bold text-neutral-900">
                  {row.feature}
                </div>
                <div className="col-span-7 sm:col-span-4 text-emerald-700 font-semibold flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span>{row.sorteoo}</span>
                </div>
                <div className="col-span-12 sm:col-span-4 text-neutral-500 font-medium flex items-start gap-2 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span>{row.traditional}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
