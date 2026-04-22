import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, Copy, BookOpen, GitBranch, ArrowLeft, MoreHorizontal, Maximize2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AdaptationChatPanelProps {
  onClose: () => void;
  targetTitle?: string;
  adaptType?: string;
  onApplyChanges?: (text: string) => void;
}

const AdaptationChatPanel: React.FC<AdaptationChatPanelProps> = ({
  onClose,
  targetTitle = 'Dự án Phóng Tác',
  adaptType = 'remix',
  onApplyChanges,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Chào mừng bạn đến với công cụ Phóng tác qua Chat. Tôi đã sẵn sàng để giúp bạn thiết kế lại tác phẩm **${targetTitle}**. Bạn muốn bắt đầu từ đâu?`,
      timestamp: new Date(),
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputVal.trim() || isProcessing) return;
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputVal,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInputVal('');
    setIsProcessing(true);
    
    // Simulate AI thinking and streaming response
    setTimeout(() => {
      const assistantId = (Date.now() + 1).toString();
      const mockResponse = `Tôi đã nhận được yêu cầu của bạn. Quá trình phóng tác sẽ tập trung vào việc thay đổi nhịp độ và văn phong để phù hợp hơn mong đợi. Bạn có muốn xem một đoạn trích thử nghiệm không?`;
      
      setMessages(prev => [
        ...prev,
        { id: assistantId, role: 'assistant', content: mockResponse, timestamp: new Date() }
      ]);
      setIsProcessing(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-surface-container-lowest text-on-surface antialiased" style={{ fontFamily: 'Manrope, sans-serif' }}>
      
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface-container-lowest shadow-sm z-10 relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/20 shadow-glass">
              <GitBranch size={20} />
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg text-on-surface tracking-tight leading-tight">
                Phóng Tác Qua Chat
              </h2>
              <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant/80 uppercase tracking-widest mt-0.5">
                <span>{targetTitle}</span>
                <span className="w-1 h-1 rounded-full bg-on-surface-variant/40" />
                <span className="text-primary">{adaptType}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
            <Maximize2 size={18} />
          </button>
          <button className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Background glow effects */}
        <div className="absolute top-0 inset-x-0 h-64 bg-primary/5 blur-3xl rounded-b-full pointer-events-none opacity-50" />
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto px-4 py-8 relative z-10 scrollbar-thin scrollbar-thumb-surface-container-highest scrollbar-track-transparent">
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              
              return (
                <div key={msg.id} className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-glass
                    ${isUser 
                      ? 'bg-surface-container-high border-white/10 text-on-surface' 
                      : 'bg-primary/10 border-primary/20 text-primary'}`}
                  >
                    {isUser ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  
                  {/* Message Bubble */}
                  <div className={`max-w-[80%] flex flex-col min-w-[200px] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-xs font-bold text-on-surface-variant">
                        {isUser ? 'Bạn' : 'VietTruyen AI'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/50 font-medium">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className={`p-4 rounded-2xl shadow-glass text-[15px] leading-relaxed
                      ${isUser 
                        ? 'bg-surface-container-high border border-white/10 text-on-surface rounded-tr-sm' 
                        : 'bg-surface-container-low border border-primary/10 text-on-surface rounded-tl-sm'}`}
                    >
                      {msg.content}
                    </div>
                    
                    {/* Action buttons (only for assistant) */}
                    {!isUser && (
                      <div className="flex items-center gap-2 mt-2 px-1">
                        <button className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary border border-white/5 text-[11px] font-medium tracking-wide">
                          <Copy size={12} />
                          SAO CHÉP
                        </button>
                        {onApplyChanges && (
                          <button 
                            onClick={() => onApplyChanges(msg.content)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors text-primary border border-primary/20 text-[11px] font-medium tracking-wide"
                          >
                            <Sparkles size={12} />
                            ÁP DỤNG VÀO NỘI DUNG
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {isProcessing && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20 bg-primary/10 shadow-glass text-primary">
                  <Bot size={20} className="animate-pulse" />
                </div>
                <div className="flex items-center gap-2 h-10 px-4 rounded-2xl bg-surface-container-low border border-primary/10 text-on-surface-variant shadow-glass rounded-tl-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            
            <div ref={endOfMessagesRef} className="h-4" />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-surface-container-lowest border-t border-white/5 relative z-20">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="relative group">
            {/* Ambient glow around the input */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-3xl blur opacity-70 group-focus-within:opacity-100 transition duration-500" />
            
            <div className="relative flex items-end gap-3 bg-surface-container-high rounded-2xl border border-white/10 p-2 shadow-glass focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
              <textarea
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập yêu cầu phóng tác mới... (Shift + Enter để xuống dòng)"
                className="flex-1 max-h-40 min-h-[56px] w-full resize-none bg-transparent border-none focus:ring-0 text-on-surface text-base px-3 py-3 font-body placeholder:text-on-surface-variant/40"
                rows={1}
                style={{ height: 'auto' }}
              />
              
              <div className="flex items-center gap-2 pb-2 pr-2">
                <button
                  onClick={handleSend}
                  disabled={!inputVal.trim() || isProcessing}
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-black transition-all duration-300 disabled:opacity-50 disabled:bg-surface-container-highest disabled:text-on-surface-variant hover:bg-primary-hover active:scale-95 hover:shadow-[0_0_20px_rgba(212,165,116,0.3)]"
                >
                  <Send size={20} className={isProcessing ? 'animate-pulse' : ''} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-center gap-4 text-xs font-medium text-on-surface-variant/60">
            <span className="flex items-center gap-1.5"><Sparkles size={12} className="text-primary/70" /> Trí tuệ nhân tạo có thể mắc lỗi</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdaptationChatPanel;
