import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import {
  CouponValidationResult,
  GiveawayFilters,
  Participant,
  PostDetails,
} from '../types/giveaway';
import { api } from '../services/api';

export interface PendingDrawPayload {
  postUrl: string;
  postDetails: PostDetails;
  participants: Participant[];
  filters: GiveawayFilters;
  winnersCount: number;
  substitutesCount: number;
}

export const PENDING_CHECKOUT_STORAGE_KEY = 'sorteoo_pending_checkout';

interface CheckoutPaymentBoxProps {
  giveawaySummary: string;
  buildDrawConfig: () => PendingDrawPayload | null;
  onBack: () => void;
  onLaunchApprovedDraw: (config: PendingDrawPayload) => void;
}

export const CheckoutPaymentBox: React.FC<CheckoutPaymentBoxProps> = ({
  giveawaySummary,
  buildDrawConfig,
  onBack,
  onLaunchApprovedDraw,
}) => {
  const [basePrice, setBasePrice] = useState<number>(5000);
  const [mpConfigured, setMpConfigured] = useState<boolean>(true);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);

  const [couponInput, setCouponInput] = useState<string>('');
  const [validatingCoupon, setValidatingCoupon] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [processingAction, setProcessingAction] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [pendingMpOrder, setPendingMpOrder] = useState<{
    externalReference: string;
    initPoint: string;
    finalAmount: number;
  } | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    api
      .getPaymentConfig()
      .then((cfg) => {
        if (!mounted) return;
        if (typeof cfg.giveawayPrice === 'number') {
          setBasePrice(cfg.giveawayPrice);
        }
        setMpConfigured(Boolean(cfg.mpConfigured));
      })
      .catch(() => {
        // Default $5.000
      })
      .finally(() => {
        if (mounted) setLoadingConfig(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentBasePrice = appliedCoupon ? appliedCoupon.basePrice : basePrice;
  const finalAmount = appliedCoupon ? appliedCoupon.finalAmount : currentBasePrice;
  const isFreeWithCoupon = Boolean(appliedCoupon && appliedCoupon.finalAmount === 0);

  const formatARS = (amount: number) =>
    `$${Number(amount || 0).toLocaleString('es-AR')}`;

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = couponInput.trim().toUpperCase();
    if (!clean) {
      setCouponError('Ingresa un código de cupón');
      return;
    }
    setCouponError(null);
    setCheckoutError(null);
    setValidatingCoupon(true);
    try {
      const res = await api.validateCoupon(clean);
      setAppliedCoupon(res);
      setCouponInput(res.code);
      setPendingMpOrder(null);
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'Cupón inválido o agotado');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
    setCheckoutError(null);
    setPendingMpOrder(null);
  };

  const handleRedeemFreeAndStart = async () => {
    if (!appliedCoupon || !isFreeWithCoupon) return;
    const drawConfig = buildDrawConfig();
    if (!drawConfig) return;

    setCheckoutError(null);
    setProcessingAction(true);
    try {
      await api.redeemFreeCoupon(appliedCoupon.code, giveawaySummary);
      onLaunchApprovedDraw(drawConfig);
    } catch (err: any) {
      setCheckoutError(err.message || 'No se pudo canjear el cupón');
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePayWithMercadoPago = async () => {
    const drawConfig = buildDrawConfig();
    if (!drawConfig) return;

    setCheckoutError(null);
    setProcessingAction(true);
    try {
      const returnUrl = window.location.origin + window.location.pathname;
      const pref = await api.createMercadoPagoPreference({
        couponCode: appliedCoupon?.code,
        returnUrl,
        giveawaySummary,
        drawConfig,
      });

      try {
        localStorage.setItem(
          PENDING_CHECKOUT_STORAGE_KEY,
          JSON.stringify({
            externalReference: pref.externalReference,
            savedAt: Date.now(),
            drawConfig,
          })
        );
      } catch {
        // Server fallback already persisted drawConfig by externalReference
      }

      setPendingMpOrder({
        externalReference: pref.externalReference,
        initPoint: pref.initPoint,
        finalAmount: pref.finalAmount,
      });

      // Navigate cleanly (top window if embedded inside an iframe)
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = pref.initPoint;
        } else {
          window.location.href = pref.initPoint;
        }
      } catch {
        // Cross-origin frame restriction: fallback button stays visible right below
      }
    } catch (err: any) {
      setCheckoutError(
        err.message || 'No se pudo iniciar el pago con Mercado Pago. Intenta nuevamente.'
      );
    } finally {
      setProcessingAction(false);
    }
  };

  const handleVerifyPendingOrder = async () => {
    if (!pendingMpOrder) return;
    setVerifyingPayment(true);
    setCheckoutError(null);
    try {
      const statusRes = await api.getPaymentStatus(pendingMpOrder.externalReference);
      if (statusRes.approved) {
        const configToLaunch = statusRes.drawConfig || buildDrawConfig();
        try {
          localStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
        } catch {
          // ignore
        }
        if (configToLaunch) {
          onLaunchApprovedDraw(configToLaunch);
        }
      } else {
        setCheckoutError(
          'El pago todavía figura pendiente en Mercado Pago. Completa el checkout y vuelve a verificar.'
        );
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Error al verificar estado del pago');
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <div className="space-y-4 pt-3 border-t border-neutral-100">
      {/* Payment & Coupon Summary Card */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
              Último paso · Pago del sorteo
            </span>
            <h3 className="text-sm sm:text-base font-black text-neutral-900">
              Resumen y cupón de descuento
            </h3>
          </div>
          <div className="text-right tabular-nums">
            <span className="text-[11px] text-neutral-500 block">Total a abonar</span>
            <span
              className={`text-xl sm:text-2xl font-black ${
                isFreeWithCoupon ? 'text-emerald-600' : 'text-neutral-900'
              }`}
            >
              {loadingConfig ? '...' : formatARS(finalAmount)}
            </span>
          </div>
        </div>

        {/* Line-item breakdown */}
        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-neutral-700">
            <span>Sorteo oficial + Video 9:16 + Certificado</span>
            <span className="font-bold tabular-nums">{formatARS(currentBasePrice)}</span>
          </div>

          {appliedCoupon && (
            <div className="flex items-center justify-between text-emerald-700 font-semibold">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>
                  Cupón {appliedCoupon.code} ({appliedCoupon.discountPercent}% OFF)
                </span>
              </span>
              <span className="tabular-nums">-{formatARS(appliedCoupon.discountAmount)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-sm font-black text-neutral-900">
            <span>Total final</span>
            <span className={`tabular-nums ${isFreeWithCoupon ? 'text-emerald-600' : ''}`}>
              {formatARS(finalAmount)}
            </span>
          </div>
        </div>

        {/* Coupon Input */}
        {!appliedCoupon ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 block">
              ¿Tenés un cupón de descuento?
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                  placeholder="Ingresa tu código de cupón"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-neutral-300 focus:border-rose-500 rounded-xl text-neutral-900 text-xs sm:text-sm font-mono font-bold uppercase placeholder:normal-case placeholder:font-sans placeholder-neutral-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => handleApplyCoupon()}
                disabled={validatingCoupon || !couponInput.trim()}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                {validatingCoupon ? 'Validando...' : 'Aplicar cupón'}
              </button>
            </div>
            {couponError && (
              <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{couponError}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-bold min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">
                Cupón <span className="font-mono">{appliedCoupon.code}</span> aplicado (
                {appliedCoupon.discountPercent}% de descuento)
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 border border-emerald-200 text-neutral-700 font-bold rounded-lg text-[11px] cursor-pointer shrink-0"
            >
              <X className="w-3 h-3" />
              <span>Quitar</span>
            </button>
          </div>
        )}

        {/* Free 100% coupon notice */}
        {isFreeWithCoupon && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              ¡Descuento del 100% aplicado! No necesitás pasar por Mercado Pago, podés comenzar el
              sorteo directamente.
            </span>
          </div>
        )}

        {/* MP not configured warning (only when payment > 0) */}
        {!loadingConfig && !isFreeWithCoupon && !mpConfigured && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Mercado Pago todavía no está configurado en el panel de administración. Si tenés un
              cupón del 100%, aplicalo arriba para sortear directo.
            </span>
          </div>
        )}

        {/* Checkout Error */}
        {checkoutError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        {/* Fallback direct link & manual verification when preference created */}
        {pendingMpOrder && !isFreeWithCoupon && (
          <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-2.5">
            <p className="text-xs font-bold text-sky-900">
              Checkout de Mercado Pago generado ({formatARS(pendingMpOrder.finalAmount)}):
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={pendingMpOrder.initPoint}
                target="_top"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#009EE3] hover:bg-[#0089C7] text-white text-xs font-black rounded-xl transition-colors text-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Mercado Pago</span>
              </a>
              <button
                type="button"
                onClick={handleVerifyPendingOrder}
                disabled={verifyingPayment}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-neutral-50 border border-sky-300 text-sky-900 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verifyingPayment ? 'animate-spin' : ''}`} />
                <span>{verifyingPayment ? 'Verificando...' : 'Ya aboné — Verificar pago'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={processingAction}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Atrás</span>
        </button>

        {isFreeWithCoupon ? (
          <button
            type="button"
            onClick={handleRedeemFreeAndStart}
            disabled={processingAction}
            className="w-full sm:w-auto min-w-[280px] sm:min-w-[340px] flex items-center justify-center gap-3 py-4 sm:py-5 px-8 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:via-rose-600 hover:to-amber-600 disabled:opacity-60 text-white text-base sm:text-lg font-black rounded-full shadow-2xl shadow-rose-500/30 ring-4 ring-rose-500/20 hover:ring-rose-400/50 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer uppercase tracking-wider"
          >
            <Play className="w-5 h-5 fill-current text-white shrink-0" />
            <span>{processingAction ? 'ACTIVANDO...' : 'COMENZAR SORTEOO'}</span>
            <Sparkles className="w-5 h-5 text-amber-200 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePayWithMercadoPago}
            disabled={processingAction || loadingConfig || !mpConfigured}
            className="w-full sm:w-auto min-w-[280px] sm:min-w-[340px] flex items-center justify-center gap-2.5 py-4 sm:py-5 px-8 bg-[#009EE3] hover:bg-[#0089C7] disabled:opacity-50 text-white text-sm sm:text-base font-black rounded-full shadow-xl shadow-sky-500/25 ring-4 ring-sky-500/15 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer tracking-wide"
          >
            <CreditCard className="w-5 h-5 text-white shrink-0" />
            <span>
              {processingAction
                ? 'CONECTANDO...'
                : `PAGAR ${formatARS(finalAmount)} CON MERCADO PAGO`}
            </span>
            <ShieldCheck className="w-5 h-5 text-sky-100 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};
