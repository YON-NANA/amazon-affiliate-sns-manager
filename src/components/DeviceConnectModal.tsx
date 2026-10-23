'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, QrCode, Copy, Check, ExternalLink, Wifi, Globe, ShieldCheck, X, Laptop, RefreshCw } from 'lucide-react';

interface DeviceConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VERCEL_URL = 'https://amazon-affiliate-sns-manager.vercel.app/';

export function DeviceConnectModal({ isOpen, onClose }: DeviceConnectModalProps) {
  const [connectMode, setConnectMode] = useState<'vercel' | 'lan'>('vercel');
  const [lanUrl, setLanUrl] = useState<string>('http://192.168.3.7:3000');
  const [ipAddress, setIpAddress] = useState<string>('192.168.3.7');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetch('/api/network-ip')
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setLanUrl(data.url);
          setIpAddress(data.ip);
        }
      })
      .catch(err => {
        console.warn('Failed to detect network IP:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUrl = connectMode === 'vercel' ? VERCEL_URL : lanUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(currentUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>スマホ・他デバイスで確認</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              スマートフォンやタブレットから実機で快適に操作できます
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setConnectMode('vercel')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              connectMode === 'vercel'
                ? 'bg-white text-emerald-800 shadow-xs dark:bg-zinc-900 dark:text-emerald-300'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-emerald-600" />
            <span>🌐 Vercel本番公開URL</span>
          </button>

          <button
            type="button"
            onClick={() => setConnectMode('lan')}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              connectMode === 'lan'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Wifi className="h-3.5 w-3.5 text-blue-600" />
            <span>💻 ローカルLAN</span>
          </button>
        </div>

        {/* QR Code Container */}
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="relative flex items-center justify-center rounded-xl bg-white p-3 shadow-xs dark:bg-white">
            {isLoading && connectMode === 'lan' ? (
              <div className="flex h-[200px] w-[200px] items-center justify-center">
                <RefreshCw className="h-7 w-7 animate-spin text-emerald-600" />
              </div>
            ) : (
              <img
                src={qrImageUrl}
                alt="Connect QR Code"
                width={200}
                height={200}
                className="rounded-lg"
              />
            )}
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
            <QrCode className="h-4 w-4 text-emerald-600" />
            <span>スマホの標準カメラをかざすと一発で開けます</span>
          </p>
        </div>

        {/* URL Box */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1">
              {connectMode === 'vercel' ? (
                <>
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Vercel公開URL:</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5 text-blue-600" />
                  <span>ローカルLAN URL:</span>
                </>
              )}
            </span>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>ブラウザで開く</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/80">
            <span className="flex-1 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">
              {currentUrl}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 shadow-xs hover:bg-zinc-100 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>コピー済</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>コピー</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Connection Tips */}
        <div className="mt-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-3 text-[11px] text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-200 space-y-1">
          <div className="font-bold flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
            <span>✨️ このURLの特徴</span>
          </div>
          {connectMode === 'vercel' ? (
            <p className="text-[11px] leading-relaxed">
              Vercelに公開されている本番環境です。**Wi-Fi不要**で、スマホの4G/5G回線や外出先からでもいつでも快適にアクセス・動作確認できます。
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed">
              PCで開発中の最新コードをリアルタイムに反映して確認できます。スマホがこのPCと**同じWi-Fi（ルーター）**に接続されている必要があります。
            </p>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
