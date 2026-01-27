import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink } from 'lucide-react';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const { t } = useTranslation('common');
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      window.electronAPI.getAppVersion()
        .then(setAppVersion)
        .catch(console.error);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-dark-surface rounded-xl border border-dark-border w-[360px] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <h2 className="font-medium">{t('about.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-hover transition-colors"
            aria-label={t('close')}
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4">
          {/* App Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-primary to-purple-500 flex items-center justify-center shadow-lg">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-12 h-12 text-white"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* App Name & Version */}
          <div>
            <h3 className="text-xl font-semibold text-gray-100">PromptLint</h3>
            <p className="text-sm text-gray-400 mt-1">
              {t('about.version', { version: appVersion || '...' })}
            </p>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-300 leading-relaxed">
            {t('about.description')}
          </p>

          {/* Links */}
          <div className="pt-2 space-y-2">
            <a
              href="https://github.com/yourusername/promptlint"
              className="flex items-center justify-center gap-2 text-sm text-accent-primary hover:underline"
              onClick={(e) => {
                e.preventDefault();
                window.electronAPI.openExternal('https://github.com/yourusername/promptlint');
              }}
            >
              {t('about.github')}
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Copyright */}
          <div className="pt-4 border-t border-dark-border">
            <p className="text-xs text-gray-500">
              {t('copyright', { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-dark-border bg-dark-hover/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-dark-surface hover:bg-dark-border rounded-lg text-sm transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
