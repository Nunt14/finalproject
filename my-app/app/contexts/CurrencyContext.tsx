import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CurrencyCode = 'THB' | 'USD' | 'EUR' | 'JPY' | 'GBP';

export type CurrencySymbol = '฿' | '$' | '€' | '¥' | '£';

// อัตราแลกเปลี่ยน (1 หน่วยสกุลเงินต้นทาง = กี่บาท)
const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  THB: 1.0,
  USD: 36.5,
  EUR: 39.5,
  JPY: 0.25,
  GBP: 46.0,
};

interface CurrencyContextValue {
  currency: CurrencyCode;
  currencySymbol: CurrencySymbol;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  // ฟังก์ชันแปลงสกุลเงิน
  convertToTHB: (amount: number) => number;
  convertFromTHB: (amount: number) => number;
  formatCurrency: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const STORAGE_KEY = 'user_currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('THB');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && ['THB', 'USD', 'EUR', 'JPY', 'GBP'].includes(saved)) {
          setCurrencyState(saved as CurrencyCode);
        }
      } catch {}
    })();
  }, []);

  const setCurrency = async (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newCurrency);
    } catch {}
  };

  const convertToTHB = (amount: number): number => {
    const rate = EXCHANGE_RATES[currency] || 1;
    return amount * rate;
  };

  const convertFromTHB = (amount: number): number => {
    const rate = EXCHANGE_RATES[currency] || 1;
    return amount / rate;
  };

  const formatCurrency = (amount: number): string => {
    return Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  };

  // หาสัญลักษณ์สกุลเงินตามรหัส
  const getCurrencySymbol = (code: CurrencyCode): CurrencySymbol => {
    switch (code) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'JPY': return '¥';
      case 'GBP': return '£';
      case 'THB':
      default: return '฿';
    }
  };

  const value = useMemo(() => ({
    currency,
    currencySymbol: getCurrencySymbol(currency),
    setCurrency,
    convertToTHB,
    convertFromTHB,
    formatCurrency,
  }), [currency]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
