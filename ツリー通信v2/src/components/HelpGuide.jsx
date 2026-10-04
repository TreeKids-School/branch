import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, X, Sparkles, Info, PlusCircle, Calendar as CalendarIcon, Clock, MessageSquare, Printer, FileEdit, UserCheck, FileText, ClipboardList, FileSpreadsheet } from 'lucide-react';

const getGuideSteps = (isMobile) => {
    if (isMobile) {
        return [
            {
                id: 'guide-help',
                title: 'ヘルプガイドへようこそ！',
                text: 'このガイドでは、事業所日誌アプリの基本的な使い方をご案内します。',
                position: 'bottom'
            },
            {
                id: 'guide-date-picker',
                title: '日付の切り替え',
                text: 'カレンダーや「昨日」「明日」のボタンをクリックして、表示・編集する日誌の日付を切り替えます。',
                position: 'bottom'
            },
            {
                id: 'guide-table-section',
                title: '児童ごとの状況入力',
                text: '登所した児童の学習やプログラムの進捗、送迎時間、迎え場所などのステータスを一覧テーブル内で直接入力・選択して管理します。',
                position: 'top'
            },
            {
                id: 'guide-child-name',
                title: '個別サポート内容と連絡帳',
                text: '児童名をクリックすると右側に個別パネルが開きます。チャット形式での個別サポート記録やスタッフ間メモの作成、ツリー通信（保護者連絡）の入力を行います。',
                position: 'right'
            },
            {
                id: 'guide-mobile-menu-btn',
                title: 'メニューを開く',
                text: '画面に入り切らないその他の機能は、このメニューボタンをタップして開いたメニューから操作できます。まずはタップしてメニューを開いてみましょう！',
                position: 'top'
            },
            {
                id: 'guide-add-child',
                mobileId: 'guide-add-child-mobile-btn',
                inMobileMenu: true,
                title: '児童を追加する',
                text: '「児童追加」をクリックして、今日登所する児童をマスターリストから検索・選択し、まとめて日誌に追加します。',
                position: 'bottom'
            },
            {
                id: 'guide-print',
                mobileId: 'guide-print-mobile-btn',
                inMobileMenu: true,
                title: '日誌の印刷',
                text: '「印刷」をクリックすると、その日の業務日誌を印刷・プレビューできます。',
                position: 'bottom'
            },
            {
                id: 'guide-export',
                mobileId: 'guide-export-mobile-btn',
                inMobileMenu: true,
                title: 'データ出力',
                text: '「データ出力」をクリックすると、指定した日付のCSVデータや、月間の勤務集計データを出力できます。',
                position: 'bottom'
            },
            {
                id: 'guide-attendance',
                mobileId: 'guide-attendance-mobile-btn',
                inMobileMenu: true,
                title: '勤怠管理',
                text: '「勤怠管理」をクリックすると、職員の出勤簿の確認や、日ごとの出退勤時間、休憩時間、交通費などの編集が行えます。',
                position: 'bottom'
            },
            {
                id: 'guide-activities-section',
                mobileId: 'guide-activities-mobile-btn',
                inMobileMenu: true,
                title: '業務・活動内容の登録',
                text: '本日実施した業務活動プログラムの項目にチェックを入れて登録します。',
                position: 'right'
            },
            {
                id: 'guide-notice-section',
                mobileId: 'guide-notice-mobile-btn',
                inMobileMenu: true,
                title: '全体的な様子・特記事項',
                text: '本日の事業所全体の様子や特記すべき出来事を入力できます。',
                position: 'right'
            },
            {
                id: 'guide-tree-textarea',
                inMemoPanel: true,
                memoTab: 'tree',
                title: 'ツリー通信の入力',
                text: '児童の保護者へ送る連絡帳（ツリー通信）の文章を入力します。チャットメモの上部にある「反映」ボタンを押すと、メモの内容をここへ自動追記できます。',
                position: 'left'
            },
            {
                id: 'guide-chat-textarea',
                inMemoPanel: true,
                memoTab: 'chat',
                title: 'チャットメモの記録',
                text: 'スタッフ間で共有するサポート記録やスタッフ間メモを入力します。テキストを入力し、紙飛行機ボタンで送信（記録）します。',
                position: 'left'
            }
        ];
    } else {
        return [
            {
                id: 'guide-help',
                title: 'ヘルプガイドへようこそ！',
                text: 'このガイドでは、事業所日誌アプリの基本的な使い方をご案内します。この「？」アイコンからいつでも再開できます。',
                position: 'bottom'
            },
            {
                id: 'guide-add-child',
                title: '児童を追加する',
                text: '「児童追加」をクリックして、今日登所する児童をマスターリストから検索・選択し、まとめて日誌に追加します。',
                position: 'bottom'
            },
            {
                id: 'guide-date-picker',
                title: '日付の切り替え',
                text: 'カレンダーや「昨日」「明日」のボタンをクリックして、表示・編集する日誌の日付を切り替えます。',
                position: 'bottom'
            },
            {
                id: 'guide-print',
                title: '日誌の印刷',
                text: '「印刷」をクリックすると、その日の業務日誌を印刷・プレビューできます。',
                position: 'bottom'
            },
            {
                id: 'guide-attendance',
                title: '勤怠管理',
                text: '「勤怠管理」をクリックすると、職員の出勤簿の確認や、日ごとの出退勤時間、休憩時間、交通費などの編集が行えます。',
                position: 'bottom'
            },
            {
                id: 'guide-export',
                title: 'データ出力',
                text: '「データ出力」をクリックすると、指定した日付のCSVデータや、月間の勤務集計データを出力できます。',
                position: 'bottom'
            },
            {
                id: 'guide-staff-section',
                title: '職員の出勤状況',
                text: '名前をクリック（タップ）すると、出勤 ➔ 公休 ➔ 有給 の順に出勤区分を切り替えることができます。出勤時は勤務時間の入力・編集も行えます。',
                position: 'right'
            },
            {
                id: 'guide-notice-section',
                title: '全体的な様子・特記事項',
                text: 'カードをクリック（タップ）すると入力ウィンドウが開きます。本日の事業所全体の様子や特記すべき出来事を入力してください。',
                position: 'right'
            },
            {
                id: 'guide-activities-section',
                title: '業務・活動内容の登録',
                text: 'カードをクリック（タップ）すると選択モーダルが開きます。本日実施した業務活動プログラムの項目にチェックを入れて登録します。',
                position: 'right'
            },
            {
                id: 'guide-table-section',
                title: '児童ごとの状況入力',
                text: '登所した児童の学習やプログラムの進捗、送迎時間、迎え場所などのステータスを一覧テーブル内で直接入力・選択して管理します。',
                position: 'top'
            },
            {
                id: 'guide-child-name',
                title: '個別サポート内容と連絡帳',
                text: '児童名をクリックすると右側に個別パネルが開きます。チャット形式での個別サポート記録やスタッフ間メモの作成、ツリー通信（保護者連絡）の入力を行います。',
                position: 'right'
            },
            {
                id: 'guide-tree-textarea',
                inMemoPanel: true,
                memoTab: 'tree',
                title: 'ツリー通信の入力',
                text: '児童の保護者へ送る連絡帳（ツリー通信）の文章を入力します。チャットメモの上部にある「反映」ボタンを押すと、メモの内容をここへ自動追記できます。',
                position: 'left'
            },
            {
                id: 'guide-chat-textarea',
                inMemoPanel: true,
                memoTab: 'chat',
                title: 'チャットメモの記録',
                text: 'スタッフ間で共有するサポート記録やスタッフ間メモを入力します。テキストを入力し、紙飛行機ボタンで送信（記録）します。',
                position: 'left'
            }
        ];
    }
};

