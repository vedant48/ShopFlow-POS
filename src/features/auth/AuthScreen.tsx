import React, { useState, useEffect } from 'react';
import { authService } from '../../auth/authService';
import type { TrustedShop } from '../../auth/authStore';
import {
  Store,
  User,
  Phone,
  Lock,
  ArrowRight,
  ShoppingBag,
  AlertCircle,
  Delete,
  WifiOff,
} from 'lucide-react';

type ScreenStep = 'returning_pin' | 'enter_phone' | 'enter_pin' | 'register';

export const AuthScreen: React.FC = () => {
  const [step, setStep] = useState<ScreenStep>('enter_phone');
  const [trustedShop, setTrustedShop] = useState<TrustedShop | null>(null);

  // Form states
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [foundShopName, setFoundShopName] = useState<string>('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if there is a remembered/trusted shop on this device (Section 3, 13)
    const trusted = authService.getTrustedShop();
    if (trusted) {
      setTrustedShop(trusted);
      setPhone(trusted.phone);
      setStep('returning_pin');
    } else {
      const lastPhone = authService.getLastPhone();
      if (lastPhone) {
        setPhone(lastPhone);
      }
      setStep('enter_phone');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Format 10 digit Indian phone number display
  const formatPhone = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    return cleaned;
  };

  const handlePhoneSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage(null);
    const cleanPhone = formatPhone(phone);
    console.log('[ShopFlow Auth] handlePhoneSubmit started for phone:', cleanPhone);
    if (cleanPhone.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      const check = await authService.checkPhone(cleanPhone);
      console.log('[ShopFlow Auth] checkPhone returned:', check);
      if (check.exists) {
        console.log('[ShopFlow Auth] Phone exists, proceeding to enter_pin');
        setFoundShopName(check.shopName || 'Your Shop');
        setStep('enter_pin');
      } else {
        console.log('[ShopFlow Auth] Phone does NOT exist, proceeding to register');
        setStep('register');
      }
    } catch (err) {
      console.error('[ShopFlow Auth] checkPhone error:', err);
      // In case check fails, default to enter_pin if online fails or let user register
      setStep('enter_pin');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (pinToUse?: string) => {
    const finalPin = pinToUse || pin;
    setErrorMessage(null);
    if (finalPin.length < 4 || finalPin.length > 6) {
      setErrorMessage('PIN must be 4 to 6 digits.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login(phone, finalPin);
      if (!res.success) {
        setErrorMessage(res.error || 'Phone number or PIN is incorrect.');
        setPin('');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Phone number or PIN is incorrect.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!shopName.trim()) {
      setErrorMessage('Please enter your shop name.');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Please enter your name.');
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      setErrorMessage('PIN must be between 4 and 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMessage('PINs do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.register({
        phone: formatPhone(phone),
        name: ownerName.trim(),
        shopName: shopName.trim(),
        pin,
        startWithSampleProducts: false,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to create shop account.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create shop account.');
    } finally {
      setIsLoading(false);
    }
  };

  // Virtual Keypad helper for smooth touch interaction
  const handleKeypadPress = (digit: string) => {
    if (step === 'register') {
      // Register uses normal inputs for accessibility
      return;
    }
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length >= 4 && (step === 'returning_pin' || step === 'enter_pin')) {
        // Auto-check if 4 digits entered, or user can tap OPEN SHOP
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Brand Header */}
      <div className="w-full max-w-md mx-auto pt-6 text-center">
        <div className="inline-flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide uppercase mb-3">
          <Store className="w-4 h-4" />
          <span>ShopFlow POS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          {step === 'returning_pin' && (trustedShop?.shopName || 'Sharma General Store')}
          {step === 'enter_pin' && (foundShopName || 'Enter Shop PIN')}
          {step === 'enter_phone' && 'Welcome to ShopFlow'}
          {step === 'register' && 'Create Your Shop'}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {step === 'returning_pin' && 'Enter your PIN to open counter'}
          {step === 'enter_pin' && `Enter PIN for ${formatPhone(phone)}`}
          {step === 'enter_phone' && 'Simple offline POS & Udhaar manager for shops'}
          {step === 'register' && 'Setup your shop in 30 seconds. No password needed.'}
        </p>
      </div>

      {/* Main Card Container */}
      <div className="w-full max-w-md mx-auto my-auto py-4">
        {/* Offline indicator banner */}
        {isOffline && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2.5 text-amber-300 text-xs font-medium">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Offline mode active. You can unlock your shop without internet.</span>
          </div>
        )}

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-4 bg-red-500/15 border border-red-500/30 rounded-xl p-3.5 flex items-start gap-2.5 text-red-200 text-sm animate-shake">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: RETURNING USER (Section 3) */}
        {step === 'returning_pin' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 text-2xl font-bold">
                🏪
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {trustedShop?.shopName || 'My Shop'}
              </h2>
              {trustedShop?.ownerName && (
                <p className="text-xs text-slate-400">Owner: {trustedShop.ownerName}</p>
              )}
            </div>

            {/* PIN display dots */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      filled
                        ? 'bg-blue-500 scale-125 shadow-md shadow-blue-500/50'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={() => handlePinSubmit()}
              disabled={isLoading || pin.length < 4}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
            >
              {isLoading ? (
                <span>Checking...</span>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>OPEN SHOP</span>
                </>
              )}
            </button>

            {/* Numeric Keypad for fast touchscreen mobile use */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center border border-slate-700/50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                className="h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 transition-all flex items-center justify-center border border-slate-700/30"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center border border-slate-700/50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleKeypadBackspace}
                className="h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-300 transition-all flex items-center justify-center border border-slate-700/30 active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Switch user / different account */}
            <div className="text-center pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setPin('');
                  setStep('enter_phone');
                }}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition-colors block mx-auto"
              >
                Not your shop? Enter different mobile number
              </button>
              <button
                type="button"
                onClick={() => {
                  authService.clearTrustedShop();
                  authService.clearSession();
                  setTrustedShop(null);
                  setPin('');
                  setPhone('');
                  setStep('enter_phone');
                }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors block mx-auto"
              >
                Reset device & start fresh
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ENTER MOBILE NUMBER (Section 2) */}
        {step === 'enter_phone' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center gap-1.5 text-slate-400 font-semibold text-base border-r border-slate-700 pr-3 pointer-events-none">
                  <Phone className="w-4 h-4 text-blue-400" />
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formatPhone(phone).length === 10 && !isLoading) {
                      e.preventDefault();
                      handlePhoneSubmit();
                    }
                  }}
                  placeholder="9876543210"
                  autoFocus
                  required
                  className="w-full pl-24 pr-4 py-4 rounded-2xl bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xl font-bold tracking-wider text-white outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <p className="text-xs text-slate-500">
                Enter your 10-digit number. We will find your shop or create a new one.
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePhoneSubmit(e);
              }}
              disabled={isLoading || formatPhone(phone).length !== 10}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
            >
              {isLoading ? (
                <span>Checking...</span>
              ) : (
                <>
                  <span>CONTINUE</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {trustedShop && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setPin('');
                    setPhone(trustedShop.phone);
                    setStep('returning_pin');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  ← Return to {trustedShop.shopName}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: ENTER PIN FOR FOUND PHONE */}
        {step === 'enter_pin' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 text-xl font-bold border border-blue-500/30">
                <Lock className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">{foundShopName}</h2>
              <p className="text-xs text-slate-400">Mobile: +91 {formatPhone(phone)}</p>
            </div>

            {/* PIN display dots */}
            <div className="flex items-center justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      filled
                        ? 'bg-blue-500 scale-125 shadow-md shadow-blue-500/50'
                        : 'bg-slate-800 border border-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handlePinSubmit()}
              disabled={isLoading || pin.length < 4}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all"
            >
              {isLoading ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>OPEN SHOP</span>
                </>
              )}
            </button>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center border border-slate-700/50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin('')}
                className="h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-400 transition-all flex items-center justify-center border border-slate-700/30"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center border border-slate-700/50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleKeypadBackspace}
                className="h-14 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-300 transition-all flex items-center justify-center border border-slate-700/30 active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setPin('');
                  setStep('enter_phone');
                }}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition-colors"
              >
                Change mobile number
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CREATE SHOP REGISTRATION (Section 2, 9, 15) */}
        {step === 'register' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="border-b border-slate-800 pb-3">
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">New Account</div>
              <h2 className="text-lg font-bold text-white">Create your shop</h2>
              <p className="text-xs text-slate-400">Mobile: +91 {formatPhone(phone)}</p>
            </div>

            {/* Shop Name */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">Shop Name</label>
              <div className="relative">
                <Store className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Sharma General Store"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-sm font-medium text-white outline-none"
                />
              </div>
            </div>

            {/* Owner Name */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">Your Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Raj Kumar"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-sm font-medium text-white outline-none"
                />
              </div>
            </div>

            {/* PIN Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Create PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  className="w-full px-4 py-3 text-center tracking-widest text-lg font-bold rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  className="w-full px-4 py-3 text-center tracking-widest text-lg font-bold rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-white outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRegisterSubmit(e);
              }}
              disabled={isLoading || !shopName || !ownerName || pin.length < 4 || pin !== confirmPin}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all mt-4"
            >
              {isLoading ? (
                <span>Setting up shop...</span>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" />
                  <span>START SHOP</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStep('enter_phone');
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                ← Back to mobile entry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer reassurance */}
      <div className="w-full max-w-md mx-auto text-center pb-2 text-xs text-slate-500">
        Offline-first POS • Cloud Sync Enabled • Secure Data Isolation
      </div>
    </div>
  );
};
