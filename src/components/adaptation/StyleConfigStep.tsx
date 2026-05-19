/**
 * File: StyleConfigStep.tsx
 * Purpose: UI cho bước cấu hình style/văn phong trong hybrid adaptation wizard
 * Layer: Presentation
 * Domain: Adaptation → [hybrid, style config UI]
 */

import React, { useCallback, useState } from 'react';
import {
    Type,
    BookOpen,
    Clipboard,
    Wand2,
    MessageSquare,
    Check,
    Loader2,
    PenTool,
} from 'lucide-react';
import type { StyleProfile, StyleSource } from '../../types/adaptation';
import {
    STYLE_PRESETS,
    type StylePresetDefinition,
} from '../../lib/adaptation/style_transfer';

// ─── Props ──────────────────────────────────────────────────

interface StyleConfigStepProps {
    styleSource: StyleSource;
    styleProfile: StyleProfile | null;
    onStyleSourceChange: (source: StyleSource) => void;
    onStyleProfileChange: (profile: StyleProfile) => void;
    onAnalyze: () => Promise<void>;
    isAnalyzing: boolean;
    hasSourceText: boolean;
}

// ─── Component ──────────────────────────────────────────────

const StyleConfigStep: React.FC<StyleConfigStepProps> = ({
    styleSource,
    styleProfile,
    onStyleSourceChange,
    onStyleProfileChange,
    onAnalyze,
    isAnalyzing,
    hasSourceText,
}) => {
    const [referenceText, setReferenceText] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');

    // ─── Source Type Selection ───────────────────────────
    const sourceOptions: { type: StyleSource['type']; label: string; icon: React.ReactNode; desc: string; disabled?: boolean }[] = [
        {
            type: 'from_source',
            label: 'Từ truyện gốc',
            icon: <BookOpen className="w-4 h-4" />,
            desc: 'Học văn phong từ truyện đang import',
            disabled: !hasSourceText,
        },
        {
            type: 'from_reference',
            label: 'Từ đoạn văn mẫu',
            icon: <Clipboard className="w-4 h-4" />,
            desc: 'Paste đoạn văn bạn muốn AI viết giống',
        },
        {
            type: 'preset',
            label: 'Preset có sẵn',
            icon: <Wand2 className="w-4 h-4" />,
            desc: 'Chọn style đã định nghĩa sẵn',
        },
        {
            type: 'custom_prompt',
            label: 'Mô tả tự do',
            icon: <MessageSquare className="w-4 h-4" />,
            desc: 'Tự mô tả style bạn muốn',
        },
    ];

    const handleSourceTypeSelect = useCallback((type: StyleSource['type']) => {
        switch (type) {
            case 'from_source':
                onStyleSourceChange({ type: 'from_source' });
                break;
            case 'from_reference':
                onStyleSourceChange({ type: 'from_reference', text: referenceText });
                break;
            case 'preset':
                onStyleSourceChange({ type: 'preset', styleId: STYLE_PRESETS[0]?.id ?? '' });
                break;
            case 'custom_prompt':
                onStyleSourceChange({ type: 'custom_prompt', prompt: customPrompt });
                break;
        }
    }, [onStyleSourceChange, referenceText, customPrompt]);

    const handlePresetSelect = useCallback((preset: StylePresetDefinition) => {
        onStyleSourceChange({ type: 'preset', styleId: preset.id });
        onStyleProfileChange({ ...preset.profile });
    }, [onStyleSourceChange, onStyleProfileChange]);

    const handleReferenceTextChange = useCallback((text: string) => {
        setReferenceText(text);
        if (styleSource.type === 'from_reference') {
            onStyleSourceChange({ type: 'from_reference', text });
        }
    }, [styleSource, onStyleSourceChange]);

    const handleCustomPromptChange = useCallback((prompt: string) => {
        setCustomPrompt(prompt);
        if (styleSource.type === 'custom_prompt') {
            onStyleSourceChange({ type: 'custom_prompt', prompt });
        }
    }, [styleSource, onStyleSourceChange]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Văn phong</h3>
            </div>
            <p className="text-sm text-zinc-400">
                Chọn nguồn style để AI học theo. Output sẽ viết theo văn phong này.
            </p>

            {/* Source Type Selection */}
            <div className="grid grid-cols-2 gap-2">
                {sourceOptions.map((opt) => {
                    const isActive = styleSource.type === opt.type;
                    return (
                        <button
                            key={opt.type}
                            type="button"
                            disabled={opt.disabled}
                            className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${isActive
                                ? 'border-purple-500 bg-purple-500/10'
                                : opt.disabled
                                    ? 'border-zinc-700/50 bg-zinc-800/30 opacity-50 cursor-not-allowed'
                                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                                }`}
                            onClick={() => !opt.disabled && handleSourceTypeSelect(opt.type)}
                        >
                            <div className="flex items-center gap-2">
                                <span className={isActive ? 'text-purple-400' : 'text-zinc-400'}>{opt.icon}</span>
                                <span className={`text-sm font-medium ${isActive ? 'text-purple-300' : 'text-zinc-300'}`}>
                                    {opt.label}
                                </span>
                            </div>
                            <span className="text-xs text-zinc-500">{opt.desc}</span>
                        </button>
                    );
                })}
            </div>

            {/* Source-specific UI */}
            {styleSource.type === 'from_reference' && (
                <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                        Paste đoạn văn mẫu (càng dài càng chính xác)
                    </label>
                    <textarea
                        value={referenceText}
                        onChange={(e) => handleReferenceTextChange(e.target.value)}
                        placeholder="Paste 1-2 trang văn mẫu vào đây. AI sẽ phân tích và học theo phong cách viết này..."
                        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 resize-none"
                        rows={6}
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                        {referenceText.length > 0 ? `${referenceText.length} ký tự` : 'Tối thiểu 200 ký tự để phân tích chính xác'}
                    </p>
                </div>
            )}

            {styleSource.type === 'preset' && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Chọn style preset</label>
                    <div className="space-y-1.5">
                        {STYLE_PRESETS.map((preset) => {
                            const isSelected = styleSource.type === 'preset' && styleSource.styleId === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${isSelected
                                        ? 'border-purple-500 bg-purple-500/10'
                                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                                        }`}
                                    onClick={() => handlePresetSelect(preset)}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm font-medium ${isSelected ? 'text-purple-300' : 'text-zinc-200'}`}>
                                            {preset.label}
                                        </span>
                                        {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-0.5">{preset.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {styleSource.type === 'custom_prompt' && (
                <div>
                    <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                        Mô tả style bạn muốn
                    </label>
                    <textarea
                        value={customPrompt}
                        onChange={(e) => handleCustomPromptChange(e.target.value)}
                        placeholder="VD: Viết giống Nguyễn Nhật Ánh — nhẹ nhàng, hài hước, nhiều chi tiết đời thường, câu ngắn, dialogue tự nhiên..."
                        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 resize-none"
                        rows={4}
                    />
                </div>
            )}

            {/* Analyze Button */}
            <button
                type="button"
                disabled={isAnalyzing || (styleSource.type === 'from_reference' && referenceText.length < 200)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm rounded-lg transition-colors"
                onClick={onAnalyze}
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang phân tích...
                    </>
                ) : (
                    <>
                        <PenTool className="w-4 h-4" />
                        Phân tích văn phong
                    </>
                )}
            </button>

            {/* Style Profile Preview */}
            {styleProfile && (
                <div className="border border-zinc-700 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        Style Profile
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <ProfileField label="Độ dài câu" value={styleProfile.sentenceLength} />
                        <ProfileField label="Tỷ lệ dialogue" value={styleProfile.dialogueRatio} />
                        <ProfileField label="Miêu tả" value={styleProfile.descriptionStyle} />
                        <ProfileField label="Giọng kể" value={styleProfile.narrativeVoice} />
                        <ProfileField label="Từ vựng" value={styleProfile.vocabularyLevel} />
                        <ProfileField label="Nhịp độ" value={styleProfile.pacing} />
                    </div>

                    {styleProfile.signature.length > 0 && (
                        <div>
                            <span className="text-xs text-zinc-400">Đặc trưng:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {styleProfile.signature.map((sig, i) => (
                                    <span key={i} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                                        {sig}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {styleProfile.antiPatterns.length > 0 && (
                        <div>
                            <span className="text-xs text-zinc-400">Tránh:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {styleProfile.antiPatterns.map((anti, i) => (
                                    <span key={i} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                                        ❌ {anti}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Sub-components ─────────────────────────────────────────

function ProfileField({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return (
        <div>
            <span className="text-xs text-zinc-500">{label}</span>
            <p className="text-zinc-300 text-sm">{value}</p>
        </div>
    );
}

export default StyleConfigStep;
