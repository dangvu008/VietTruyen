/**
 * File: MutationConfigStep.tsx
 * Purpose: UI cho bước cấu hình mutation rules trong hybrid adaptation wizard
 * Layer: Presentation
 * Domain: Adaptation → [hybrid, mutation config UI]
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
    Plus,
    Trash2,
    Sparkles,
    SlidersHorizontal,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Zap,
    Palette,
    BookOpen,
    Timer,
    Eye,
    Layers,
    PenTool,
} from 'lucide-react';
import type { MutationCategory, MutationConfig, MutationIntensity } from '../../types/adaptation';
import {
    createCustomRule,
    createRuleFromPreset,
    MUTATION_PRESETS,
    validateMutationConfig,
    type MutationPreset,
} from '../../lib/adaptation/detail_mutation_engine';

// ─── Props ──────────────────────────────────────────────────

interface MutationConfigStepProps {
    config: MutationConfig;
    onChange: (config: MutationConfig) => void;
    totalChapters?: number;
}

// ─── Category Metadata ──────────────────────────────────────

const CATEGORY_META: Record<MutationCategory, { label: string; icon: React.ReactNode; color: string }> = {
    setting: { label: 'Bối cảnh', icon: <Palette className="w-4 h-4" />, color: 'text-blue-400' },
    tone: { label: 'Tone', icon: <Sparkles className="w-4 h-4" />, color: 'text-purple-400' },
    subplot: { label: 'Tuyến phụ', icon: <BookOpen className="w-4 h-4" />, color: 'text-green-400' },
    pacing: { label: 'Nhịp độ', icon: <Timer className="w-4 h-4" />, color: 'text-orange-400' },
    spice: { label: 'Gia vị', icon: <Zap className="w-4 h-4" />, color: 'text-red-400' },
    pov: { label: 'Ngôi kể', icon: <Eye className="w-4 h-4" />, color: 'text-cyan-400' },
    detail: { label: 'Chi tiết', icon: <Layers className="w-4 h-4" />, color: 'text-yellow-400' },
};

const INTENSITY_LABELS: Record<MutationIntensity, { label: string; color: string }> = {
    subtle: { label: 'Nhẹ', color: 'bg-green-500/20 text-green-300' },
    moderate: { label: 'Vừa', color: 'bg-yellow-500/20 text-yellow-300' },
    dramatic: { label: 'Mạnh', color: 'bg-red-500/20 text-red-300' },
};

// ─── Component ──────────────────────────────────────────────

const MutationConfigStep: React.FC<MutationConfigStepProps> = ({
    config,
    onChange,
    // totalChapters — reserved for future per-chapter rule assignment UI
}) => {
    const [showPresets, setShowPresets] = useState(true);
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState<MutationCategory | null>(null);

    // Custom rule form state
    const [customCategory, setCustomCategory] = useState<MutationCategory>('setting');
    const [customDescription, setCustomDescription] = useState('');
    const [customIntensity, setCustomIntensity] = useState<MutationIntensity>('moderate');

    const validation = useMemo(() => validateMutationConfig(config), [config]);

    // ─── Handlers ───────────────────────────────────────
    const addPreset = useCallback((preset: MutationPreset) => {
        const rule = createRuleFromPreset(preset);
        onChange({
            ...config,
            rules: [...config.rules, rule],
        });
    }, [config, onChange]);

    const addCustomRule = useCallback(() => {
        if (!customDescription.trim()) return;
        const rule = createCustomRule(customCategory, customDescription.trim(), customIntensity);
        onChange({
            ...config,
            rules: [...config.rules, rule],
        });
        setCustomDescription('');
        setShowCustomForm(false);
    }, [config, onChange, customCategory, customDescription, customIntensity]);

    const removeRule = useCallback((ruleId: string) => {
        onChange({
            ...config,
            rules: config.rules.filter((r) => r.id !== ruleId),
        });
    }, [config, onChange]);

    const updateGlobalDirective = useCallback((value: string) => {
        onChange({ ...config, globalDirective: value });
    }, [config, onChange]);

    const updateForbidden = useCallback((value: string) => {
        const items = value.split('\n').map((s) => s.trim()).filter(Boolean);
        onChange({ ...config, forbiddenElements: items });
    }, [config, onChange]);

    // ─── Preset grouping ────────────────────────────────
    const presetsByCategory = useMemo(() => {
        const grouped: Record<MutationCategory, MutationPreset[]> = {
            setting: [], tone: [], subplot: [], pacing: [], spice: [], pov: [], detail: [],
        };
        for (const preset of MUTATION_PRESETS) {
            grouped[preset.category].push(preset);
        }
        return grouped;
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Cấu hình biến đổi</h3>
            </div>
            <p className="text-sm text-zinc-400">
                Chọn cách AI biến đổi nội dung: đổi bối cảnh, thêm gia vị, thay đổi tone...
            </p>

            {/* Validation warnings */}
            {(validation.warnings.length > 0 || validation.errors.length > 0) && (
                <div className="space-y-1">
                    {validation.errors.map((err, i) => (
                        <div key={`err-${i}`} className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-3 py-1.5 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{err}</span>
                        </div>
                    ))}
                    {validation.warnings.map((warn, i) => (
                        <div key={`warn-${i}`} className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 px-3 py-1.5 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{warn}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Preset Mutations */}
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
                <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                    onClick={() => setShowPresets(!showPresets)}
                >
                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        Gợi ý nhanh (Presets)
                    </span>
                    {showPresets ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                </button>

                {showPresets && (
                    <div className="p-4 space-y-3">
                        {(Object.entries(presetsByCategory) as [MutationCategory, MutationPreset[]][]).map(([category, presets]) => {
                            if (presets.length === 0) return null;
                            const meta = CATEGORY_META[category];
                            const isExpanded = expandedCategory === category;

                            return (
                                <div key={category}>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors mb-1"
                                        onClick={() => setExpandedCategory(isExpanded ? null : category)}
                                    >
                                        <span className={meta.color}>{meta.icon}</span>
                                        <span>{meta.label}</span>
                                        <span className="text-xs text-zinc-500">({presets.length})</span>
                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="ml-6 space-y-1.5">
                                            {presets.map((preset) => {
                                                const alreadyAdded = config.rules.some(
                                                    (r) => r.description === preset.directive,
                                                );
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        disabled={alreadyAdded}
                                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${alreadyAdded
                                                            ? 'bg-zinc-800/30 text-zinc-500 cursor-not-allowed'
                                                            : 'bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300'
                                                            }`}
                                                        onClick={() => addPreset(preset)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium">{preset.label}</span>
                                                            <span className={`text-xs px-1.5 py-0.5 rounded ${INTENSITY_LABELS[preset.intensity].color}`}>
                                                                {INTENSITY_LABELS[preset.intensity].label}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-zinc-500 mt-0.5">{preset.description}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Active Rules */}
            {config.rules.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-zinc-300">Rules đang áp dụng ({config.rules.length})</h4>
                    <div className="space-y-1.5">
                        {config.rules.map((rule) => {
                            const meta = CATEGORY_META[rule.category];
                            return (
                                <div
                                    key={rule.id}
                                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 rounded border border-zinc-700/50"
                                >
                                    <span className={meta.color}>{meta.icon}</span>
                                    <span className="flex-1 text-sm text-zinc-300 truncate">
                                        {rule.description.slice(0, 60)}{rule.description.length > 60 ? '...' : ''}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${INTENSITY_LABELS[rule.intensity].color}`}>
                                        {INTENSITY_LABELS[rule.intensity].label}
                                    </span>
                                    <button
                                        type="button"
                                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                        onClick={() => removeRule(rule.id)}
                                        aria-label="Xóa rule"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Custom Rule Form */}
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
                <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                    onClick={() => setShowCustomForm(!showCustomForm)}
                >
                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <PenTool className="w-4 h-4 text-green-400" />
                        Thêm rule tùy chỉnh
                    </span>
                    <Plus className="w-4 h-4 text-zinc-400" />
                </button>

                {showCustomForm && (
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Loại</label>
                                <select
                                    value={customCategory}
                                    onChange={(e) => setCustomCategory(e.target.value as MutationCategory)}
                                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-200"
                                >
                                    {Object.entries(CATEGORY_META).map(([key, meta]) => (
                                        <option key={key} value={key}>{meta.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Mức độ</label>
                                <select
                                    value={customIntensity}
                                    onChange={(e) => setCustomIntensity(e.target.value as MutationIntensity)}
                                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-zinc-200"
                                >
                                    {Object.entries(INTENSITY_LABELS).map(([key, meta]) => (
                                        <option key={key} value={key}>{meta.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Mô tả (directive cho AI)</label>
                            <textarea
                                value={customDescription}
                                onChange={(e) => setCustomDescription(e.target.value)}
                                placeholder="VD: Thêm yếu tố hài hước vào mỗi scene..."
                                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 resize-none"
                                rows={2}
                            />
                        </div>
                        <button
                            type="button"
                            disabled={!customDescription.trim()}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm rounded transition-colors"
                            onClick={addCustomRule}
                        >
                            Thêm rule
                        </button>
                    </div>
                )}
            </div>

            {/* Global Directive */}
            <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                    Chỉ đạo tổng quát (áp dụng cho tất cả chương)
                </label>
                <textarea
                    value={config.globalDirective}
                    onChange={(e) => updateGlobalDirective(e.target.value)}
                    placeholder="VD: Thêm nhiều tình tiết lãng mạn, giữ action. Nhân vật chính phải có character development rõ ràng..."
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 resize-none"
                    rows={3}
                />
            </div>

            {/* Forbidden Elements */}
            <div>
                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                    Cấm tuyệt đối (mỗi dòng 1 item)
                </label>
                <textarea
                    value={config.forbiddenElements.join('\n')}
                    onChange={(e) => updateForbidden(e.target.value)}
                    placeholder={"VD:\nkhông có harem\nkhông NTR\nkhông bạo lực quá mức"}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 resize-none"
                    rows={3}
                />
            </div>
        </div>
    );
};

export default MutationConfigStep;
