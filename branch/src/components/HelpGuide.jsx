import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, X, Sparkles, Info, PlusCircle, Calendar as CalendarIcon, Clock, MessageSquare, Printer, FileEdit } from 'lucide-react';

const GUIDE_STEPS = [
    {
        id: 'guide-help',
        title: 'ヘルプガイドへようこそ！',
        text: 'このガイドでは、Tree Kids School アプリの基本的な使い方を順番にご案内します。まずはこのボタンからいつでもガイドを再開できます。',
        position: 'bottom'
    },
    {
        id: 'guide-add-child',
        title: '児童を追加する',
        text: <>まずはここをクリックして、今日登所する児童をマスターリストから選択してください。<br/><br/>※アイコン: <PlusCircle className="inline w-4 h-4 text-tree-600 -translate-y-0.5" /></>,
        position: 'bottom'
    },
    {
        id: 'guide-date-picker',
        title: '日付を切り替える',
        text: <>過去の記録を見たり、明日の予定を立てる場合はここをクリックして日付を選択します。<br/><br/>※アイコン: <CalendarIcon className="inline w-4 h-4 text-tree-600 -translate-y-0.5" /></>,
        position: 'bottom'
    },
    {
        id: 'guide-transport-toggle',
        title: '送迎情報の入力',
        text: <>このアイコンをクリックすると、送迎時間や迎え場所の入力欄が開きます。<br/><br/>※アイコン: <Clock className="inline w-4 h-4 text-wood-600 -translate-y-0.5" /></>,
        position: 'right'
    },
    {
        id: 'guide-child-name',
        title: 'サポート内容の記録',
        text: '児童名をクリックすると、チャット形式でその日のサポート内容やスタッフ間メモを入力できます。',
        position: 'right'
    },
    {
        id: 'guide-tree-comm',
        title: 'ツリー通信の作成',
        text: <>ここにアイコンが出現します。そのアイコンをクリックして、保護者への連絡帳（ツリー通信）を作成します。入力するとアイコンが緑色に変わります。<br/><br/>※出現するアイコン: <FileEdit className="inline w-4 h-4 text-slate-500 -translate-y-0.5" /></>,
        position: 'right'
    },
    {
        id: 'guide-program-toggle',
        title: '備考欄（スタッフメモ）',
        text: <>ここをクリックすると、備考欄（スタッフメモ）を展開できます。<br/><br/>※アイコン: <MessageSquare className="inline w-4 h-4 text-tree-600 -translate-y-0.5" /></>,
        position: 'bottom'
    },
    {
        id: 'guide-print',
        title: '一括印刷',
        text: <>その日の全員分のツリー通信をまとめて印刷します。家庭への配布物としてお使いください。<br/><br/>※アイコン: <Printer className="inline w-4 h-4 text-wood-600 -translate-y-0.5" /></>,
        position: 'bottom'
    }
];

