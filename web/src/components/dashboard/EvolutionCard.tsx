import { TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { RewriteExample } from '@/api/client';

interface EvolutionCardProps {
    example: RewriteExample;
}

export default function EvolutionCard({ example }: EvolutionCardProps) {
    const { before, after, category, keyChanges } = example;
    const scoreDiff = after.score - before.score;

    return (
        <div className="card-hover flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <span className="px-2 py-1 bg-accent-primary/10 text-accent-primary text-[10px] font-bold uppercase tracking-wider rounded">
                    {category}
                </span>
                <div className="flex items-center gap-1.5 text-accent-success font-bold text-sm">
                    <TrendingUp size={14} />
                    +{scoreDiff}% improvement
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Before */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-app-text-tertiary font-medium">
                        <AlertCircle size={12} className="text-accent-primary" />
                        Original ({before.score}%)
                    </div>
                    <div className="p-3 bg-dark-surface border border-dark-border rounded-lg text-xs font-mono text-gray-500 line-clamp-4 leading-relaxed italic">
                        "{before.prompt}"
                    </div>
                </div>

                {/* After */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-app-text-tertiary font-medium">
                        <CheckCircle2 size={12} className="text-accent-success" />
                        Evolved ({after.score}%)
                    </div>
                    <div className="p-3 bg-accent-primary/5 border border-accent-primary/20 rounded-lg text-xs font-mono text-app-text-primary line-clamp-4 leading-relaxed">
                        "{after.prompt}"
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-dark-border">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Key Changes</h4>
                <div className="flex flex-wrap gap-2">
                    {keyChanges.map((change, i) => (
                        <span key={i} className="px-2 py-1 bg-dark-hover text-gray-400 text-[10px] rounded border border-dark-border">
                            {change}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
