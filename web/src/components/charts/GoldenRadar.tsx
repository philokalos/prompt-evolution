import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface GoldenRadarProps {
    scores: {
        goal: number;
        output: number;
        limits: number;
        data: number;
        evaluation: number;
        next: number;
    };
}

const DIMENSION_NAMES: Record<string, string> = {
    goal: 'Goal',
    output: 'Output',
    limits: 'Limits',
    data: 'Data',
    evaluation: 'Eval',
    next: 'Next',
};

export default function GoldenRadar({ scores }: GoldenRadarProps) {
    const data = Object.entries(scores).map(([key, value]) => ({
        subject: DIMENSION_NAMES[key] || key,
        value,
        fullMark: 100,
    }));

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                    />
                    <Radar
                        name="Score"
                        dataKey="value"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.5}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1f2937',
                            borderColor: '#374151',
                            color: '#f3f4f6',
                            borderRadius: '8px',
                            fontSize: '12px',
                        }}
                        itemStyle={{ color: '#818cf8' }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
