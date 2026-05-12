import { useState } from 'react';
import { generateLesson, generateContent, extractVocabulary } from './services/gemini';
import { BookOpen, Loader2, PlayCircle, Send, Sparkles, Youtube, FileText, Languages, Mic, MicOff, Clock, Target, Trash2, Search, Trophy, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useEffect } from 'react';
import remarkGfm from 'remark-gfm';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lesson, setLesson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeInputTab, setActiveInputTab] = useState<'url' | 'transcript'>('transcript');
  const [activeResultTab, setActiveResultTab] = useState<'lesson' | 'analysis' | 'roleplay' | 'writing' | 'games' | 'progress' | 'leaderboard' | 'vocabulary'>('lesson');
  const [matchingGame, setMatchingGame] = useState<{ word: string; def: string }[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [globalVocab, setGlobalVocab] = useState<{word: string, type: string, meaning: string, example: string, date: string, box?: number}[]>([]);
  const [currentVocab, setCurrentVocab] = useState<{word: string, type: string, meaning: string, example: string, date: string}[]>([]);
  const [vocabSearch, setVocabSearch] = useState('');
  const [vocabViewMode, setVocabViewMode] = useState<'current' | 'history' | 'quiz'>('current');
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [currentFlashIdx, setCurrentFlashIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Daily Goals logic
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizInput, setQuizInput] = useState('');
  const [quizFeedback, setQuizFeedback] = useState<{correct: boolean, msg: string} | null>(null);

  const checkQuiz = () => {
    const target = globalVocab[currentFlashIdx].word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
    const input = quizInput.toLowerCase().trim();
    if (input === target) {
      setQuizFeedback({ correct: true, msg: "Perfect! Well done." });
      setTimeout(() => {
        setQuizFeedback(null);
        setQuizInput('');
        setCurrentFlashIdx((prev) => (prev + 1) % globalVocab.length);
        setIsQuizMode(false);
      }, 1500);
    } else {
      setQuizFeedback({ correct: false, msg: `Try again! Hint: Starts with "${target[0]}"` });
      speak(target);
    }
  };

  // Load vocab bank from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('esl_vocab_bank');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGlobalVocab(parsed);
      } catch (e) {
        console.error("Error loading vocab bank", e);
      }
    }
  }, []);

  // Save to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('esl_vocab_bank', JSON.stringify(globalVocab));
    setVocabularyCount(globalVocab.length);
  }, [globalVocab]);

  const exportToHtml = () => {
    if (!lesson) return;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ESL Lesson - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #fffaf5; }
        .container { background: white; padding: 40px; border-radius: 20px; shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #ffe8d6; }
        h1, h2, h3 { color: #c2410c; font-family: "Georgia", serif; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
        code { font-family: monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
        blockquote { border-left: 4px solid #f97316; margin: 0; padding-left: 20px; color: #666; font-style: italic; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #fff7ed; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        ${lesson.split('\n').map(line => {
          if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
          if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
          if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
          if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
          if (line.trim() === '') return '<br/>';
          return `<p>${line}</p>`;
        }).join('')}
        <div class="footer">Generated by AI ESL Assistant - ${new Date().toLocaleString()}</div>
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESL_Lesson_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startGames = async () => {
    setActiveResultTab('games');
    if (matchingGame.length > 0) return; // Don't regenerate if already exists for this lesson
    setIsAnalyzing(true);
    try {
      const res = await generateContent(`Tạo một trò chơi nối từ (matching game) với 5 từ khóa từ nội dung này: ${input.slice(0, 2000)}. Trả lời dưới dạng JSON array: [{"word": "...", "def": "... Vietnamese definition ..."}]. Chỉ trả lời chuỗi JSON, không giải thích gì thêm.`, "You are a tool that extracts vocabulary into JSON format.");
      const jsonStr = res.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const decoded = JSON.parse(jsonStr);
        if (Array.isArray(decoded)) {
          setMatchingGame(decoded);
          setMatchedPairs([]);
        }
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        setError("Lỗi định dạng dữ liệu từ AI. Vui lòng thử lại hoặc xem bài học thay thế.");
      }
    } catch (err) { console.error(err); }
    finally { setIsAnalyzing(false); }
  };
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [library, setLibrary] = useState<{ id: string; title: string; content: string; date: string }[]>(() => {
    const saved = localStorage.getItem('esl_library');
    return saved ? JSON.parse(saved) : [];
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [roleplayMsgs, setRoleplayMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [userMsg, setUserMsg] = useState('');
  const [isRoleplayOpen, setIsRoleplayOpen] = useState(false);
  const [writingInput, setWritingInput] = useState('');
  const [writingFeedback, setWritingFeedback] = useState<string | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [learningHours, setLearningHours] = useState(12);
  const [vocabularyCount, setVocabularyCount] = useState(145);
  const [leaderboard, setLeaderboard] = useState([
    { name: 'User123', score: 2450 },
    { name: 'Alex', score: 2100 },
    { name: 'Sophia', score: 1950 },
    { name: 'You', score: 1800 },
    { name: 'Ryan', score: 1550 },
  ]);
  const [isDictationMode, setIsDictationMode] = useState(false);
  const [dictationInput, setDictationInput] = useState('');
  const [dictionary, setDictionary] = useState<{word: string, type: string, meaning: string}[]>([]);
  const [gapFillIndex, setGapFillIndex] = useState(0);
  const [gapFillInput, setGapFillInput] = useState('');
  const [gapFillSentences, setGapFillSentences] = useState<{text: string, gap: string}[]>([]);
  const [isGapFillMode, setIsGapFillMode] = useState(false);

  const toggleSubtitles = () => setShowSubtitles(!showSubtitles);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const saveToLibrary = (title: string, content: string) => {
    const newItem = {
      id: Date.now().toString(),
      title: title || 'Untitled Lesson',
      content,
      date: new Date().toLocaleDateString('vi-VN')
    };
    const updated = [newItem, ...library];
    setLibrary(updated);
    localStorage.setItem('esl_library', JSON.stringify(updated));
  };

  const startRoleplay = () => {
    setIsRoleplayOpen(true);
    setRoleplayMsgs([{ role: 'ai', text: "Hi! Let's talk about what we just learned. What's your opinion on the topic?" }]);
  };

  const sendRoleplayMsg = async () => {
    if (!userMsg.trim()) return;
    const newMsgs = [...roleplayMsgs, { role: 'user', text: userMsg } as const];
    setRoleplayMsgs(newMsgs);
    setUserMsg('');
    try {
      const response = await generateContent(`Tiếp tục hội thoại trong vai nhân vật từ bài học này: ${input.slice(0, 1000)}. Người học vừa nói: "${userMsg}". Chỉ trả lời bằng tiếng Anh, ngắn gọn.`, "You are a roleplay partner from the context provided.");
      setRoleplayMsgs([...newMsgs, { role: 'ai', text: response }]);
    } catch (err) { console.error(err); }
  };

  const getWritingCheck = async () => {
    setIsAnalyzing(true);
    try {
      const feedback = await generateContent(`Sửa lỗi bài viết tóm tắt này: "${writingInput}". Dựa trên ngữ cảnh: ${input.slice(0, 1000)}. Nhận xét bằng tiếng Việt, sửa lỗi ngữ pháp. Thêm điểm số /10.`, "You are an ESL writing coach.");
      setWritingFeedback(feedback);
    } catch (err) { console.error(err); }
    finally { setIsAnalyzing(false); }
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please enable it in browser settings.');
        } else {
          setError('Speech recognition error. Please try again.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error("Mic start error:", e);
      setIsListening(false);
    }
  };

  const [playbackSpeed, setPlaybackSpeed] = useState(0.75);
  const [selectedText, setSelectedText] = useState<string>('');
  const [toolkitVisible, setToolkitVisible] = useState(false);
  const [toolkitPos, setToolkitPos] = useState({ x: 0, y: 0 });
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [sentiment, setSentiment] = useState<string | null>(null);
  const [gradingFeedback, setGradingFeedback] = useState<Record<number, {score?: number, feedback?: string, transcript?: string, mispronounced?: {word: string, ipa: string, tip: string}[]}>>({});
  const [realtimeTranscript, setRealtimeTranscript] = useState('');

  const dailyGoals = [
    { id: 1, label: 'Learn 5 new words', target: 5, current: globalVocab.length % 6, icon: <BookOpen size={12}/> },
    { id: 2, label: 'Shadowing Practice', target: 3, current: Object.keys(gradingFeedback).length, icon: <Mic size={12}/> },
    { id: 3, label: 'Finish 1 Dictation', target: 1, current: matchedPairs.length > 0 ? 1 : 0, icon: <FileText size={12}/> }
  ];

  const handleTextSelection = (e: any) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 2) {
      setSelectedText(text);
      setToolkitPos({ x: e.clientX, y: e.clientY - 60 });
      setToolkitVisible(true);
    } else {
      setToolkitVisible(false);
    }
  };

  const runAnalysis = async (type: 'explain' | 'grammar' | 'paraphrase') => {
    setIsAnalyzing(true);
    setToolkitVisible(false);
    try {
      let result = '';
      if (type === 'explain') result = await generateContent(`Giải thích cụm từ này trong ngữ cảnh: "${selectedText}" từ nội dung: ${input.slice(0, 1000)}`, "You are a vocabulary expert.");
      if (type === 'grammar') result = await generateContent(`Phân tích ngữ pháp cấu trúc: "${selectedText}"`, "You are a grammar specialist.");
      if (type === 'paraphrase') result = await generateContent(`Gợi ý các cách diễn đạt khác cho: "${selectedText}"`, "You are an ESL paraphrasing assistant.");
      setAiAnalysis(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [recordingIdx, setRecordingIdx] = useState<number | null>(null);

  const handleGrade = async (idx: number, original: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Microphone integration is not supported on this browser. Please use Chrome or Edge.");
      return;
    }

    if (recordingIdx !== null) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setRecordingIdx(idx);
      setIsListening(true);
      setRealtimeTranscript('');
      setGradingFeedback(prev => {
        const newData = { ...prev };
        delete newData[idx];
        return newData;
      });
    };

    recognition.onresult = async (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const userText = event.results[i][0].transcript;
          recognition.stop();
          setRealtimeTranscript(userText);
          
          setIsLoading(true);
          try {
            const prompt = `Grade this speech for an ESL learner. 
            Target sentence: "${original}"
            User said: "${userText}"
            
            Provide deep phonological analysis:
            1. Accuracy score (0-100).
            2. "feedback": Short encouraging Vietnamese feedback + 1 specific mouth/tongue position tip.
            3. "mispronounced": Array of objects like {"word": "...", "ipa": "...", "tip": "..."}
            
            Return JSON only: {"score": number, "feedback": string, "mispronounced": [{"word": string, "ipa": string, "tip": string}]}`;
            
            const feedbackStr = await generateContent(prompt, "You are a professional phonetics and language coach.");
            const feedback = JSON.parse(feedbackStr.replace(/```json/g, '').replace(/```/g, '').trim());
            setGradingFeedback(prev => ({ ...prev, [idx]: { ...feedback, transcript: userText } }));
          } catch (err) {
            console.error(err);
            setGradingFeedback(prev => ({ ...prev, [idx]: { feedback: "AI Grading failed. Please try again." } }));
          } finally {
            setIsLoading(false);
          }
        } else {
          interim += event.results[i][0].transcript;
          setRealtimeTranscript(interim);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setError(`Microphone error: ${event.error}. Please ensure permission is granted.`);
      setRecordingIdx(null);
      setIsListening(false);
    };

    recognition.onend = () => {
      setRecordingIdx(null);
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Start error:", e);
      setRecordingIdx(null);
      setIsListening(false);
    }
  };

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = playbackSpeed;
    window.speechSynthesis.speak(utterance);
  };

  const [dictationFeedback, setDictationFeedback] = useState<string | null>(null);

  const extractShadowingSentences = (markdown: string) => {
    const sentences: { text: string; transcript: string; note: string }[] = [];
    // Match blocks starting with S:, T:, N:
    // This regex is slightly more flexible with markers
    const blocks = markdown.split(/\n(?=[-*#\d\.\s]*S:)/i);
    
    blocks.forEach(block => {
      const sMatch = block.match(/S:\s*(.+)/i);
      const tMatch = block.match(/T:\s*(.+)/i);
      const nMatch = block.match(/N:\s*(.+)/i);
      
      if (sMatch) {
        sentences.push({
          text: sMatch[1].trim(),
          transcript: tMatch ? tMatch[1].trim() : '',
          note: nMatch ? nMatch[1].trim() : ''
        });
      }
    });
    return sentences.slice(0, 5); // Limit to 5
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);
    setLesson(null); // Clear previous lesson
    setMatchedPairs([]);
    setGapFillIndex(0);
    setDictationFeedback(null);
    setAiAnalysis(null);
    setSummary(null);
    setSentiment(null);

    try {
      const result = await generateLesson(input.slice(0, 4000));
      if (result) {
        setLesson(result);
        
        // Extract and Merge into Global Vocab Bank
        const newVocab = await extractVocabulary(input);
        if (newVocab && Array.isArray(newVocab)) {
          const formatted = newVocab.map(v => ({ ...v, date: new Date().toLocaleDateString() }));
          setCurrentVocab(formatted);
          setGlobalVocab(prev => {
            const existingWords = new Set(prev.map(v => v.word.toLowerCase()));
            const uniqueNew = formatted.filter(v => !existingWords.has(v.word.toLowerCase()));
            return [...uniqueNew, ...prev];
          });
        }
      } else {
        setError('Không thể tạo bài học. Vui lòng thử lại.');
      }
    } catch (err) {
      setError('Đã xảy ra lỗi khi kết nối với AI. Vui lòng kiểm tra API Key và thử lại.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const shadowingSentences = lesson ? extractShadowingSentences(lesson) : [];

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      isDarkMode ? "bg-zinc-950 text-white" : "bg-[#FDFCFB] text-[#1A1A1A]"
    )}>
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-50 transition-all border-b",
        isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-white/80 backdrop-blur-md border-orange-100"
      )}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
              <Languages size={24} />
            </div>
            <h1 className={cn(
              "text-xl font-bold tracking-tight",
              isDarkMode ? "text-white" : "bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-orange-400"
            )}>
              ESL/IELTS AI Lab
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <button 
              onClick={toggleSubtitles}
              className={cn("p-2 rounded-lg transition-all", isDarkMode ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-orange-50 text-orange-600")}
              title="Toggle Subtitles"
            >
              {showSubtitles ? <Languages size={20} /> : <FileText size={20} />}
            </button>
             <button 
              onClick={() => setShowLibrary(!showLibrary)}
              className={cn("p-2 rounded-lg transition-all", isDarkMode ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-orange-50 text-orange-600")}
              title="Thư viện cá nhân"
            >
              <BookOpen size={20} />
            </button>
            <button 
              onClick={toggleDarkMode}
              className={cn("p-2 rounded-lg transition-all", isDarkMode ? "bg-zinc-800 text-yellow-400" : "bg-orange-50 text-orange-600")}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <AnimatePresence>
            {showLibrary && (
              <motion.div 
                initial={{ opacity: 0, x: -300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -300 }}
                className={cn(
                  "fixed left-0 top-16 bottom-0 w-80 z-40 border-r p-6 overflow-y-auto shadow-2xl",
                  isDarkMode ? "bg-zinc-950 border-zinc-800" : "bg-white border-orange-100"
                )}
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className={cn("font-bold uppercase tracking-widest", isDarkMode ? "text-zinc-500" : "text-orange-400")}>My Library</h3>
                  <button onClick={() => setShowLibrary(false)} className="text-gray-400 hover:text-red-500">✕</button>
                </div>
                <div className="space-y-4">
                  {library.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Thư viện của bạn đang trống.</p>
                  ) : (
                    library.map(item => (
                      <div 
                        key={item.id} 
                        onClick={() => { setLesson(item.content); setShowLibrary(false); }}
                        className={cn(
                          "p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]",
                          isDarkMode ? "bg-zinc-900 border-zinc-800 hover:border-orange-500/50" : "bg-orange-50 border-orange-100 hover:border-orange-300"
                        )}
                      >
                        <p className={cn("font-bold text-sm mb-1 truncate", isDarkMode ? "text-white" : "text-gray-900")}>{item.title}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.date}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <section className="lg:col-span-12 xl:col-span-5 space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                Thiết kế bài học <span className="text-orange-600 italic font-serif underline decoration-orange-200 underline-offset-4">từ thực tế</span>
              </h2>
              <p className="text-gray-500 leading-relaxed">
                Dán URL YouTube hoặc Transcript để tạo lộ trình học tiếng Anh cá nhân hóa trong giây lát.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="flex border-b border-orange-100">
                <button
                  onClick={() => setActiveInputTab('transcript')}
                  className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                    activeInputTab === 'transcript' ? "bg-orange-50 text-orange-600" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <FileText size={16} />
                  Transcript
                </button>
                <button
                  onClick={() => setActiveInputTab('url')}
                  className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                    activeInputTab === 'url' ? "bg-orange-50 text-orange-600" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Youtube size={16} />
                  YouTube Link
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={activeInputTab === 'url' ? "Dán link YouTube tại đây..." : "Dán nội dung transcript/hội thoại tại đây..."}
                    className="w-full min-h-[200px] bg-gray-50/50 border border-transparent focus:border-orange-200 focus:ring-4 focus:ring-orange-50 rounded-xl p-4 text-sm resize-none transition-all outline-none"
                  />
                  <button
                    onClick={toggleListening}
                    className={cn(
                      "absolute bottom-4 right-4 p-2 rounded-full transition-all flex items-center justify-center shadow-sm",
                      isListening 
                        ? "bg-red-500 text-white animate-pulse" 
                        : "bg-white text-gray-400 hover:text-orange-500 hover:bg-orange-50 border border-gray-100"
                    )}
                    title={isListening ? "Đang nghe..." : "Nhập bằng giọng nói"}
                  >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !input.trim()}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Đang phân tích...
                    </>
                  ) : (
                    <>
                      <PlayCircle size={20} />
                      Tạo bài học ngay
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-start gap-2"
              >
                <div className="mt-0.5">⚠️</div>
                <p>{error}</p>
              </motion.div>
            )}

            {shadowingSentences.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 rounded-2xl p-6 text-white shadow-2xl border border-zinc-800"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <Mic size={16} />
                    </div>
                    <h3 className="font-bold text-sm uppercase tracking-widest text-orange-400">Shadowing Mode</h3>
                  </div>
                  <div className="flex items-center gap-3 bg-zinc-800 p-1.5 rounded-lg border border-zinc-700">
                    <span className="text-[10px] font-bold text-zinc-500 ml-2">SPEED</span>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.25" 
                      value={playbackSpeed} 
                      onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                      className="w-20 accent-orange-500"
                    />
                    <span className="text-[10px] font-bold text-orange-400 min-w-[30px]">{playbackSpeed}x</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {shadowingSentences.map((s, idx) => (
                    <div 
                      key={idx} 
                      className="group bg-zinc-800/50 hover:bg-zinc-800 p-4 rounded-xl border border-zinc-700 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                             <button 
                               onClick={() => speak(s.text)}
                               className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white flex items-center justify-center transition-all"
                             >
                              <PlayCircle size={16} />
                            </button>
                            <p className="text-orange-100 font-medium leading-relaxed">{s.text}</p>
                          </div>
                          <p className="text-zinc-500 text-xs font-mono">{s.transcript}</p>
                          {s.note && <p className="text-zinc-400 text-[11px] italic mt-2 bg-zinc-900/50 p-2 rounded-md">💡 {s.note}</p>}
                          
                          {recordingIdx === idx && (
                            <div className="mt-3 flex items-center gap-1.5 h-6">
                               <div className="flex items-center gap-1">
                                 {[1, 2, 3, 4, 5].map((i) => (
                                   <motion.div 
                                     key={i}
                                     animate={{ height: [4, 16, 4] }}
                                     transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                                     className="w-1 bg-orange-500 rounded-full"
                                   />
                                 ))}
                               </div>
                               <span className="text-[10px] font-mono text-orange-400 animate-pulse">
                                 Analyzing: "{realtimeTranscript || 'Start speaking...'}"
                               </span>
                            </div>
                          )}
                          
                          {gradingFeedback[idx] && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }} 
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "mt-3 p-4 rounded-2xl border flex flex-col gap-4",
                                (gradingFeedback[idx].score || 0) >= 80 ? "bg-emerald-500/5 border-emerald-500/20" : 
                                (gradingFeedback[idx].score || 0) >= 50 ? "bg-orange-500/5 border-orange-500/20" : 
                                "bg-red-500/5 border-red-500/20"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                                    (gradingFeedback[idx].score || 0) >= 80 ? "bg-emerald-500 text-white" : 
                                    (gradingFeedback[idx].score || 0) >= 50 ? "bg-orange-500 text-white" : 
                                    "bg-red-500 text-white"
                                  )}>
                                    {gradingFeedback[idx].score}%
                                  </div>
                                  <div>
                                    <span className="font-bold text-[10px] uppercase tracking-widest block opacity-60">Pronunciation Score</span>
                                    <span className={cn(
                                      "text-xs font-bold",
                                      (gradingFeedback[idx].score || 0) >= 80 ? "text-emerald-500" : 
                                      (gradingFeedback[idx].score || 0) >= 50 ? "text-orange-500" : 
                                      "text-red-500"
                                    )}>
                                      {(gradingFeedback[idx].score || 0) >= 80 ? 'Excellent!' : (gradingFeedback[idx].score || 0) >= 50 ? 'Good Effort' : 'Needs Review'}
                                    </span>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => handleGrade(idx, s.text)}
                                  className="text-[10px] font-bold uppercase tracking-tighter text-zinc-400 hover:text-orange-400 flex items-center gap-1"
                                >
                                  <RotateCcw size={12} /> Try Again
                                </button>
                              </div>
                              
                              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
                                <p className="text-[11px] font-medium leading-relaxed italic text-zinc-400 mb-1">You said:</p>
                                <p className="text-xs font-medium">"{gradingFeedback[idx].transcript}"</p>
                              </div>
                              
                              {gradingFeedback[idx].mispronounced && gradingFeedback[idx].mispronounced.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Target Improvements</p>
                                  <div className="grid grid-cols-1 gap-2">
                                    {gradingFeedback[idx].mispronounced.map((item, i) => (
                                      <div key={i} className="flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/5 dark:bg-white/5 border border-zinc-200 dark:border-white/5">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-red-500 uppercase">{item.word}</span>
                                          <span className="text-[10px] font-mono text-zinc-500">[{item.ipa}]</span>
                                          <button onClick={() => speak(item.word)} className="ml-auto text-zinc-400 hover:text-orange-500"><PlayCircle size={12}/></button>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 leading-tight">TIP: {item.tip}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-start gap-2 text-[11px] text-zinc-500 leading-relaxed italic">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <span>{gradingFeedback[idx].feedback}</span>
                              </div>
                            </motion.div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleGrade(idx, s.text)}
                          className="flex flex-col items-center gap-1 group/btn"
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg",
                            recordingIdx === idx 
                              ? "bg-red-500 text-white animate-pulse" 
                              : "bg-zinc-700 text-zinc-400 group-hover/btn:bg-orange-500 group-hover/btn:text-white"
                          )}>
                            <Mic size={18} />
                          </div>
                          <span className={cn("text-[10px] font-bold transition-colors", recordingIdx === idx ? "text-red-500" : "text-zinc-500")}>
                            {recordingIdx === idx ? 'LISTENING...' : 'GRADE'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {toolkitVisible && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="fixed z-[100] bg-zinc-900 text-white rounded-2xl shadow-2xl border border-zinc-700 p-2 flex gap-3 items-center overflow-hidden"
                  style={{ left: toolkitPos.x, top: toolkitPos.y }}
                >
                  <div className="px-3 border-r border-zinc-700">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none block mb-1">Selected Text</span>
                    <span className="text-[11px] font-medium text-orange-200 block max-w-[150px] truncate">"{selectedText}"</span>
                  </div>
                  <div className="flex gap-1 pr-1">
                    {[
                      { type: 'explain', label: 'Define', icon: <BookOpen size={14} />, color: 'text-blue-400 hover:bg-blue-400/10' },
                      { type: 'grammar', label: 'Grammar', icon: <Sparkles size={14} />, color: 'text-purple-400 hover:bg-purple-400/10' },
                      { type: 'paraphrase', label: 'Paraphrase', icon: <Languages size={14} />, color: 'text-orange-400 hover:bg-orange-400/10' }
                    ].map(btn => (
                      <button
                        key={btn.type}
                        onClick={() => runAnalysis(btn.type as any)}
                        className={cn(
                          "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                          btn.color
                        )}
                      >
                        {btn.icon}
                        <span className="text-[9px] font-bold uppercase">{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(isAnalyzing || aiAnalysis) && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                  onClick={() => { if (!isAnalyzing) setAiAnalysis(null); }}
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-orange-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                          <Sparkles size={18} />
                        </div>
                        <h4 className="font-bold">AI Tutor Expert Analysis</h4>
                      </div>
                      <button onClick={() => setAiAnalysis(null)} className="text-white/60 hover:text-white transition-colors">
                        <MicOff size={20} className="rotate-45" />
                      </button>
                    </div>
                    
                    <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar prose prose-orange prose-sm max-w-none">
                      {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <Loader2 size={32} className="animate-spin text-orange-500" />
                          <p className="text-gray-400 font-medium italic animate-pulse">Consulting the linguistic experts...</p>
                        </div>
                      ) : (
                        <ReactMarkdown>{aiAnalysis || ''}</ReactMarkdown>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-3 flex items-center gap-2">
                <BookOpen size={14} /> Cấu trúc bài học cao cấp
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: 'Phần 1: Warm-up (Dự đoán)', icon: '🎯' },
                  { label: 'Phần 2: Deep Listening (Cloze/Scrambled)', icon: '🎧' },
                  { label: 'Phần 3: Vocabulary Matching (CEFR B1/B2)', icon: '🧩' },
                  { label: 'Phần 4: Grammar Transformation', icon: '⚡' },
                  { label: 'Phần 5: Shadowing Mode (TTS)', icon: '🗣️' },
                  { label: 'Phần 6: Critical Thinking (Summary)', icon: '🧠' }
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-[13px] font-medium text-gray-600 bg-white/50 p-2 rounded-lg border border-orange-50">
                    <span>{item.icon}</span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right Column: Result */}
          <section className="lg:col-span-12 xl:col-span-7">
            <AnimatePresence mode="wait">
              {lesson ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key="lesson"
                  className="bg-white rounded-3xl border border-orange-100 shadow-xl overflow-hidden"
                >
                  <div className="bg-orange-600 p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Lesson Material</span>
                      <button 
                        onClick={() => setLesson(null)}
                        className="text-xs font-medium hover:underline opacity-80"
                      >
                        Tạo bài mới
                      </button>
                    </div>
                    <h3 className="text-2xl font-bold font-serif italic">Your Interactive ESL Lesson</h3>
                  </div>
                  
                  <div className="p-8 pb-4 flex items-center justify-between border-b border-orange-50 bg-orange-50/20">
                    <div className="flex gap-4 overflow-x-auto custom-scrollbar whitespace-nowrap pb-2 scroll-smooth">
                      {['lesson', 'analysis', 'roleplay', 'writing', 'games', 'vocabulary', 'progress', 'leaderboard'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => tab === 'games' ? startGames() : setActiveResultTab(tab as any)}
                          className={cn(
                            "text-xs font-bold uppercase tracking-widest pb-2 transition-all border-b-2",
                            activeResultTab === tab ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-600"
                          )}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => saveToLibrary(activeInputTab === 'url' ? 'YouTube Lesson' : 'Transcript Lesson', lesson || '')}
                        className="text-[10px] font-bold text-emerald-500 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                      >
                        SAVE
                      </button>
                      {lesson && (
                        <div className="flex gap-2">
                          <button 
                            onClick={exportToHtml}
                            className="text-[10px] font-bold text-orange-400 border border-orange-200 px-2 py-1 rounded hover:bg-orange-50 transition-colors"
                          >
                            HTML
                          </button>
                          <button 
                            onClick={() => {
                              const blob = new Blob([lesson], { type: 'text/markdown' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'lesson.md';
                              a.click();
                            }}
                            className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                          >
                            MD
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div 
                    className="p-8 prose prose-orange max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-p:text-gray-600 prose-p:leading-relaxed overflow-y-auto max-h-[800px] custom-scrollbar relative"
                    onMouseUp={handleTextSelection}
                  >
                    {activeResultTab === 'lesson' && (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {lesson}
                      </ReactMarkdown>
                    )}
                    
                    {activeResultTab === 'roleplay' && (
                      <div className="not-prose h-[500px] flex flex-col">
                        <div className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scrollbar pr-2">
                            {roleplayMsgs.map((m, i) => (
                              <div key={i} className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
                                <div className={cn(
                                  "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm relative group mb-1",
                                  m.role === 'user' ? "bg-orange-500 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none"
                                )}>
                                  {m.text}
                                  
                                  <div className={cn(
                                    "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                                    m.role === 'user' ? "right-full mr-2" : "left-full ml-2"
                                  )}>
                                    <button 
                                      onClick={() => speak(m.text)}
                                      className="p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-zinc-400 hover:text-orange-500 transition-colors"
                                    >
                                      <PlayCircle size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleGrade(1000 + i, m.text)}
                                      className={cn(
                                        "p-1.5 bg-white shadow-sm border border-gray-100 rounded-full transition-colors",
                                        recordingIdx === 1000 + i ? "text-red-500 animate-pulse" : "text-zinc-400 hover:text-red-500"
                                      )}
                                    >
                                      <Mic size={14} />
                                    </button>
                                  </div>
                                </div>
                                
                                {gradingFeedback[1000 + i] && (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-[70%] mb-4 p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-800"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold">Speech Score: {gradingFeedback[1000 + i].score}%</span>
                                      <button onClick={() => setGradingFeedback(prev => { const n = {...prev}; delete n[1000+i]; return n; })} className="text-zinc-400 hover:text-red-500 text-xs">✕</button>
                                    </div>
                                    <p className="opacity-70 italic mb-1">"{gradingFeedback[1000 + i].transcript}"</p>
                                    <p className="font-medium text-[9px]">{gradingFeedback[1000 + i].feedback}</p>
                                  </motion.div>
                                )}
                              </div>
                            ))}

                        </div>
                        <div className="flex gap-2 p-2 border-t border-gray-100">
                          <input 
                            value={userMsg} 
                            onChange={e => setUserMsg(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendRoleplayMsg()}
                            placeholder={isListening ? "Listening..." : "Type in English..."} 
                            className={cn(
                              "flex-1 text-sm border-none rounded-xl px-4 transition-all outline-none",
                              isListening ? "bg-red-50 ring-2 ring-red-100" : "bg-gray-50 focus:ring-2 focus:ring-orange-100"
                            )}
                          />
                          <button 
                            onClick={() => {
                              const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                              if (!SpeechRecognition) return;
                              const rec = new SpeechRecognition();
                              rec.lang = 'en-US';
                              rec.onstart = () => setIsListening(true);
                              rec.onresult = (e: any) => {
                                const t = e.results[0][0].transcript;
                                setUserMsg(t);
                                setIsListening(false);
                              };
                              rec.onerror = () => setIsListening(false);
                              rec.onend = () => setIsListening(false);
                              rec.start();
                            }}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                              isListening ? "bg-red-500 text-white animate-pulse" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                            )}
                          >
                            <Mic size={18} />
                          </button>
                          <button onClick={sendRoleplayMsg} className="w-10 h-10 bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20 active:scale-95 transition-all">
                            <Send size={18} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeResultTab === 'writing' && (
                      <div className="not-prose space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Summary Writing Challenge</h4>
                        <textarea 
                          value={writingInput}
                          onChange={e => setWritingInput(e.target.value)}
                          placeholder="Write your 80-100 word summary here..."
                          className="w-full h-40 bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-orange-50 transition-all outline-none"
                        />
                        <button 
                          onClick={getWritingCheck}
                          disabled={isAnalyzing}
                          className="w-full py-3 bg-zinc-900 text-white font-bold rounded-xl text-sm hover:bg-zinc-800 transition-all"
                        >
                          {isAnalyzing ? <Loader2 className="animate-spin mx-auto" /> : 'Get Professional Feedback'}
                        </button>
                        {writingFeedback && (
                          <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl text-orange-900 text-sm leading-relaxed shadow-sm">
                            <ReactMarkdown>{writingFeedback}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                    {activeResultTab === 'analysis' && (
                      <div className="space-y-8 not-prose">
                        <div className={cn("p-6 rounded-2xl border transition-all", isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-orange-50 border-orange-100")}>
                          <h4 className="flex items-center gap-2 text-orange-600 font-bold mb-4">
                            <Sparkles size={18} /> Smart Content Summary
                          </h4>
                          <button 
                            onClick={async () => {
                              setIsAnalyzing(true);
                              const res = await generateContent(`Tóm tắt nội dung này theo 3 cấp độ: Sơ lược, Chi tiết, và Sơ đồ tư duy (dạng text): ${input.slice(0, 3000)}`, "You are a content summarizer.");
                              setSummary(res);
                              setIsAnalyzing(false);
                            }}
                            className={cn("text-xs font-bold px-4 py-2 rounded-lg hover:shadow-sm border transition-all", isDarkMode ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-white text-orange-600 border-orange-200")}
                          >
                            {summary ? 'Cập nhật Tóm tắt' : 'Tạo Tóm tắt đa tầng'}
                          </button>
                          {summary && (
                            <div className={cn("mt-4 text-sm p-4 rounded-xl prose prose-sm max-w-none transition-all", isDarkMode ? "bg-zinc-800 text-zinc-300 border border-zinc-700" : "bg-white/80 text-gray-600 shadow-inner")}>
                              <ReactMarkdown>{summary}</ReactMarkdown>
                            </div>
                          )}
                        </div>

                        <div className={cn("p-6 rounded-2xl border transition-all", isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-blue-50 border-blue-100")}>
                          <h4 className="flex items-center gap-2 text-blue-600 font-bold mb-4">
                            <Languages size={18} /> Sentiment & Tone Analysis
                          </h4>
                          <button 
                            onClick={async () => {
                              setIsAnalyzing(true);
                              const res = await generateContent(`Phân tích thái độ, cảm xúc và tone giọng của người nói trong bài này: ${input.slice(0, 2000)}`, "You are a linguistic sentiment analyzer.");
                              setSentiment(res);
                              setIsAnalyzing(false);
                            }}
                            className={cn("text-xs font-bold px-4 py-2 rounded-lg hover:shadow-sm border transition-all", isDarkMode ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-white text-blue-600 border-orange-200")}
                          >
                            {sentiment ? 'Cập nhật Phân tích' : 'Phân tích Cảm xúc'}
                          </button>
                          {sentiment && (
                            <div className={cn("mt-4 text-sm p-4 rounded-xl transition-all", isDarkMode ? "bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono" : "bg-white/80 text-gray-600 shadow-inner")}>
                              {sentiment}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeResultTab === 'games' && (
                      <div className="not-prose space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                             <button onClick={() => {setIsDictationMode(false); setIsGapFillMode(false);}} className={cn("text-[10px] font-bold px-3 py-1 rounded-full transition-all", !isDictationMode && !isGapFillMode ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500")}>MATCHING</button>
                             <button onClick={() => {setIsDictationMode(true); setIsGapFillMode(false);}} className={cn("text-[10px] font-bold px-3 py-1 rounded-full transition-all", isDictationMode ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500")}>DICTATION</button>
                             <button onClick={() => {setIsGapFillMode(true); setIsDictationMode(false);}} className={cn("text-[10px] font-bold px-3 py-1 rounded-full transition-all", isGapFillMode ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500")}>GAP-FILL</button>
                          </div>
                          <span className="text-[10px] font-bold bg-green-50 text-green-600 px-2 py-1 rounded">Score: {matchedPairs.length}/5</span>
                        </div>
                        
                        {isGapFillMode ? (
                          <div className="space-y-4">
                             <div className={cn("p-8 rounded-3xl border transition-all", isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm")}>
                                <div className="flex justify-between items-center mb-6">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Level: B2 • Marathon Mode</p>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(i => (
                                      <div key={i} className={cn("w-1.5 h-1.5 rounded-full", gapFillIndex >= i ? "bg-orange-500" : "bg-gray-200")} />
                                    ))}
                                  </div>
                                </div>
                                <div className="text-lg font-serif italic mb-8 leading-relaxed">
                                   {(shadowingSentences[gapFillIndex]?.text || "Generate a lesson first to experience dynamic gap-filling.").split(' ').map((word, i) => {
                                      const wordsList = (shadowingSentences[gapFillIndex]?.text || "").split(' ');
                                      // Determine gap: usually the longest word or a middle word
                                      const gapWordIndex = Math.min(3, Math.floor(wordsList.length / 2));
                                      const isGap = i === gapWordIndex && shadowingSentences[gapFillIndex];
                                      return isGap ? (
                                        <span key={i} className="inline-block border-b-2 border-orange-300 w-24 mx-1" />
                                      ) : (
                                        <span key={i}>{word} </span>
                                      );
                                   })}
                                </div>
                                <div className="space-y-4">
                                   <input 
                                     value={gapFillInput}
                                     onChange={e => setGapFillInput(e.target.value)}
                                     onKeyDown={e => {
                                       if (e.key === 'Enter') {
                                         const wordsList = (shadowingSentences[gapFillIndex]?.text || "").split(' ');
                                         const gapWordIndex = Math.min(3, Math.floor(wordsList.length / 2));
                                         const target = wordsList[gapWordIndex]?.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
                                         const input = gapFillInput.trim().toLowerCase();
                                         if (input === target) {
                                            setMatchedPairs([...matchedPairs, `gap-${gapFillIndex}`]);
                                            setGapFillIndex((gapFillIndex + 1) % shadowingSentences.length);
                                            setGapFillInput('');
                                         } else {
                                           speak(shadowingSentences[gapFillIndex].text); // Play audio as hint
                                         }
                                       }
                                     }}
                                     placeholder="Type the missing word and press Enter..."
                                     className={cn("w-full p-4 rounded-xl text-sm border focus:ring-2 focus:ring-orange-500 transition-all outline-none", isDarkMode ? "bg-zinc-800 border-zinc-700" : "bg-gray-50 border-gray-100")}
                                   />
                                   <div className="flex gap-2">
                                      <button 
                                        onClick={() => {
                                          const wordsList = (shadowingSentences[gapFillIndex]?.text || "").split(' ');
                                          const gapWordIndex = Math.min(3, Math.floor(wordsList.length / 2));
                                          const target = wordsList[gapWordIndex]?.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
                                          const input = gapFillInput.trim().toLowerCase();
                                          if (input === target) {
                                              setMatchedPairs([...matchedPairs, `gap-${gapFillIndex}`]);
                                              setGapFillIndex((gapFillIndex + 1) % shadowingSentences.length);
                                              setGapFillInput('');
                                          } else {
                                            alert("Try again! Listen to the audio for a hint.");
                                            speak(shadowingSentences[gapFillIndex].text);
                                          }
                                        }}
                                        className="flex-1 py-4 bg-orange-600 text-white font-bold rounded-xl text-sm hover:shadow-xl active:scale-95 transition-all"
                                      >
                                        Check
                                      </button>
                                      <button 
                                        onClick={() => speak(shadowingSentences[gapFillIndex].text)}
                                        className="p-4 bg-zinc-800 text-white rounded-xl"
                                      >
                                        <PlayCircle size={20} />
                                      </button>
                                   </div>
                                </div>
                             </div>
                          </div>
                        ) : isDictationMode ? (
                          <div className="space-y-4">
                             <div className="bg-zinc-900 p-6 rounded-2xl text-white">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-4">Listen and Type the sentence</p>
                                <div className="flex items-center gap-4 mb-6">
                                   <button onClick={() => speak(shadowingSentences[0]?.text || "No sentence found")} className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg active:scale-95">
                                      <PlayCircle size={24} />
                                   </button>
                                   <div className="h-px flex-1 bg-zinc-800" />
                                </div>
                                <textarea 
                                  value={dictationInput}
                                  onChange={e => setDictationInput(e.target.value)}
                                  placeholder="Type what you hear..."
                                  className="w-full h-32 bg-zinc-800 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                                />
                                <button 
                                  onClick={async () => {
                                    setIsAnalyzing(true);
                                    const res = await generateLesson(`Kiểm tra chính tả và ngữ pháp câu này: "${dictationInput}". So sánh với bản gốc: "${shadowingSentences[0]?.text}". Nhận xét ngắn gọn bằng tiếng Việt.`);
                                    setDictationFeedback(res);
                                    setIsAnalyzing(false);
                                  }}
                                  className="w-full mt-4 py-3 bg-orange-600 text-white font-bold rounded-xl text-sm"
                                >
                                  Check Accuracy
                                </button>
                                {dictationFeedback && (
                                  <div className="mt-4 p-4 bg-zinc-800 rounded-xl border border-zinc-700 text-xs text-orange-200">
                                    <ReactMarkdown>{dictationFeedback}</ReactMarkdown>
                                  </div>
                                )}
                             </div>
                          </div>
                        ) : (
                          <>
                          {isAnalyzing ? (
                            <div className="flex flex-col items-center py-20 gap-4">
                              <Loader2 size={32} className="animate-spin text-orange-500" />
                              <p className="text-gray-400 text-sm italic">Designing your game...</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                {matchingGame.map(item => (
                                  <button
                                    key={item.word}
                                    disabled={matchedPairs.includes(item.word)}
                                    onClick={() => setSelectedWord(item.word)}
                                    className={cn(
                                      "w-full p-4 text-left text-sm font-bold rounded-xl border transition-all",
                                      matchedPairs.includes(item.word) ? "bg-green-50 border-green-200 text-green-700 opacity-50" :
                                      selectedWord === item.word ? "bg-orange-500 text-white border-orange-600 shadow-lg" : isDarkMode ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-orange-500/50" : "bg-white border-gray-100 hover:border-orange-200"
                                    )}
                                  >
                                    {item.word}
                                  </button>
                                ))}
                              </div>
                              <div className="space-y-3">
                                {[...matchingGame].sort((a, b) => a.def.length - b.def.length).map(item => (
                                  <button
                                    key={item.def}
                                    disabled={matchedPairs.includes(item.word)}
                                    onClick={() => {
                                      if (selectedWord === item.word) {
                                        setMatchedPairs([...matchedPairs, item.word]);
                                        setSelectedWord(null);
                                      } else {
                                        setSelectedWord(null);
                                      }
                                    }}
                                    className={cn(
                                      "w-full p-4 text-left text-xs rounded-xl border transition-all min-h-[54px]",
                                      matchedPairs.includes(item.word) ? "bg-green-50 border-green-200 text-green-700 opacity-50" : isDarkMode ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-orange-500/50" : "bg-white border-gray-100 hover:border-orange-200"
                                    )}
                                  >
                                    {item.def}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          </>
                        )}
                        {matchedPairs.length === 5 && !isDictationMode && (
                          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-green-500 text-white p-6 rounded-2xl text-center space-y-2">
                             <Sparkles className="mx-auto" />
                             <h4 className="font-bold">Excellent Job!</h4>
                             <p className="text-sm opacity-90">You've mastered all the key terms from this lesson.</p>
                             <button onClick={startGames} className="mt-4 text-xs font-bold bg-white text-green-600 px-4 py-2 rounded-lg">Play Again</button>
                          </motion.div>
                        )}
                      </div>
                    )}
                    {activeResultTab === 'vocabulary' && (
                      <div className="not-prose space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex flex-col gap-1">
                             <h3 className="text-xl font-bold font-serif italic">Vocabulary Explorer</h3>
                             <div className="flex gap-2">
                               <button 
                                 onClick={() => setVocabViewMode('current')}
                                 className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-all", vocabViewMode === 'current' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400")}
                               >
                                 Lesson ({currentVocab.length})
                               </button>
                               <button 
                                 onClick={() => setVocabViewMode('history')}
                                 className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-all", vocabViewMode === 'history' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400")}
                               >
                                 My Bank ({globalVocab.length})
                               </button>
                               <button 
                                 onClick={() => {
                                   if (globalVocab.length === 0) {
                                     alert("Add some words to your bank first!");
                                     return;
                                   }
                                   setVocabViewMode('quiz');
                                   setIsQuizMode(true);
                                   setQuizInput('');
                                   setQuizFeedback(null);
                                 }}
                                 className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-all", vocabViewMode === 'quiz' ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400")}
                               >
                                 Daily Quiz 🚀
                               </button>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             {globalVocab.length > 0 && vocabViewMode !== 'quiz' && (
                              <button 
                                onClick={() => {
                                  setIsFlashcardMode(true);
                                  setCurrentFlashIdx(0);
                                  setIsCardFlipped(false);
                                }}
                                className="flex items-center gap-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full hover:shadow-xl transition-all"
                              >
                                <Sparkles size={14} /> Flashcard Session
                              </button>
                             )}
                          </div>
                        </div>

                        {vocabViewMode === 'quiz' || isFlashcardMode ? (
                           <div className={cn(
                             isFlashcardMode ? "fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" : "mt-6"
                           )}>
                              <div className="w-full max-w-md mx-auto">
                                 <div className="flex justify-between items-center mb-6 text-zinc-400 font-bold">
                                    <button 
                                      onClick={() => {
                                        setIsFlashcardMode(false);
                                        setIsQuizMode(false);
                                        if (vocabViewMode === 'quiz') setVocabViewMode('history');
                                      }} 
                                      className="text-xs font-bold uppercase tracking-widest bg-zinc-100 dark:bg-white/10 px-3 py-1 rounded-full text-zinc-600 dark:text-white"
                                    >
                                      Exit {isQuizMode ? 'Quiz' : 'Session'}
                                    </button>
                                    <span className="text-xs font-mono">{currentFlashIdx + 1} / {globalVocab.length}</span>
                                 </div>
                                 
                                 {isQuizMode ? (
                                    <motion.div 
                                       initial={{ opacity: 0, scale: 0.9 }}
                                       animate={{ opacity: 1, scale: 1 }}
                                       className={cn(
                                         "p-10 flex flex-col items-center justify-center text-center shadow-2xl rounded-3xl border-4",
                                         isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-orange-50"
                                       )}
                                     >
                                        <h4 className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-4">Vocabulary Quiz</h4>
                                        <p className={cn("text-xl font-medium mb-8", isDarkMode ? "text-white" : "text-zinc-900")}>How do you say? <br/><span className="text-2xl font-bold italic">"{globalVocab[currentFlashIdx]?.meaning}"</span></p>
                                        
                                        <input 
                                          autoFocus
                                          value={quizInput}
                                          onChange={e => setQuizInput(e.target.value)}
                                          onKeyDown={e => e.key === 'Enter' && checkQuiz()}
                                          placeholder="Type the English word..."
                                          className={cn(
                                            "w-full rounded-xl p-4 text-center text-lg outline-none focus:ring-2 focus:ring-orange-500 mb-4",
                                            isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-100 text-zinc-900"
                                          )}
                                        />
                                        
                                        {quizFeedback && (
                                          <motion.p 
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn("text-sm font-bold mb-4", quizFeedback.correct ? "text-green-400" : "text-red-400")}
                                          >
                                            {quizFeedback.msg}
                                          </motion.p>
                                        )}

                                        <div className="flex gap-4 w-full">
                                           <button 
                                             onClick={() => {
                                               const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                                               if (!SpeechRecognition) return;
                                               const recognition = new SpeechRecognition();
                                               recognition.lang = 'en-US';
                                               recognition.onstart = () => setIsListening(true);
                                               recognition.onresult = (e: any) => {
                                                 setQuizInput(e.results[0][0].transcript);
                                                 setIsListening(false);
                                               };
                                               recognition.onerror = () => setIsListening(false);
                                               recognition.onend = () => setIsListening(false);
                                               recognition.start();
                                             }}
                                             className={cn(
                                               "p-4 rounded-xl flex items-center justify-center transition-all",
                                               isListening ? "bg-red-500 text-white animate-pulse" : (isDarkMode ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")
                                             )}
                                           >
                                             <Mic size={20} />
                                           </button>
                                           <button onClick={checkQuiz} className="flex-1 bg-orange-600 rounded-xl font-bold text-sm text-white py-4 shadow-lg shadow-orange-500/20 active:scale-95 transition-all">Submit Answer</button>
                                        </div>
                                     </motion.div>
                                 ) : (
                                   <div 
                                     onClick={() => setIsCardFlipped(!isCardFlipped)}
                                     className="relative h-[400px] w-full [perspective:1000px] cursor-pointer"
                                   >
                                     <motion.div
                                       initial={false}
                                       animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                                       transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                                       className="w-full h-full relative [transform-style:preserve-3d]"
                                     >
                                       {/* Front */}
                                       <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-2xl border-4 border-orange-50">
                                          <h2 className="text-4xl font-bold text-zinc-900 mb-2">{globalVocab[currentFlashIdx]?.word}</h2>
                                          <p className="text-sm font-bold text-orange-400 uppercase tracking-widest">{globalVocab[currentFlashIdx]?.type}</p>
                                          <div className="mt-12 text-xs text-gray-300 italic uppercase tracking-tighter">Click to Flip</div>
                                       </div>
                                       
                                       {/* Back */}
                                       <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-orange-600 rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-2xl text-white">
                                          <p className="text-2xl font-medium mb-6 leading-tight">{globalVocab[currentFlashIdx]?.meaning}</p>
                                          <div className="w-full p-4 bg-white/10 rounded-2xl">
                                             <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Usage Example</p>
                                             <p className="text-sm italic italic leading-relaxed">"{globalVocab[currentFlashIdx]?.example}"</p>
                                          </div>
                                          <div className="mt-8 flex gap-4 w-full">
                                             <button 
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 setIsQuizMode(true);
                                                 setQuizInput('');
                                                 setQuizFeedback(null);
                                               }}
                                               className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-sm"
                                             >
                                               Test Me!
                                             </button>
                                             <button 
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 setCurrentFlashIdx((prev) => (prev + 1) % globalVocab.length);
                                                 setIsCardFlipped(false);
                                               }}
                                               className="flex-1 bg-white text-orange-600 py-3 rounded-xl font-bold text-sm"
                                             >
                                               Next Card
                                             </button>
                                          </div>
                                       </div>
                                     </motion.div>
                                   </div>
                                 )}
                              </div>
                           </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center gap-2 border px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border-gray-100 dark:border-zinc-700 shadow-sm mb-4">
                               <Search size={14} className="text-gray-400" />
                               <input 
                                 value={vocabSearch}
                                 onChange={e => setVocabSearch(e.target.value)}
                                 placeholder="Search word..."
                                 className="bg-transparent border-none text-xs outline-none w-full"
                               />
                            </div>
                            {(vocabViewMode === 'current' ? currentVocab : globalVocab)
                              .filter(v => v.word.toLowerCase().includes(vocabSearch.toLowerCase()))
                              .map((item, idx) => (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={`${vocabViewMode}-${idx}`}
                                className={cn(
                                  "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 group transition-all",
                                  isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-50 hover:shadow-md"
                                )}
                              >
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-orange-600">{item.word}</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-1.5 rounded">{item.type}</span>
                                    <button onClick={() => speak(item.word)} className="p-1 hover:text-orange-500"><PlayCircle size={12}/></button>
                                  </div>
                                  <p className="text-xs font-medium text-gray-700">{item.meaning}</p>
                                  <p className="text-[11px] text-gray-400 italic">Context: "{item.example}"</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">{item.date}</span>
                                  {vocabViewMode === 'history' && (
                                    <button 
                                      onClick={() => setGlobalVocab(prev => prev.filter((_, i) => i !== idx))}
                                      className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                            {(vocabViewMode === 'current' ? currentVocab : globalVocab).length === 0 && (
                              <div className="text-center py-20 opacity-50">
                                 <BookOpen size={48} className="mx-auto mb-4" />
                                 <p className="font-bold">No words found in this section.</p>
                                 <p className="text-xs">Generate a lesson to extract vocabulary.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {activeResultTab === 'progress' && (
                      <div className="not-prose space-y-8">
                        {/* Daily Goals Header */}
                        <div className={cn("p-8 rounded-3xl border transition-all overflow-hidden relative", isDarkMode ? "bg-zinc-950 border-zinc-800" : "bg-zinc-900 text-white border-none shadow-2xl")}>
                           <div className="relative z-10">
                              <h3 className="text-2xl font-bold font-serif italic mb-1">Today's Quest</h3>
                              <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-6">Master these targets to earn XP</p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {dailyGoals.map(goal => (
                                  <div key={goal.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                     <div className="flex justify-between items-center mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                                           {goal.icon}
                                        </div>
                                        <span className="text-[10px] font-bold font-mono">{goal.current}/{goal.target}</span>
                                     </div>
                                     <p className="text-xs font-bold mb-3">{goal.label}</p>
                                     <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${(goal.current/goal.target) * 100}%` }}
                                          className="h-full bg-orange-500"
                                        />
                                     </div>
                                  </div>
                                ))}
                              </div>
                           </div>
                           <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full -mr-20 -mt-20" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className={cn("p-6 rounded-3xl border transition-all hover:shadow-lg", isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-orange-50 border-orange-100 shadow-sm")}>
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-4">
                               <Clock size={16} />
                            </div>
                            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Exposure Time</p>
                            <h4 className={cn("text-2xl font-bold italic font-serif", isDarkMode ? "text-orange-400" : "text-orange-600")}>{learningHours}h 24m</h4>
                            <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                               <span className="text-green-500 font-bold">↑ 12.5%</span> vs last week
                            </p>
                          </div>
                          <div className={cn("p-6 rounded-3xl border transition-all hover:shadow-lg", isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-emerald-50 border-emerald-100 shadow-sm")}>
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                               <Sparkles size={16} />
                            </div>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Vocab Wealth</p>
                            <h4 className={cn("text-2xl font-bold italic font-serif", isDarkMode ? "text-emerald-400" : "text-emerald-600")}>{vocabularyCount}+</h4>
                            <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                               <span className="text-emerald-500 font-bold">New: 42</span> words today
                            </p>
                          </div>
                          <div className={cn("p-6 rounded-3xl border transition-all hover:shadow-lg bg-indigo-50 border-indigo-100", isDarkMode && "bg-zinc-900 border-zinc-800")}>
                             <div className="relative z-10">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                                   <Mic size={16} />
                                </div>
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Speaking Mastery</p>
                                <h4 className={cn("text-2xl font-bold italic font-serif", isDarkMode ? "text-indigo-400" : "text-indigo-600")}>
                                  {Object.keys(gradingFeedback).length > 0 ? Math.round(Object.values(gradingFeedback).reduce((a, b) => a + (b.score || 0), 0) / Object.keys(gradingFeedback).length) : 0}%
                                </h4>
                                <div className="h-1.5 w-full bg-indigo-200/30 rounded-full mt-3 overflow-hidden">
                                   <motion.div 
                                     initial={{ width: 0 }}
                                     animate={{ width: `${Object.keys(gradingFeedback).length > 0 ? Math.round(Object.values(gradingFeedback).reduce((a, b) => a + (b.score || 0), 0) / Object.keys(gradingFeedback).length) : 0}%` }}
                                     className="h-full bg-indigo-500"
                                   />
                                </div>
                             </div>
                           </div>
                        </div>
                        
                        <div className={cn("p-8 rounded-3xl border transition-all relative overflow-hidden", isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm")}>
                           <div className="flex justify-between items-center mb-8">
                             <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Weekly Consistency</h4>
                             <div className="flex gap-2">
                               <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                               <span className="w-2 h-2 rounded-full bg-orange-200"></span>
                             </div>
                           </div>
                           <div className="flex items-end justify-between h-32 px-4 relative z-10">
                              {[65, 45, 85, 30, 95, 70, 50].map((h, i) => (
                                <div key={i} className="w-8 flex flex-col items-center gap-2">
                                  <motion.div 
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: i * 0.1 }}
                                    className={cn("w-full rounded-t-xl transition-all shadow-sm", h > 80 ? "bg-orange-500" : h > 40 ? "bg-orange-300" : "bg-orange-100")}
                                  />
                                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
                                </div>
                              ))}
                           </div>
                           <div className="absolute inset-0 bg-gradient-to-t from-orange-50/10 to-transparent pointer-events-none" />
                        </div>

                        <div className={cn("p-6 rounded-3xl border transition-all", isDarkMode ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200 shadow-inner")}>
                           <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
                             <Target size={14} /> Weekly Challenges
                           </h4>
                           <div className="space-y-3">
                              <div className={cn("p-4 rounded-2xl flex items-center justify-between", isDarkMode ? "bg-zinc-800" : "bg-white border border-gray-100 shadow-sm")}>
                                 <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center font-bold">7d</div>
                                   <div>
                                      <p className="text-[11px] font-bold">7-Day Streak Runner</p>
                                      <p className="text-[9px] text-gray-500">Practice at least 15m every day</p>
                                   </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] font-bold text-orange-600">5/7</p>
                                    <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                       <div className="h-full bg-orange-500 w-[70%]" />
                                    </div>
                                 </div>
                              </div>
                              <div className={cn("p-4 rounded-2xl flex items-center justify-between", isDarkMode ? "bg-zinc-800" : "bg-white border border-gray-100 shadow-sm")}>
                                 <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-bold font-mono">100</div>
                                   <div>
                                      <p className="text-[11px] font-bold">Vocabulary Millionaire</p>
                                      <p className="text-[9px] text-gray-500">Learn 100 new context words</p>
                                   </div>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-[10px] font-bold text-emerald-600">DONE</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {activeResultTab === 'leaderboard' && (
                      <div className="not-prose space-y-6">
                        <div className="flex items-center gap-4 mb-2">
                           <div className="w-12 h-12 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                              <Sparkles size={24} />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold italic font-serif">Global ESL Masters</h3>
                              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Season 24 • Week 3</p>
                           </div>
                        </div>
                        <div className="space-y-3">
                           {leaderboard.map((item, i) => (
                             <div 
                               key={i} 
                               className={cn(
                                 "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                 item.name === 'You' 
                                   ? "bg-orange-600 border-orange-700 text-white scale-[1.02] shadow-xl ring-4 ring-orange-100" 
                                   : isDarkMode ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-white border-gray-100 hover:border-orange-100 hover:shadow-md"
                               )}
                             >
                               <div className="flex items-center gap-4">
                                 <span className={cn("text-xs font-bold w-4", item.name === 'You' ? "text-orange-200" : "text-gray-400")}>{i + 1}</span>
                                 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm", item.name === 'You' ? "bg-white text-orange-600" : isDarkMode ? "bg-zinc-800" : "bg-orange-50 text-orange-500")}>
                                   {item.name[0]}
                                 </div>
                                 <div>
                                    <p className="font-bold text-sm tracking-tight">{item.name}</p>
                                    <p className={cn("text-[9px] font-bold uppercase opacity-60", item.name === 'You' ? "text-white" : "text-gray-400")}>
                                      {i === 0 ? 'Master' : i === 1 ? 'Elite' : 'Student'}
                                    </p>
                                 </div>
                               </div>
                               <div className="text-right">
                                  <span className={cn("font-mono text-xs font-bold block", item.name === 'You' ? "text-white" : "text-orange-600")}>
                                    {item.score.toLocaleString()}
                                  </span>
                                  <span className="text-[8px] font-bold uppercase opacity-50">PTS</span>
                               </div>
                             </div>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key="empty"
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/30"
                >
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-6">
                    <BookOpen size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-400 mb-2">Chưa có bài học nào</h3>
                  <p className="text-gray-400 max-w-xs text-sm leading-relaxed">
                    Nhập nội dung ở cột bên trái để bắt đầu tạo giáo án thông minh với AI.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 mt-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-4">
          <p className="text-sm text-gray-400">
            Powered by Gemini AI • Designed for English Pedagogy Excellence
          </p>
          <div className="flex items-center justify-center gap-6">
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors">Privacy</a>
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors">Terms</a>
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors">Feedback</a>
          </div>
        </div>
      </footer>

      {/* Background Decor */}
      <div className="fixed top-0 right-0 -z-10 w-[500px] h-[500px] bg-orange-50/50 rounded-full blur-3xl opacity-50" />
      <div className="fixed bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-orange-50/50 rounded-full blur-3xl opacity-50" />
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #fdfcfb;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ffe5d4;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ffd6ba;
        }
        
        .prose h2 { margin-top: 2em; margin-bottom: 1em; border-bottom: 2px solid #fff5ed; padding-bottom: 0.5em; color: #ea580c; }
        .prose h3 { margin-top: 1.5em; margin-bottom: 0.75em; color: #1a1a1a; }
        .prose p { margin-bottom: 1.25em; }
        .prose ul, .prose ol { margin-bottom: 1.5em; padding-left: 1.25em; }
        .prose li { margin-bottom: 0.5em; }
        .prose blockquote { border-left-color: #f97316; font-style: italic; background: #fff8f4; padding: 1rem; border-radius: 0.5rem; }
        .prose code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-weight: 500; font-size: 0.875rem; }
        .bilingual-translation { 
          opacity: ${showSubtitles ? '0.6' : '0'};
          font-size: 0.85em; 
          transition: all 0.3s ease;
          display: ${showSubtitles ? 'inline' : 'none'};
        }
      `}</style>
    </div>
  );
}
