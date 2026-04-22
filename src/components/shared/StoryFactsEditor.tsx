import React, { useEffect, useState } from 'react';
import type { StoryFact } from '../../types/story';
import { createId } from '../../core/id';

export function factsToEditorValue(facts?: StoryFact[]): string {
  return (facts || [])
    .map((fact) => `${fact.key}: ${fact.value}`)
    .join('\n');
}

export function parseFactsEditorValue(input: string): StoryFact[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) return null;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key || !value) return null;
      return {
        id: createId(),
        key,
        value,
      } satisfies StoryFact;
    })
    .filter((fact): fact is StoryFact => Boolean(fact));
}

export function aliasesToEditorValue(aliases?: string[]): string {
  return (aliases || []).join(', ');
}

export function parseAliasesEditorValue(input: string): string[] {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

interface StoryFactsEditorProps {
  aliases?: string[];
  facts?: StoryFact[];
  onAliasesChange: (aliases: string[]) => void;
  onFactsChange: (facts: StoryFact[]) => void;
  showAliases?: boolean;
}

const StoryFactsEditor: React.FC<StoryFactsEditorProps> = ({
  aliases,
  facts,
  onAliasesChange,
  onFactsChange,
  showAliases = true,
}) => {
  const [aliasesText, setAliasesText] = useState(aliasesToEditorValue(aliases));
  const [factsText, setFactsText] = useState(factsToEditorValue(facts));

  useEffect(() => {
    setAliasesText(aliasesToEditorValue(aliases));
  }, [aliases]);

  useEffect(() => {
    setFactsText(factsToEditorValue(facts));
  }, [facts]);

  return (
    <div className="space-y-3">
      <div>
        {showAliases && (
          <>
            <label className="label text-xs">Bí danh / alias</label>
            <input
              className="input-base text-sm"
              value={aliasesText}
              onChange={(event) => {
                const value = event.target.value;
                setAliasesText(value);
                onAliasesChange(parseAliasesEditorValue(value));
              }}
              placeholder="VD: Tiêu Viêm, Viêm Đế, thiếu niên họ Tiêu"
            />
          </>
        )}
      </div>

      <div>
        <label className="label text-xs">Facts canon</label>
        <textarea
          rows={4}
          className="textarea-base text-sm"
          value={factsText}
          onChange={(event) => {
            const value = event.target.value;
            setFactsText(value);
            onFactsChange(parseFactsEditorValue(value));
          }}
          placeholder={'Mỗi dòng một fact theo dạng "key: value"\nVD:\nmau_mat: đen\nvu_khi: Huyền Trọng Xích'}
        />
      </div>
    </div>
  );
};

export default StoryFactsEditor;
