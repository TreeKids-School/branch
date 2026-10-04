import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    ChevronRight, ChevronLeft, X, Sparkles, 
    CheckCircle2, ArrowUpDown, Eye, EyeOff 
} from 'lucide-react';
import { UPDATE_TOUR_STEPS } from '../app_constants';

export default function UpdateTour({
    onClose,
    startStepId = null,
    firstChildId = null,
    selectedChildId,
    setSelectedChildId,
    setMemoActiveTab,
    setIsMobileMenuOpen,
    setIsProgramCollapsed
}) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [userFlip, setUserFlip] = useState(false); // Manually move balloon to top/bottom
    const [isPeekMode, setIsPeekMode] = useState(false); // Make balloon semi-transparent to view underneath
    const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'bottom', measured: false });
    const balloonRef = useRef(null);
    const requestRef = useRef();

    // Initialize start step
    useEffect(() => {
        if (startStepId) {
            const idx = UPDATE_TOUR_STEPS.findIndex(s => s.id === startStepId);
            if (idx !== -1) {
                setCurrentStep(idx);
                return;
            }
        }
        setCurrentStep(0);
    }, [startStepId]);

    // Reset user manual flip when step changes
    useEffect(() => {
        setUserFlip(false);
        setIsPeekMode(false);
    }, [currentStep]);

    const step = UPDATE_TOUR_STEPS[currentStep] || UPDATE_TOUR_STEPS[0];

    // Handle panels (MemoPanel, MobileMenu) opening/closing dynamically as steps change
    useEffect(() => {
        if (!step) return;

        const isMobile = window.innerWidth < 1024;

        // 1. MemoPanel Control
        if (typeof setSelectedChildId === 'function' && typeof setMemoActiveTab === 'function') {
            if (step.inMemoPanel && firstChildId) {
                setSelectedChildId(firstChildId);
                if (step.memoTab) {
                    setMemoActiveTab(step.memoTab);
                }
            } else if (step.id !== 'tour-staff-icon-color') {
                setSelectedChildId(null);
            }
        }

        // 2. Mobile Menu control (Auto-open when step is in mobile menu)
        if (typeof setIsMobileMenuOpen === 'function') {
            if (isMobile && step.inMobileMenu) {
                setIsMobileMenuOpen(true);
            } else {
                setIsMobileMenuOpen(false);
            }
        }

        // 3. Program collapsible control
        if (typeof setIsProgramCollapsed === 'function' && step.openProgram) {
            setIsProgramCollapsed(false);
        }
    }, [currentStep, step, firstChildId, setSelectedChildId, setMemoActiveTab, setIsMobileMenuOpen, setIsProgramCollapsed]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (typeof setSelectedChildId === 'function') {
                setSelectedChildId(null);
            }
            if (typeof setIsMobileMenuOpen === 'function') {
                setIsMobileMenuOpen(false);
            }
        };
    }, [setSelectedChildId, setIsMobileMenuOpen]);

    // Helper to get active target element id based on screen width
    const getActiveTargetId = () => {
        if (!step) return null;
        const isMobile = window.innerWidth < 1024;
        return isMobile && step.mobileTargetId ? step.mobileTargetId : step.targetId;
    };

    // Update target element's bounding rect
    const updateTargetRect = () => {
        const targetId = getActiveTargetId();
        if (!targetId) {
            setTargetRect(null);
            return;
        }

        const el = document.getElementById(targetId);
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
                    height: rect.height + padding * 2,
                    centerY: rect.top + rect.height / 2,
                    centerX: rect.left + rect.width / 2
                });
            } else {
                setTargetRect(null);
            }
        } else {
            setTargetRect(null);
        }
        requestRef.current = requestAnimationFrame(updateTargetRect);
    };

    // Scroll to element when step changes
    useEffect(() => {
        setIsVisible(false);
        const timer = setTimeout(() => {
            const targetId = getActiveTargetId();
            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            }
            setIsVisible(true);
        }, 120);

        requestRef.current = requestAnimationFrame(updateTargetRect);
        return () => {
            cancelAnimationFrame(requestRef.current);
            clearTimeout(timer);
        };
    }, [currentStep, step]);

    // Calculate balloon positioning avoiding target occlusion 100%
    useEffect(() => {
        const updatePosition = () => {
            if (!balloonRef.current || !step) return;

            const bw = balloonRef.current.offsetWidth;
            const bh = balloonRef.current.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const safeMargin = 12;

            if (!targetRect) {
                setCoords({
                    top: Math.max(safeMargin, (vh - bh) / 2),
                    left: Math.max(safeMargin, (vw - bw) / 2),
                    placement: 'center',
                    measured: true
                });
                return;
            }

            // Determine optimal position: if target is in bottom half, put balloon at top; if in top half, put at bottom
            const targetIsInBottomHalf = targetRect.centerY > vh * 0.48;
            let preferTop = targetIsInBottomHalf;

            // Apply manual user flip if pressed
            if (userFlip) {
                preferTop = !preferTop;
            }

            let top = 0;
            let left = 0;

            if (preferTop) {
                // Place at top of screen
                top = safeMargin;
                // If it still overlaps the target, adjust so it stays safely above
                if (top + bh > targetRect.top - 8 && targetRect.top > bh + safeMargin) {
                    top = Math.max(safeMargin, targetRect.top - bh - 8);
                }
            } else {
                // Place at bottom of screen
                top = vh - bh - safeMargin;
                // If it overlaps target, adjust so it stays safely below
                if (top < targetRect.bottom + 8 && vh - targetRect.bottom > bh + safeMargin) {
                    top = Math.min(vh - bh - safeMargin, targetRect.bottom + 8);
                }
            }

            // Center horizontally relative to target or screen center
            if (vw < 768) {
                // On mobile, center horizontally with safe margin
                left = (vw - bw) / 2;
            } else {
                // On larger screens, try to center horizontally on target, clamped to screen
                left = targetRect.centerX - bw / 2;
            }

            // Clamp into viewport
            left = Math.max(safeMargin, Math.min(vw - bw - safeMargin, left));
            top = Math.max(safeMargin, Math.min(vh - bh - safeMargin, top));

            setCoords({
                top,
                left,
                placement: preferTop ? 'top' : 'bottom',
                measured: true
            });
        };

        const timer = setTimeout(updatePosition, 50);
        window.addEventListener('resize', updatePosition);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
        };
    }, [targetRect, step, userFlip]);

    const handleNext = () => {
        if (currentStep < UPDATE_TOUR_STEPS.length - 1) {
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

    if (!step) return null;

    return createPortal(
        <div className={`fixed inset-0 z-[100000] overflow-hidden pointer-events-auto transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Sliding Spotlight Overlay */}
            <div
                className="fixed pointer-events-none"
                style={{
                    top: targetRect ? `${targetRect.top}px` : '50%',
                    left: targetRect ? `${targetRect.left}px` : '50%',
                    width: targetRect ? `${targetRect.width}px` : '0px',
                    height: targetRect ? `${targetRect.height}px` : '0px',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
                    borderRadius: '1.25rem',
                    zIndex: 100000,
                    transitionProperty: 'top, left, width, height, border-radius',
                    transitionDuration: '350ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            />

            {/* Interaction blocker to keep tour focused (tap anywhere to un-peek if in peek mode) */}
            <div 
                className="absolute inset-0 pointer-events-auto" 
                onClick={(e) => {
                    if (isPeekMode) setIsPeekMode(false);
                    e.stopPropagation();
                }} 
            />

            {/* Guide Balloon */}
            <div
                ref={balloonRef}
                onClick={isPeekMode ? () => setIsPeekMode(false) : undefined}
                className={`fixed z-[100001] w-[320px] sm:w-[350px] max-w-[calc(100vw-24px)] bg-white rounded-2xl md:rounded-3xl shadow-2xl p-3.5 md:p-4 border-2 border-tree-500 flex flex-col transition-all duration-200 ${
                    isPeekMode ? 'opacity-25 scale-95 cursor-pointer ring-4 ring-tree-400' : 'opacity-100'
                }`}
                style={{
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    visibility: coords.measured ? 'visible' : 'hidden'
                }}
            >
                {/* Header with Step Badge, Move Button, Peek, Close */}
                <div className="flex items-center justify-between gap-1.5 mb-2 pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-2 py-0.5 bg-tree-100 text-tree-800 rounded-full font-black text-[10px] flex items-center gap-1 flex-shrink-0">
                            <Sparkles className="w-3 h-3 text-tree-600" />
                            ガイド
                        </span>
                        <span className="text-[11px] font-black text-slate-500">
                            {currentStep + 1} / {UPDATE_TOUR_STEPS.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* 位置切り替えボタン（上下入れ替え） */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setUserFlip(!userFlip); }}
                            className="px-2 py-0.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 text-[10px] font-black flex items-center gap-1 transition-colors border border-slate-200"
                            title={coords.placement === 'top' ? '下へ移動' : '上へ移動'}
                        >
                            <ArrowUpDown className="w-3 h-3 text-tree-600" />
                            <span>{coords.placement === 'top' ? '下へ' : '上へ'}</span>
                        </button>

                        {/* 透視（裏を見る）ボタン: タップで切り替え */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsPeekMode(!isPeekMode); }}
                            className={`p-1 rounded-lg transition-colors ${
                                isPeekMode ? 'bg-tree-100 text-tree-700' : 'hover:bg-slate-100 text-slate-500'
                            }`}
                            title={isPeekMode ? '元に戻す' : 'タップで半透明にして裏面を見る'}
                        >
                            {isPeekMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        {/* 閉じる */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors ml-0.5"
                            title="閉じる"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Title */}
                <h3 className="font-black text-slate-800 text-xs md:text-sm mb-1.5 leading-snug">
                    {step.title}
                </h3>

                {/* Concise Description: どういう機能か */}
                <p className="text-[11.5px] font-bold text-slate-600 leading-relaxed mb-3 bg-slate-50/90 p-2.5 rounded-xl border border-slate-100/80">
                    {step.description}
                </p>

                {/* Footer Controls */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors py-1 px-1"
                    >
                        終了
                    </button>

                    <div className="flex items-center gap-1.5">
                        {currentStep > 0 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-all active:scale-95"
                                title="前へ"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-4 py-1.5 bg-tree-600 hover:bg-tree-700 text-white rounded-full font-black text-[11px] shadow-sm hover:shadow flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        >
                            <span>{currentStep === UPDATE_TOUR_STEPS.length - 1 ? '完了' : '次へ'}</span>
                            {currentStep === UPDATE_TOUR_STEPS.length - 1 ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Step Indicators */}
                <div className="mt-2 flex justify-center gap-1">
                    {UPDATE_TOUR_STEPS.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setCurrentStep(i)}
                            className={`h-1 rounded-full transition-all duration-300 ${
                                i === currentStep ? 'w-5 bg-tree-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                            }`}
                            title={`ステップ ${i + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}