export default function HelpGuide({ 
    onClose, 
    setIsMobileMenuOpen, 
    selectedChildId, 
    setSelectedChildId, 
    memoActiveTab, 
    setMemoActiveTab, 
    firstChildId,
    startStepId
}) {
    const [activeSteps, setActiveSteps] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [hasInitializedStartStep, setHasInitializedStartStep] = useState(false);
    const [targetRect, setTargetRect] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const requestRef = useRef();
    const balloonRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, position: 'bottom', measured: false });

    // Step scanning logic to filter only visible targets
    const scanSteps = () => {
        const isMobile = window.innerWidth < 1024;
        const steps = getGuideSteps(isMobile);
        const visible = steps.filter(step => {
            if (step.inMemoPanel) {
                // Keep individual child panel steps active if we have at least one child registered
                return !!firstChildId;
            }
            if (isMobile && step.inMobileMenu) {
                // On mobile, keep mobile menu steps active because we can automatically open the menu for them
                return true;
            }
            const targetId = isMobile && step.mobileId ? step.mobileId : step.id;
            const el = document.getElementById(targetId);
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        setActiveSteps(visible);
    };

    useEffect(() => {
        scanSteps();
        window.addEventListener('resize', scanSteps);
        const timer = setTimeout(scanSteps, 150);
        return () => {
            window.removeEventListener('resize', scanSteps);
            clearTimeout(timer);
        };
    }, [firstChildId]);

    // Handle startStepId initial selection
    useEffect(() => {
        if (startStepId && activeSteps.length > 0 && !hasInitializedStartStep) {
            const idx = activeSteps.findIndex(s => s.id === startStepId || s.mobileId === startStepId);
            if (idx !== -1) {
                setCurrentStep(idx);
            }
            setHasInitializedStartStep(true);
        }
    }, [activeSteps, startStepId, hasInitializedStartStep]);

    // Clamp currentStep if activeSteps gets smaller
    useEffect(() => {
        if (activeSteps.length > 0 && currentStep >= activeSteps.length) {
            setCurrentStep(activeSteps.length - 1);
        }
    }, [activeSteps, currentStep]);

    const step = activeSteps[currentStep];

    // Handle mobile menu and MemoPanel opening/closing dynamically as steps change
    useEffect(() => {
        if (!step) return;

        const isMobile = window.innerWidth < 1024;

        // 1. Mobile Menu Control
        if (typeof setIsMobileMenuOpen === 'function') {
            if (isMobile && step.inMobileMenu) {
                setIsMobileMenuOpen(true);
            } else {
                setIsMobileMenuOpen(false);
            }
        }

        // 2. MemoPanel Control
        if (typeof setSelectedChildId === 'function' && typeof setMemoActiveTab === 'function') {
            if (step.inMemoPanel && firstChildId) {
                setSelectedChildId(firstChildId);
                setMemoActiveTab(step.memoTab);
            } else {
                // Close MemoPanel unless we are on the child name step (which guides opening it)
                if (step.id !== 'guide-child-name') {
                    setSelectedChildId(null);
                }
            }
        }
    }, [currentStep, step, setIsMobileMenuOpen, setSelectedChildId, setMemoActiveTab, firstChildId]);

    // Close mobile menu and MemoPanel on unmount
    useEffect(() => {
        return () => {
            if (typeof setIsMobileMenuOpen === 'function') {
                setIsMobileMenuOpen(false);
            }
            if (typeof setSelectedChildId === 'function') {
                setSelectedChildId(null);
            }
        };
    }, [setIsMobileMenuOpen, setSelectedChildId]);

    const updateTargetRect = () => {
        if (!step) {
            setTargetRect(null);
            return;
        }
        const isMobile = window.innerWidth < 1024;
        const targetId = isMobile && step.mobileId ? step.mobileId : step.id;
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
        const timer = setTimeout(() => setIsVisible(true), 50);
        
        requestRef.current = requestAnimationFrame(updateTargetRect);
        return () => {
            cancelAnimationFrame(requestRef.current);
            clearTimeout(timer);
        };
    }, [currentStep, activeSteps]);

    // Position calculation and clamping logic
    useEffect(() => {
        const updatePosition = () => {
            if (!balloonRef.current || !step) return;

            const bw = balloonRef.current.offsetWidth;
            const bh = balloonRef.current.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const margin = 12;
            const gap = 12;

            if (!targetRect) {
                // Center of the screen
                setCoords({
                    top: Math.max(margin, (vh - bh) / 2),
                    left: Math.max(margin, (vw - bw) / 2),
                    position: 'center',
                    measured: true
                });
                return;
            }

            const targetCenterX = targetRect.left + targetRect.width / 2;
            const targetCenterY = targetRect.top + targetRect.height / 2;

            let pos = step.position || 'bottom';

            // Adapt positioning for small screens: force left/right to top/bottom
            if (vw < 768 && (pos === 'left' || pos === 'right')) {
                pos = targetCenterY > vh / 2 ? 'top' : 'bottom';
            }

            let left = 0;
            let top = 0;

            if (pos === 'bottom') {
                left = targetCenterX - bw / 2;
                top = targetRect.bottom + gap;
                if (top + bh > vh - margin && targetRect.top - gap - bh > margin) {
                    pos = 'top';
                }
            }
            
            if (pos === 'top') {
                left = targetCenterX - bw / 2;
                top = targetRect.top - gap - bh;
                if (top < margin && targetRect.bottom + gap + bh < vh - margin) {
                    pos = 'bottom';
                }
            }

            if (pos === 'left') {
                left = targetRect.left - gap - bw;
                top = targetCenterY - bh / 2;
                if (left < margin && targetRect.right + gap + bw < vw - margin) {
                    pos = 'right';
                }
            }

            if (pos === 'right') {
                left = targetRect.right + gap;
                top = targetCenterY - bh / 2;
                if (left + bw > vw - margin && targetRect.left - gap - bw > margin) {
                    pos = 'left';
                }
            }

            // Recalculate based on final chosen position
            if (pos === 'bottom') {
                left = targetCenterX - bw / 2;
                top = targetRect.bottom + gap;
            } else if (pos === 'top') {
                left = targetCenterX - bw / 2;
                top = targetRect.top - gap - bh;
            } else if (pos === 'left') {
                left = targetRect.left - gap - bw;
                top = targetCenterY - bh / 2;
            } else if (pos === 'right') {
                left = targetRect.right + gap;
                top = targetCenterY - bh / 2;
            }

            // Clamp both coordinates to viewport boundaries with margin
            left = Math.max(margin, Math.min(vw - bw - margin, left));
            top = Math.max(margin, Math.min(vh - bh - margin, top));

            setCoords({ top, left, position: pos, measured: true });
        };

        setCoords(prev => ({ ...prev, measured: false }));

        let rafId = requestAnimationFrame(updatePosition);

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [currentStep, targetRect, step]);

    const handleNext = () => {
        // モバイルでメニューを開くステップの場合、先にメニューを開く演出をしてから400ms遅れて次の説明に進む
        if (step && step.id === 'guide-mobile-menu-btn') {
            if (typeof setIsMobileMenuOpen === 'function') {
                setIsMobileMenuOpen(true);
            }
            setTimeout(() => {
                if (currentStep < activeSteps.length - 1) {
                    setCurrentStep(currentStep + 1);
                } else {
                    onClose();
                }
            }, 400);
            return;
        }

        if (currentStep < activeSteps.length - 1) {
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

    if (activeSteps.length === 0) return null;

    const content = (
        <div className={`fixed inset-0 z-[100000] overflow-hidden pointer-events-auto transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Sliding Spotlight Overlay */}
            <div 
                className="fixed pointer-events-none"
                style={{
                    top: targetRect ? `${targetRect.top}px` : '50%',
                    left: targetRect ? `${targetRect.left}px` : '50%',
                    width: targetRect ? `${targetRect.width}px` : '0px',
                    height: targetRect ? `${targetRect.height}px` : '0px',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
                    borderRadius: '1.25rem',
                    zIndex: 100000,
                    transitionProperty: 'top, left, width, height, border-radius',
                    transitionDuration: '400ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            />

            {/* Interaction blocker */}
            <div className="absolute inset-0 pointer-events-auto" onClick={(e) => e.stopPropagation()} />

            {/* Guide Balloon */}
            <div 
                ref={balloonRef}
                className="fixed z-[100001] w-[320px] max-w-[90vw] max-h-[80vh] overflow-y-auto bg-white rounded-[2rem] shadow-2xl p-5 md:p-6 border border-white animate-in zoom-in-95 duration-300 flex flex-col"
                style={{
                    position: 'fixed',
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    opacity: coords.measured ? 1 : 0,
                    transform: 'none',
                    margin: 0,
                    transition: coords.measured ? 'opacity 0.2s ease-in-out' : 'none'
                }}
            >
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                    <div className="p-2 bg-tree-100 rounded-xl flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-tree-600" />
                    </div>
                    <h4 className="font-black text-slate-800 text-sm tracking-tight">{step.title}</h4>
                </div>
                
                <div className="text-[13px] font-bold text-slate-600 leading-relaxed mb-6 flex-grow overflow-y-auto custom-scrollbar-hidden">
                    {step.text}
                </div>

                <div className="flex items-center justify-between gap-3 mt-auto pt-2 border-t border-slate-100/50 flex-shrink-0">
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
                            {currentStep === activeSteps.length - 1 ? '完了' : '次へ'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="mt-4 flex justify-center gap-1.5 flex-shrink-0">
                    {activeSteps.map((_, i) => (
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

