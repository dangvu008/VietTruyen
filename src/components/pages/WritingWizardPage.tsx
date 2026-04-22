/**
 * File: WritingWizardPage.tsx
 * Purpose: Container Writing Wizard — horizontal stepper + step routing
 * Layer: UI (Page)
 * Domain: WritingWizard → [step orchestration, progress display]
 */
import React from 'react';
import { useWritingWizardStore, type WizardStep } from '../../store/use_writing_wizard_store';
import StepIdea from './wizard/StepIdea';
import StepBrainstorm from './wizard/StepBrainstorm';
import StepFoundation from './wizard/StepFoundation';
import StepOutline from './wizard/StepOutline';
import StepWrite from './wizard/StepWrite';
import StepReview from './wizard/StepReview';

const STEPS: { step: WizardStep; label: string; icon: string; desc: string }[] = [
  { step: 1, label: 'Ý tưởng', icon: '💡', desc: 'Ý tưởng & thể loại' },
  { step: 2, label: 'Brainstorm', icon: '🧠', desc: 'AI phát triển ý' },
  { step: 3, label: 'Nền truyện', icon: '🏗️', desc: 'Nhân vật & thế giới' },
  { step: 4, label: 'Dàn ý', icon: '📋', desc: 'Cấu trúc cốt truyện' },
  { step: 5, label: 'Viết', icon: '✍️', desc: 'Bản thảo đầu tiên' },
  { step: 6, label: 'Xem lại', icon: '📝', desc: 'Chỉnh sửa & export' },
];

export default function WritingWizardPage() {
  const { currentStep, maxStepReached, setStep } = useWritingWizardStore();

  function handleStepClick(step: WizardStep) {
    if (step <= maxStepReached) setStep(step);
  }

  function renderStep() {
    switch (currentStep) {
      case 1: return <StepIdea />;
      case 2: return <StepBrainstorm />;
      case 3: return <StepFoundation />;
      case 4: return <StepOutline />;
      case 5: return <StepWrite />;
      case 6: return <StepReview />;
      default: return <StepIdea />;
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#151310', color: '#e8e1dc', fontFamily: 'Manrope, system-ui, sans-serif' }}>
      {/* ── Stepper Header ── */}
      <div
        style={{
          borderBottom: '1px solid rgba(80,69,59,0.5)',
          background: 'rgba(22,19,16,0.8)',
          backdropFilter: 'blur(16px)',
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Title row */}
          <div style={{ paddingTop: 20, paddingBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#9c8e82' }}>
              Writing Wizard
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e1dc', marginTop: 4, marginBottom: 0 }}>
              Tạo truyện từ ý tưởng
            </h1>
          </div>

          {/* Steps row */}
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, paddingBottom: 0, overflowX: 'auto' }}>
            {STEPS.map(({ step, label, icon, desc }, index) => {
              const isActive = step === currentStep;
              const isCompleted = step < currentStep;
              const isReachable = step <= maxStepReached;

              return (
                <React.Fragment key={step}>
                  <button
                    onClick={() => handleStepClick(step)}
                    disabled={!isReachable}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '12px 16px',
                      border: 'none',
                      background: 'transparent',
                      cursor: isReachable ? 'pointer' : 'not-allowed',
                      opacity: isReachable ? 1 : 0.4,
                      position: 'relative',
                      flexShrink: 0,
                      borderBottom: isActive
                        ? '2px solid #d4a574'
                        : isCompleted
                        ? '2px solid rgba(212,165,116,0.3)'
                        : '2px solid transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Icon circle */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isCompleted ? 14 : 18,
                        fontWeight: 700,
                        background: isActive
                          ? 'linear-gradient(135deg, #f2c08d, #d4a574)'
                          : isCompleted
                          ? 'rgba(212,165,116,0.15)'
                          : 'rgba(80,69,59,0.3)',
                        color: isActive ? '#472a03' : isCompleted ? '#d4a574' : '#9c8e82',
                        border: isActive
                          ? 'none'
                          : isCompleted
                          ? '1px solid rgba(212,165,116,0.4)'
                          : '1px solid rgba(80,69,59,0.5)',
                        transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
                      }}
                    >
                      {isCompleted ? '✓' : icon}
                    </div>

                    {/* Label */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isActive ? '#f2c08d' : isCompleted ? '#d4a574' : '#9c8e82',
                        letterSpacing: '0.02em',
                        whiteSpace: 'nowrap',
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: '#9c8e82',
                        whiteSpace: 'nowrap',
                        display: isActive ? 'block' : 'none',
                      }}>
                        {desc}
                      </div>
                    </div>
                  </button>

                  {/* Connector line */}
                  {index < STEPS.length - 1 && (
                    <div style={{
                      alignSelf: 'center',
                      flex: 1,
                      height: 1,
                      minWidth: 16,
                      background: isCompleted
                        ? 'linear-gradient(90deg, rgba(212,165,116,0.5), rgba(212,165,116,0.15))'
                        : 'rgba(80,69,59,0.4)',
                      transition: 'background 0.4s',
                      marginBottom: 16,
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Step Content ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 80px' }}>
        {renderStep()}
      </div>
    </div>
  );
}
