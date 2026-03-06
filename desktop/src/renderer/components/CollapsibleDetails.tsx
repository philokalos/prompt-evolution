import { useState, memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleDetailsProps {
  children: ReactNode;
  defaultOpen?: boolean;
  label?: string;
}

function CollapsibleDetailsInner({ children, defaultOpen = false, label }: CollapsibleDetailsProps) {
  const { t } = useTranslation('analysis');
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-1 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{label ?? (isOpen ? t('details.collapse') : t('details.expand'))}</span>
      </button>
      {isOpen && <div className="space-y-4">{children}</div>}
    </div>
  );
}

const CollapsibleDetails = memo(CollapsibleDetailsInner);
export default CollapsibleDetails;
