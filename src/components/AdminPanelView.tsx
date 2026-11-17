import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react';
import { AdminPaymentSettings, Coupon, PaymentOrder } from '../types/giveaway';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AdminPanelView: React.FC<{ onGoHome: () => void }> = ({ onGoHome }) => {
  const { user } = useAuth();
  const isAdmin =
    Boolean(user) &&
    (user!.role === 'admin' || user!.email.trim().toLowerCase() === 'admin@sorteoo.app');

  const [activeSubTab, setActiveSubTab] = useState<'coupons' | 'mercadopago' | 'payments'>('coupons');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Mercado Pago & Price state
  const [settings, setSettings] = useState<AdminPaymentSettings>({
    giveawayPrice: 5000,
    currency: 'ARS',
    hasAccessToken: false,
    accessTokenMasked: '',
    mpPublicKey: '',
  });
  const [mpAccessTokenInput, setMpAccessTokenInput] = useState('');
  const [mpPublicKeyInput, setMpPublicKeyInput] = useState('');
  const [priceInput, setPriceInput] = useState('5000');
  const [showToken, setShowToken] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Coupons state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newPercent, setNewPercent] = useState('100');
  const [newMaxUses, setNewMaxUses] = useState('1');
  const [newDescription, setNewDescription] = useState('');
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  // Payments state
  const [payments, setPayments] = useState<PaymentOrder[]>([]);

  const loadAllAdminData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [settingsRes, couponsRes, paymentsRes] = await Promise.all([
        api.getAdminSettings(),
        api.getAdminCoupons(),
        api.getAdminPayments(),
      ]);
      setSettings(settingsRes);
      setMpPublicKeyInput(settingsRes.mpPublicKey || '');
      setPriceInput(String(settingsRes.giveawayPrice ?? 5000));
      setCoupons(couponsRes.coupons || []);
      setPayments(paymentsRes.payments || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo cargar el panel de administración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAllAdminData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSavingSettings(true);
    try {
      const parsedPrice = Math.max(0, Math.round(Number(priceInput) || 0));
      const res = await api.updateAdminSettings({
        mpAccessToken: mpAccessTokenInput.trim() || undefined,
        mpPublicKey: mpPublicKeyInput.trim(),
        giveawayPrice: parsedPrice,
      });
      setSettings(res.settings);
      setMpAccessTokenInput('');
      setSuccessMsg('Claves de producción y precio guardados correctamente.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearAccessToken = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSavingSettings(true);
    try {
      const res = await api.updateAdminSettings({ clearToken: true });
      setSettings(res.settings);
      setSuccessMsg('Access Token eliminado.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar Access Token');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setCreatingCoupon(true);
    try {
      const res = await api.createAdminCoupon({
        code: newCode.trim().toUpperCase(),
        discountPercent: Number(newPercent),
        maxUses: Number(newMaxUses),
        description: newDescription.trim() || undefined,
      });
      setCoupons((prev) => [res.coupon, ...prev]);
      setNewCode('');
      setNewDescription('');
      setSuccessMsg(`Cupón ${res.coupon.code} (${res.coupon.discountPercent}%) creado.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear cupón');
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleToggleCoupon = async (coupon: Coupon) => {
    setErrorMsg(null);
    try {
      const res = await api.updateAdminCoupon(coupon.id, { active: !coupon.active });
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? res.coupon : c)));
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo actualizar el cupón');
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.deleteAdminCoupon(coupon.id);
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
      setSuccessMsg(
        `Cupón ${coupon.code} eliminado definitivamente. Quedó sin efecto y ya nadie podrá usarlo.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo eliminar el cupón');
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white border border-neutral-200 rounded-3xl p-8 space-y-4 shadow-sm">
          <ShieldCheck className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-xl font-black text-neutral-900">Acceso restringido</h1>
          <p className="text-sm text-neutral-600">
            Inicia sesión con la cuenta de administrador para gestionar Mercado Pago y cupones.
          </p>
          <button
            type="button"
            onClick={onGoHome}
            className="px-5 py-2.5 bg-neutral-900 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const activeCouponsCount = coupons.filter((c) => c.active && c.usedCount < c.maxUses).length;
  const approvedPayments = payments.filter((p) => p.status === 'approved');
  const totalRevenue = approvedPayments.reduce((acc, p) => acc + (p.finalAmount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header & Unboxed Summary Metrics */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            Panel de Administración
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 font-medium tabular-nums">
            <span>Valor actual: ${settings.giveawayPrice.toLocaleString('es-AR')} ARS</span>
            <span aria-hidden="true">·</span>
            <span>
              Mercado Pago: {settings.hasAccessToken ? 'Producción activa' : 'Pendiente de clave'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeCouponsCount} cupones disponibles</span>
            <span aria-hidden="true">·</span>
            <span>Recaudado: ${totalRevenue.toLocaleString('es-AR')} ARS</span>
          </div>
        </div>

        <button
          type="button"
          onClick={loadAllAdminData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 text-xs font-bold rounded-xl cursor-pointer shrink-0 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Sub-navigation Segmented Tabs */}
      <div className="inline-flex flex-wrap gap-1 p-1 bg-neutral-100 border border-neutral-200 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('coupons')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'coupons'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-rose-500" />
          <span>Cupones ({coupons.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('mercadopago')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'mercadopago'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-sky-600" />
          <span>Claves Mercado Pago</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('payments')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'payments'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
          <span>Pagos y Canjes ({payments.length})</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: COUPONS MANAGEMENT */}
      {activeSubTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create Coupon Form */}
          <form
            onSubmit={handleCreateCoupon}
            className="lg:col-span-4 bg-white border border-neutral-200 rounded-2xl p-5 space-y-4"
          >
            <div className="border-b border-neutral-100 pb-3">
              <h2 className="text-base font-black text-neutral-900">Crear nuevo cupón</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Los cupones del 100% permiten sortear directo sin ir a Mercado Pago.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Código del cupón
              </label>
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="EJ: INFLUENCER100"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-rose-500 focus:bg-white rounded-xl text-sm font-mono font-bold text-neutral-900 uppercase focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-neutral-700">Porcentaje de descuento</label>
                <div className="flex items-center gap-1">
                  {[25, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setNewPercent(String(pct))}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md border cursor-pointer ${
                        Number(newPercent) === pct
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                required
                min={1}
                max={100}
                value={newPercent}
                onChange={(e) => setNewPercent(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-rose-500 focus:bg-white rounded-xl text-sm font-mono font-bold text-neutral-900 focus:outline-none tabular-nums"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block tabular-nums">
                Valor final con este cupón:{' '}
                {Number(newPercent) >= 100
                  ? '$0 (Directo sin Mercado Pago)'
                  : `$${Math.max(
                      0,
                      settings.giveawayPrice -
                        Math.round((settings.giveawayPrice * (Number(newPercent) || 0)) / 100)
                    ).toLocaleString('es-AR')} ARS`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Cantidad máxima de usos
              </label>
              <input
                type="number"
                required
                min={1}
                max={100000}
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-rose-500 focus:bg-white rounded-xl text-sm font-mono font-bold text-neutral-900 focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Nota interna / Influencer (opcional)
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ej: Canje campaña noviembre"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-rose-500 focus:bg-white rounded-xl text-xs text-neutral-900 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={creatingCoupon}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 hover:from-red-600 hover:to-amber-600 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{creatingCoupon ? 'Creando...' : 'Crear cupón'}</span>
            </button>
          </form>

          {/* Coupons List Table */}
          <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-base font-black text-neutral-900">Cupones creados</h2>
              <span className="text-xs text-neutral-500 tabular-nums">{coupons.length} en total</span>
            </div>

            {coupons.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Tag className="w-8 h-8 text-neutral-300 mx-auto" />
                <p className="text-sm font-bold text-neutral-700">Todavía no creaste cupones</p>
                <p className="text-xs text-neutral-500">
                  Crea un código con 100% para influencers o descuentos parciales desde el formulario.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-bold">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4 text-right">Descuento</th>
                      <th className="py-3 px-4 text-right">Usos</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {coupons.map((c) => {
                      const exhausted = c.usedCount >= c.maxUses;
                      return (
                        <tr key={c.id} className="hover:bg-neutral-50/70">
                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-neutral-900 text-sm block">
                              {c.code}
                            </span>
                            {c.description && (
                              <span className="text-[11px] text-neutral-500 block">
                                {c.description}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span className="font-black text-neutral-900 block">
                              {c.discountPercent}%
                            </span>
                            <span className="text-[11px] text-neutral-500">
                              {c.discountPercent >= 100 ? 'Gratis sin MP' : 'Parcial'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-800 tabular-nums">
                            {c.usedCount} / {c.maxUses}
                          </td>
                          <td className="py-3 px-4">
                            {exhausted ? (
                              <span className="text-amber-700 font-bold">Agotado</span>
                            ) : c.active ? (
                              <span className="text-emerald-700 font-bold">Activo</span>
                            ) : (
                              <span className="text-neutral-500 font-semibold">Pausado</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleCoupon(c)}
                                title={c.active ? 'Pausar cupón' : 'Activar cupón'}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                              >
                                {c.active ? (
                                  <>
                                    <Pause className="w-3 h-3" />
                                    <span>Pausar</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3 text-emerald-600" />
                                    <span>Activar</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCoupon(c)}
                                title="Borrar cupón definitivamente"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Borrar</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MERCADO PAGO PRODUCTION SETTINGS */}
      {activeSubTab === 'mercadopago' && (
        <div className="max-w-2xl bg-white border border-neutral-200 rounded-2xl p-5 sm:p-7 space-y-5">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-lg font-black text-neutral-900">
              Claves de Producción de Mercado Pago
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Ingresa tus credenciales de Producción de Mercado Pago Developers para cobrar cada
              sorteo. El Access Token se guarda exclusivamente en el servidor.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-neutral-800">
                  Access Token de Producción
                </label>
                {settings.hasAccessToken && (
                  <span className="text-[11px] font-mono font-bold text-emerald-700">
                    Guardado: {settings.accessTokenMasked}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={mpAccessTokenInput}
                  onChange={(e) => setMpAccessTokenInput(e.target.value)}
                  placeholder={
                    settings.hasAccessToken
                      ? 'Ingresa un nuevo Access Token para reemplazar el actual'
                      : 'APP_USR-0000000000000000-...'
                  }
                  className="w-full pl-3.5 pr-11 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-sky-500 focus:bg-white rounded-xl text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Public Key de Producción (opcional)
              </label>
              <input
                type="text"
                value={mpPublicKeyInput}
                onChange={(e) => setMpPublicKeyInput(e.target.value)}
                placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-sky-500 focus:bg-white rounded-xl text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Valor base por sorteo (ARS)
              </label>
              <input
                type="number"
                min={0}
                required
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-full max-w-xs px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 focus:border-sky-500 focus:bg-white rounded-xl text-sm font-mono font-bold text-neutral-900 focus:outline-none tabular-nums"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Por defecto: $5.000 ARS. Los cupones aplican porcentaje sobre este valor.
              </span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              {settings.hasAccessToken ? (
                <button
                  type="button"
                  onClick={handleClearAccessToken}
                  disabled={savingSettings}
                  className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl cursor-pointer"
                >
                  Quitar Access Token actual
                </button>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-3 bg-[#009EE3] hover:bg-[#0089C7] disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md cursor-pointer"
              >
                {savingSettings ? 'Guardando...' : 'Guardar claves de producción'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: PAYMENTS & COUPON REDEMPTIONS HISTORY */}
      {activeSubTab === 'payments' && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-base font-black text-neutral-900">Historial de pagos y canjes</h2>
            <span className="text-xs text-neutral-500 tabular-nums">
              {approvedPayments.length} aprobados
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CreditCard className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-sm font-bold text-neutral-700">Sin movimientos registrados</p>
              <p className="text-xs text-neutral-500">
                Aquí aparecerán los cobros por Mercado Pago y los canjes de cupones del 100%.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-bold">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Detalle</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4">Cupón</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50/70">
                      <td className="py-3 px-4 text-neutral-500 tabular-nums whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-neutral-800 font-medium max-w-xs truncate">
                        {p.giveawaySummary || p.userEmail || 'Sorteo certificado'}
                      </td>
                      <td className="py-3 px-4 text-neutral-700 font-semibold whitespace-nowrap">
                        {p.method === 'coupon_100' ? 'Cupón 100%' : 'Mercado Pago'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                        {p.couponCode || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums">
                        ${(p.finalAmount || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 font-bold whitespace-nowrap">
                        {p.status === 'approved' ? (
                          <span className="text-emerald-700">Aprobado</span>
                        ) : p.status === 'pending' ? (
                          <span className="text-amber-700">Pendiente</span>
                        ) : (
                          <span className="text-rose-600">{p.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