export default function HelpGuide({ onClose }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const requestRef = useRef();
    const step = GUIDE_STEPS[currentStep];

    const updateTargetRect = () => {
        let el = document.getElementById(step.id);
        if (!el && step.fallbackId) {
            el = document.getElementById(step.fallbackId);
        }
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const padding = 8;
                setTargetRect({
                    top: rect.top - padding,
                    left: rect.left - padding,
                    right: rect.right + padding,
                    bottom: rect.bottom + padding,
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2
                });
            } else {
                setTargetRect(null);
            }
        } else {
            setTargetRect(null);
        }
        requestRef.current = requestAnimationFrame(updateTargetRect);
    };

    useEffect(() => {
        setIsVisible(false);
        const timer = setTimeout(() => setIsVisible(true), 100);
        
        requestRef.current = requestAnimationFrame(updateTargetRect);
        return () => {
            cancelAnimationFrame(requestRef.current);
            clearTimeout(timer);
        };
    }, [currentStep]);

    const handleNext = () => {
        if (currentStep < GUIDE_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const getBalloonStyle = () => {
        if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
        
        const gap = 20;
        const balloonWidth = typeof window !== 'undefined' && window.innerWidth < 400 ? window.innerWidth * 0.9 : 320;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const margin = 16;
        
        const boundX = (desiredCenterX) => {
            const halfW = balloonWidth / 2;
            let leftEdge = desiredCenterX - halfW;
            let rightEdge = desiredCenterX + halfW;
            
            if (leftEdge < margin) return margin + halfW;
            if (rightEdge > vw - margin) return vw - margin - halfW;
            return desiredCenterX;
        };

        const centerX = targetRect.left + targetRect.width / 2;

        switch (step.position) {
            case 'bottom':
                return { top: `${targetRect.bottom + gap}px`, left: `${boundX(centerX)}px`, transform: 'translateX(-50%)' };
            case 'top':
                return { top: `${targetRect.top - gap}px`, left: `${boundX(centerX)}px`, transform: 'translate(-50%, -100%)' };
            case 'left':
                const vl = targetRect.left - gap;
                return { top: `${targetRect.top + targetRect.height / 2}px`, left: `${vl < balloonWidth ? boundX(centerX) : vl}px`, transform: vl < balloonWidth ? `translate(-50%, ${gap}px)` : 'translate(-100%, -50%)' };
            case 'right':
                const vr = targetRect.right + gap;
                return { top: `${targetRect.top + targetRect.height / 2}px`, left: `${vr + balloonWidth > vw ? boundX(centerX) : vr}px`, transform: vr + balloonWidth > vw ? `translate(-50%, ${gap}px)` : 'translate(0, -50%)' };
            default:
                return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
        }
    };

    const content = (
        <div className={`fixed inset-0 z-[9999] overflow-hidden pointer-events-auto transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Dark Overlay with Hole (Spotlight) */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
                style={{
                    clipPath: targetRect 
                        ? `polygon(0% 0%, 0% 100%, ${targetRect.left}px 100%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.bottom}px, ${targetRect.left}px 100%, 100% 100%, 100% 0%)`
                        : 'none'
                }}
            />

            {/* Interaction blocker */}
            <div className="absolute inset-0 pointer-events-auto" onClick={(e) => e.stopPropagation()} />

            {/* Guide Balloon */}
            <div 
                className="absolute z-[10000] w-[320px] max-w-[90vw] bg-white rounded-[2rem] shadow-2xl p-5 md:p-6 border border-white animate-in zoom-in-95 duration-300"
                style={getBalloonStyle()}
            >
                {!targetRect && (
                    <div className="mb-4 p-3 bg-amber-50 rounded-2xl flex items-center gap-3 border border-amber-100">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-[10px] font-bold text-amber-800">この項目は現在表示されていません（児童の追加が必要な場合があります）</p>
                    </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-tree-100 rounded-xl">
                        <Sparkles className="w-4 h-4 text-tree-600" />
                    </div>
                    <h4 className="font-black text-slate-800 text-sm tracking-tight">{step.title}</h4>
                </div>
                
                <div className="text-[13px] font-bold text-slate-600 leading-relaxed mb-6">
                    {step.text}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <button 
                        onClick={onClose}
                        className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest px-2"
                    >
                        スキップ
                    </button>

                    <div className="flex items-center gap-2">
                        {currentStep > 0 && (
                            <button 
                                onClick={handleBack}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-all active:scale-90"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                        <button 
                            onClick={handleNext}
                            className="px-6 py-2 bg-tree-600 hover:bg-tree-700 text-white rounded-full font-black text-[12px] shadow-lg flex items-center gap-2 transition-all active:scale-95"
                        >
                            {currentStep === GUIDE_STEPS.length - 1 ? '完了' : '次へ'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="mt-6 flex justify-center gap-1.5">
                    {GUIDE_STEPS.map((_, i) => (
                        <div 
                            key={i} 
                            className={`h-1 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-tree-500' : 'w-2 bg-slate-100'}`} 
                        />
                    ))}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
