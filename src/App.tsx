import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Youtube, 
  Instagram, 
  Facebook, 
  Twitter, 
  Music2, 
  Zap, 
  Copy, 
  Check, 
  Loader2, 
  TrendingUp,
  Sparkles,
  User,
  LogOut,
  History,
  BarChart2,
  Network,
  Share2,
  Database,
  Lock,
  ChevronRight,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  Play,
  ArrowRight
} from 'lucide-react';
import { generateViralSEO, generateKnowledgeGraph, KnowledgeGraph, generateViralAudit, ViralAuditPackage, TrendDashboardData, generateTrendDashboardData, EngagementPrediction, predictVideoEngagement } from './lib/gemini';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { fetchYouTubeChannel, fetchYouTubeVideos, YouTubeChannel, YouTubeVideo } from './lib/youtube';

interface SEOPackage {
  youtube: { title: string; description: string; hashtags: string };
  shorts: { title: string; caption: string; hashtags: string };
  tiktok: { hook: string; caption: string; hashtags: string };
  instagram: { caption: string; hashtags: string };
  facebook: { title: string; description: string; hashtags: string };
  x: { post: string; hashtags: string };
  keywordBank: string;
}

interface VaultItem {
  id: string;
  url: string;
  context: string;
  seo: SEOPackage;
  timestamp: any;
}

type TabType = 'engine' | 'analytics' | 'brand' | 'vault';

export default function App() {
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App settings/navigation state
  const [activeTab, setActiveTab] = useState<TabType>('engine');
  
  // YouTube integration state
  const [channel, setChannel] = useState<YouTubeChannel | null>(null);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);

  // Content DNA / Knowledge Graph state
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(null);
  const [kgLoading, setKgLoading] = useState(false);

  // Generation state
  const [url, setUrl] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SEOPackage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  // SEO Vault state
  const [vault, setVault] = useState<VaultItem[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);

  // Recent uploads audit and catalyst state
  const [recentAudits, setRecentAudits] = useState<Record<string, { loading: boolean; data?: ViralAuditPackage; error?: string }>>({});
  const [expandedMetadataVideoId, setExpandedMetadataVideoId] = useState<string | null>(null);
  const [expandedAuditVideoId, setExpandedAuditVideoId] = useState<string | null>(null);
  const [expandedExplanationVideoId, setExpandedExplanationVideoId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});

  // Error tracking & troubleshooting state
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  // Sub-tabs for Analytics Workspace
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'audit' | 'trends' | 'engagement'>('audit');

  // Trend Dashboard state
  const [trendQuery, setTrendQuery] = useState('lofi chill music');
  const [trendData, setTrendData] = useState<TrendDashboardData | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  // Video Engagement tools state
  const [candidateTitle, setCandidateTitle] = useState('');
  const [thumbnailConcept, setThumbnailConcept] = useState('');
  const [prediction, setPrediction] = useState<EngagementPrediction | null>(null);
  const [predicting, setPredicting] = useState(false);

  const extractCurrentHashtags = (desc: string, title: string): string => {
    const hashRegex = /#[a-zA-Z0-9_]+/g;
    const matches = (desc || "").match(hashRegex);
    if (matches && matches.length > 0) {
      return matches.slice(0, 8).join(' ');
    }
    const cleanTitleWords = title.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4);
    if (cleanTitleWords.length > 0) {
      return cleanTitleWords.slice(0, 4).map(w => `#${w}`).join(' ');
    }
    return '#creator #viral #trending';
  };

  const extractCurrentKeywords = (desc: string, title: string): string => {
    const cleanText = `${title} ${desc || ""}`.toLowerCase().replace(/[^a-zA-Z0-9\s,]/g, '');
    const words = cleanText.split(/\s+/).filter(w => w.length > 4 && !['about', 'their', 'there', 'would', 'could', 'should', 'video', 'music', 'channel'].includes(w));
    const uniqueWords = Array.from(new Set(words));
    if (uniqueWords.length > 0) {
      return uniqueWords.slice(0, 8).join(', ');
    }
    return 'algorithm tuning, viral catalyst, social discovery, organic growth';
  };

  const runRecentVideoAudit = async (video: YouTubeVideo) => {
    setRecentAudits(prev => ({
      ...prev,
      [video.id]: { loading: true }
    }));

    try {
      const data = await generateViralAudit(video.title, video.description || "", knowledgeGraph);
      setRecentAudits(prev => ({
        ...prev,
        [video.id]: { loading: false, data }
      }));
    } catch (e: any) {
      console.error(e);
      setRecentAudits(prev => ({
        ...prev,
        [video.id]: { loading: false, error: e.message || "Failed to complete audit" }
      }));
    }
  };

  const saveAuditExplanationToKnowledgeDNA = async (videoId: string, explanation: string) => {
    if (!user) {
      alert("Please sign in to save data.");
      return;
    }

    try {
      setSaveStatus(prev => ({ ...prev, [`dna-${videoId}`]: 'saving' }));
      const currentKg = knowledgeGraph || {
        niche: "Music & Creative Content",
        toneOfVoice: "Engaging & Viral",
        keyAudiences: [],
        topPerformanceFactors: [],
        mainThemes: [],
        recommendedHashtags: [],
        suggestedHooks: []
      };

      const updatedKg: KnowledgeGraph = {
        ...currentKg,
        topPerformanceFactors: Array.from(new Set([...currentKg.topPerformanceFactors, "Intelligent Audit Tuning", "Mindstorm Optimization"])),
        mainThemes: Array.from(new Set([...currentKg.mainThemes, "Platform Wide Viral Logic"])),
        suggestedHooks: Array.from(new Set([...currentKg.suggestedHooks, `Strategic Shift: ${explanation.slice(0, 100)}...`]))
      };

      await setDoc(doc(db, "knowledge_graphs", user.uid), updatedKg);
      setKnowledgeGraph(updatedKg);
      setSaveStatus(prev => ({ ...prev, [`dna-${videoId}`]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [`dna-${videoId}`]: '' }));
      }, 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus(prev => ({ ...prev, [`dna-${videoId}`]: 'error' }));
    }
  };

  const saveAuditToSeoVault = async (videoId: string, title: string, description: string, hashtags: string, keywords: string) => {
    if (!user) {
      alert("Please sign in to save packages.");
      return;
    }

    try {
      setSaveStatus(prev => ({ ...prev, [`vault-${videoId}`]: 'saving' }));
      
      const seoData: SEOPackage = {
        youtube: { title, description, hashtags },
        shorts: { title, caption: description.slice(0, 200), hashtags },
        tiktok: { hook: title, caption: description.slice(0, 150), hashtags },
        instagram: { caption: description.slice(0, 200), hashtags },
        facebook: { title, description, hashtags },
        x: { post: `${title} ${hashtags}`.slice(0, 240), hashtags },
        keywordBank: keywords
      };

      const docRef = await addDoc(collection(db, "history"), {
        uid: user.uid,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        context: `Viral Catalyst Spark Optimized Upload for Video ID ${videoId}`,
        seo: seoData,
        timestamp: new Date()
      });

      setVault(prev => [{
        id: docRef.id,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        context: `Viral Catalyst Spark Optimized Upload for Video ID ${videoId}`,
        seo: seoData,
        timestamp: new Date()
      }, ...prev]);

      setSaveStatus(prev => ({ ...prev, [`vault-${videoId}`]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [`vault-${videoId}`]: '' }));
      }, 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus(prev => ({ ...prev, [`vault-${videoId}`]: 'error' }));
    }
  };

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (currentUser) {
        // Fetch persisted knowledge graph
        fetchPersistedData(currentUser.uid);
      } else {
        setChannel(null);
        setVideos([]);
        setKnowledgeGraph(null);
        setVault([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Update thumbnail URL when url changes
  useEffect(() => {
    if (url) {
      let vidId = "";
      if (url.includes("v=")) vidId = url.split("v=")[1].split("&")[0];
      else if (url.includes("shorts/")) vidId = url.split("shorts/")[1].split("?")[0];
      else if (url.includes("be/")) vidId = url.split("be/")[1].split("?")[0];
      
      if (vidId) {
        setThumbnail(`https://img.youtube.com/vi/${vidId}/mqdefault.jpg`);
      } else {
        setThumbnail(null);
      }
    } else {
      setThumbnail(null);
    }
  }, [url]);

  const fetchPersistedData = async (uid: string) => {
    try {
      // 0. Fetch User Profile Cache (YouTube channel & videos)
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc && userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.channelData) {
            setChannel(userData.channelData);
          }
          if (userData.videosData) {
            setVideos(userData.videosData);
          }
        }
      } catch (e) {
        console.error("Failed to load cached user details:", e);
      }

      // 1. Fetch Knowledge Graph
      let kgDoc;
      try {
        kgDoc = await getDoc(doc(db, "knowledge_graphs", uid));
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `knowledge_graphs/${uid}`);
      }
      if (kgDoc && kgDoc.exists()) {
        setKnowledgeGraph(kgDoc.data() as KnowledgeGraph);
      }

      // 2. Fetch Vault History
      setVaultLoading(true);
      const q = query(
        collection(db, "history"), 
        where("uid", "==", uid),
        orderBy("timestamp", "desc"),
        limit(20)
      );
      let snap;
      try {
        snap = await getDocs(q);
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'history');
      }
      if (snap) {
        const items: VaultItem[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as VaultItem);
        });
        setVault(items);
      }
      setVaultLoading(false);
    } catch (e) {
      console.error("Error fetching persisted user data:", e);
      setVaultLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setYoutubeError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        setAccessToken(token);
        // Sync channel stats and videos
        await syncYouTubeAccount(token, result.user.uid);
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);
      setYoutubeError(error.message || "Sign-in was cancelled or failed.");
      alert("Google Sign-In failed or was cancelled.");
    } finally {
      setAuthLoading(false);
    }
  };

  const syncYouTubeAccount = async (token: string, uid: string) => {
    setYoutubeLoading(true);
    setYoutubeError(null);
    try {
      const channelData = await fetchYouTubeChannel(token);
      setChannel(channelData);

      let videoList: YouTubeVideo[] = [];
      if (channelData.uploadsPlaylistId) {
        try {
          videoList = await fetchYouTubeVideos(token, channelData.uploadsPlaylistId);
          setVideos(videoList);
        } catch (vidErr: any) {
          console.warn("Could not load recent videos during sync:", vidErr);
          // Don't fail the whole sync if only the uploads list fails to load
        }
      }

      // Save user profile info AND synced data cache to Firestore
      try {
        await setDoc(doc(db, "users", uid), {
          uid,
          channelId: channelData.id,
          channelTitle: channelData.title,
          avatar: channelData.avatar,
          lastSynced: new Date().toISOString(),
          channelData,
          videosData: videoList
        }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${uid}`);
      }
    } catch (e: any) {
      console.error("YouTube sync error:", e);
      setYoutubeError(e.message || String(e));
      alert("Failed to sync YouTube channel statistics. Check out the 'Real-time Insights' tab for troubleshooting instructions.");
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setAccessToken(null);
  };

  const handleBuildKnowledgeGraph = async () => {
    if (!user || videos.length === 0) return;
    setKgLoading(true);
    try {
      const summaryVideos = videos.slice(0, 5).map(v => ({ title: v.title, description: v.description }));
      const graph = await generateKnowledgeGraph(summaryVideos);
      setKnowledgeGraph(graph);

      // Persist in Firestore
      try {
        await setDoc(doc(db, "knowledge_graphs", user.uid), graph);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `knowledge_graphs/${user.uid}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to compile user content DNA profile.");
    } finally {
      setKgLoading(false);
    }
  };

  const handleFetchTrends = async () => {
    if (!trendQuery) return;
    setTrendLoading(true);
    try {
      const data = await generateTrendDashboardData(trendQuery);
      setTrendData(data);
    } catch (e) {
      console.error("Trends analysis failure:", e);
    } finally {
      setTrendLoading(false);
    }
  };

  const handlePredictEngagement = async () => {
    if (!candidateTitle) return;
    setPredicting(true);
    try {
      const data = await predictVideoEngagement(candidateTitle, thumbnailConcept);
      setPrediction(data);
    } catch (e) {
      console.error("Engagement simulation failure:", e);
      alert("Failed to run predictive engagement analysis.");
    } finally {
      setPredicting(false);
    }
  };

  // Auto-fetch trends when the insights/analytics tab opens
  useEffect(() => {
    if (activeTab === 'analytics' && !trendData) {
      handleFetchTrends();
    }
  }, [activeTab]);

  const handleGenerate = async () => {
    if (!url || !context) return;
    setLoading(true);
    try {
      const data = await generateViralSEO(url, context, knowledgeGraph);
      setResult(data);

      // Persist in history if user is authenticated
      if (user) {
        let docRef;
        try {
          docRef = await addDoc(collection(db, "history"), {
            uid: user.uid,
            url,
            context,
            seo: data,
            timestamp: new Date()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, "history");
        }

        if (docRef) {
          // Add to active Vault state
          setVault(prev => [{
            id: docRef.id,
            url,
            context,
            seo: data,
            timestamp: new Date()
          }, ...prev]);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate SEO package. Check your API configuration.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectVideoForRepurpose = (video: YouTubeVideo) => {
    setUrl(`https://www.youtube.com/watch?v=${video.id}`);
    setContext(`Original Video Title: ${video.title}\nDescription: ${video.description.slice(0, 150)}...\nGrounding Style: High engagement viral distribution.`);
    setActiveTab('engine');
  };

  return (
    <div className="min-h-screen bg-bg text-slate-200 font-sans flex flex-col">
      {/* Dynamic Background Glow */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-mag/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 -right-40 w-96 h-96 bg-cyan/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="border-b border-white/5 bg-card/40 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-gold to-amber-500 rounded-xl text-black">
            <Zap size={20} fill="currentColor" />
          </div>
          <div>
            <h1 className="font-display font-black tracking-tight text-white text-lg gold-glow">
              VIRAL CATALYST <span className="text-gold">V4.0</span>
            </h1>
            <p className="text-[10px] text-cyan uppercase tracking-widest font-bold">Turbo social discovery</p>
          </div>
        </div>

        {/* User Account Bar */}
        <div className="flex items-center space-x-4">
          {authLoading ? (
            <Loader2 className="animate-spin text-slate-500" size={18} />
          ) : user ? (
            <div className="flex items-center space-x-4 bg-white/5 rounded-2xl px-4 py-2 border border-white/10">
              {channel ? (
                <img src={channel.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-gold" />
              ) : user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-cyan/20 flex items-center justify-center text-cyan">
                  <User size={16} />
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-white max-w-[120px] truncate">
                  {channel ? channel.title : user.displayName || 'Creator'}
                </p>
                <p className="text-[9px] text-slate-400 font-mono">
                  {channel ? `${(channel.subscriberCount / 1000).toFixed(1)}k Subs` : 'Connected'}
                </p>
              </div>
              <button 
                onClick={handleSignOut}
                className="p-1 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-red-400"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleGoogleSignIn}
              className="bg-gradient-to-r from-cyan/20 to-cyan/10 hover:from-cyan hover:to-cyan hover:text-black border border-cyan/40 px-5 py-2 rounded-2xl text-xs font-display font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,245,255,0.1)] hover:shadow-[0_0_25px_rgba(0,245,255,0.3)] flex items-center space-x-2"
            >
              <Youtube size={16} />
              <span>Connect Channels</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 border-r border-white/5 p-4 space-y-2 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible">
          <button 
            onClick={() => setActiveTab('engine')}
            className={`w-full flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl transition-all font-display text-xs uppercase tracking-wider ${activeTab === 'engine' ? 'bg-gold/10 text-gold border border-gold/20' : 'hover:bg-white/5 text-slate-400'}`}
          >
            <Zap size={16} fill={activeTab === 'engine' ? "currentColor" : "none"} />
            <span>AI Engine</span>
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            disabled={!user}
            className={`w-full flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl transition-all font-display text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed ${activeTab === 'analytics' ? 'bg-cyan/10 text-cyan border border-cyan/20' : 'hover:bg-white/5 text-slate-400'}`}
          >
            <BarChart2 size={16} />
            <span>Real-time Insights</span>
          </button>
          <button 
            onClick={() => setActiveTab('brand')}
            disabled={!user}
            className={`w-full flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl transition-all font-display text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed ${activeTab === 'brand' ? 'bg-mag/10 text-mag border border-mag/20' : 'hover:bg-white/5 text-slate-400'}`}
          >
            <Network size={16} />
            <span>Knowledge DNA</span>
          </button>
          <button 
            onClick={() => setActiveTab('vault')}
            disabled={!user}
            className={`w-full flex items-center justify-center md:justify-start space-x-3 px-4 py-3 rounded-xl transition-all font-display text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed ${activeTab === 'vault' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'hover:bg-white/5 text-slate-400'}`}
          >
            <History size={16} />
            <span>SEO Vault</span>
          </button>
        </nav>

        {/* Dynamic Workspace Panel */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {/* engine tab */}
            {activeTab === 'engine' && (
              <motion.div 
                key="engine"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* Visual Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">AI Content Repurposing Suite</h2>
                    <p className="text-xs text-slate-400">Instantly generate high-converting algorithm-primed content packages grounded with past metrics.</p>
                  </div>
                  {knowledgeGraph && (
                    <div className="flex items-center space-x-2 bg-mag/10 border border-mag/20 text-mag px-3 py-1.5 rounded-xl text-xs font-mono font-bold">
                      <Sparkles size={14} />
                      <span>Knowledge Graph Grounding Active</span>
                    </div>
                  )}
                </div>

                {/* Input Panel */}
                <section className="glass rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold to-transparent opacity-50" />
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="block font-display text-[10px] text-slate-400 tracking-widest uppercase">YouTube Video / Short Link</label>
                        <input 
                          type="text" 
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="Paste URL here..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan/50 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block font-display text-[10px] text-slate-400 tracking-widest uppercase">Artist, Song & Vibe Context</label>
                        <textarea 
                          value={context}
                          onChange={(e) => setContext(e.target.value)}
                          rows={4}
                          placeholder="Provide the background vibe, style, narrative, or specific focus point for the distribution engine..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan/50 outline-none transition-all resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col justify-between">
                      <div className="relative aspect-video bg-black/60 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center group">
                        {thumbnail ? (
                          <img src={thumbnail} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-slate-600 flex flex-col items-center space-y-2">
                            <Youtube size={48} strokeWidth={1} />
                            <span className="text-[10px] font-display tracking-widest uppercase text-slate-500">Preview Ready</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                          <span className="text-[10px] font-display text-gold tracking-widest uppercase">Algorithm Target Locked</span>
                        </div>
                      </div>

                      <button 
                        onClick={handleGenerate}
                        disabled={loading || !url || !context}
                        className="mt-6 w-full bg-gradient-to-r from-gold to-amber-500 hover:from-gold hover:to-gold text-black font-display font-black py-4 rounded-xl shadow-[0_0_30px_rgba(255,215,0,0.2)] hover:shadow-[0_0_40px_rgba(255,215,0,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 uppercase tracking-wider"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>Igniting Algorithms...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={20} fill="currentColor" />
                            <span>Ignite Viral SEO</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Outputs Display */}
                {result && (
                  <div className="space-y-8">
                    {/* YouTube Main */}
                    <PlatformCard 
                      icon={<Youtube className="text-red-500" />}
                      name="YouTube & Shorts"
                      title={result.youtube.title}
                      content={result.youtube.description}
                      hashtags={result.youtube.hashtags}
                      onCopy={() => copyToClipboard(`${result.youtube.title}\n\n${result.youtube.description}\n\n${result.youtube.hashtags}`, 'yt')}
                      isCopied={copiedId === 'yt'}
                      url={url}
                      featured
                    />

                    <div className="grid md:grid-cols-2 gap-6">
                      <PlatformCard 
                        icon={<Music2 className="text-cyan" />}
                        name="TikTok Algorithm"
                        title={result.tiktok.hook}
                        content={result.tiktok.caption}
                        hashtags={result.tiktok.hashtags}
                        onCopy={() => copyToClipboard(`${result.tiktok.hook}\n\n${result.tiktok.caption}\n\n${result.tiktok.hashtags}`, 'tt')}
                        isCopied={copiedId === 'tt'}
                        url={url}
                      />
                      <PlatformCard 
                        icon={<Instagram className="text-mag" />}
                        name="Instagram Reels"
                        title="Visual Discovery Pack"
                        content={result.instagram.caption}
                        hashtags={result.instagram.hashtags}
                        onCopy={() => copyToClipboard(`${result.instagram.caption}\n\n${result.instagram.hashtags}`, 'ig')}
                        isCopied={copiedId === 'ig'}
                        url={url}
                      />
                      <PlatformCard 
                        icon={<Facebook className="text-blue-500" />}
                        name="Facebook Watch"
                        title={result.facebook.title}
                        content={result.facebook.description}
                        hashtags={result.facebook.hashtags}
                        onCopy={() => copyToClipboard(`${result.facebook.title}\n\n${result.facebook.description}\n\n${result.facebook.hashtags}`, 'fb')}
                        isCopied={copiedId === 'fb'}
                        url={url}
                      />
                      <PlatformCard 
                        icon={<Twitter className="text-white" />}
                        name="X Trending"
                        title="Engagement Thread"
                        content={result.x.post}
                        hashtags={result.x.hashtags}
                        onCopy={() => copyToClipboard(`${result.x.post}\n\n${result.x.hashtags}`, 'x')}
                        isCopied={copiedId === 'x'}
                        url={url}
                      />
                    </div>

                    {/* Keyword Bank */}
                    <div className="glass rounded-3xl p-8 border-cyan/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4">
                        <TrendingUp className="text-cyan opacity-20" size={64} />
                      </div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-cyan/10 rounded-lg">
                            <Sparkles className="text-cyan" size={20} />
                          </div>
                          <h3 className="font-display text-sm tracking-widest text-cyan uppercase">High-Value Keyword Cluster</h3>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-[10px] font-mono text-slate-500">
                            CHARS: <span className={result.keywordBank.length >= 491 && result.keywordBank.length <= 500 ? "text-green-400" : "text-red-400"}>{result.keywordBank.length}</span> / 500
                          </div>
                          <button 
                            onClick={() => copyToClipboard(result.keywordBank, 'kb')}
                            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-cyan"
                          >
                            {copiedId === 'kb' ? <Check size={18} /> : <Copy size={18} />}
                          </button>
                        </div>
                      </div>
                      <p className="font-mono text-xs leading-relaxed text-slate-300 bg-black/40 p-6 rounded-2xl border border-white/5">
                        {result.keywordBank}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* analytics tab */}
            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                  <div>
                    <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">Real-Time Channel Insights</h2>
                    <p className="text-xs text-slate-400">Deep, accurate metric evaluation and growth tools direct from your workspace.</p>
                  </div>
                  
                  {/* Troubleshooting connection guidance when there are auth errors */}
                  {youtubeError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 max-w-md">
                      <span className="font-bold">⚠️ Connection Alert:</span>
                      <span className="truncate">{youtubeError}</span>
                    </div>
                  )}
                </div>

                {/* Sub-tab Switcher Menu */}
                <div className="flex border-b border-white/5 p-1 bg-black/40 rounded-2xl max-w-md">
                  <button
                    onClick={() => setAnalyticsSubTab('audit')}
                    className={`flex-1 py-2.5 rounded-xl text-center text-xs font-display font-bold uppercase tracking-wider transition-all ${analyticsSubTab === 'audit' ? 'bg-gold text-black shadow-lg shadow-gold/10' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    My Channel Audit
                  </button>
                  <button
                    onClick={() => setAnalyticsSubTab('trends')}
                    className={`flex-1 py-2.5 rounded-xl text-center text-xs font-display font-bold uppercase tracking-wider transition-all ${analyticsSubTab === 'trends' ? 'bg-cyan text-black shadow-lg shadow-cyan/10' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Trend Dashboard
                  </button>
                  <button
                    onClick={() => setAnalyticsSubTab('engagement')}
                    className={`flex-1 py-2.5 rounded-xl text-center text-xs font-display font-bold uppercase tracking-wider transition-all ${analyticsSubTab === 'engagement' ? 'bg-mag text-white shadow-lg shadow-mag/10' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Engagement Simulator
                  </button>
                </div>

                {analyticsSubTab === 'audit' && (
                  <>
                    {channel ? (
                  <div className="space-y-8">
                    {/* Stats overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="glass rounded-3xl p-6 relative overflow-hidden">
                        <div className="text-slate-400 text-xs font-mono mb-2 uppercase">Subscribers</div>
                        <div className="text-3xl font-display font-black text-white">
                          {channel.subscriberCount.toLocaleString()}
                        </div>
                        <div className="absolute bottom-4 right-4 text-cyan/20">
                          <Youtube size={48} />
                        </div>
                      </div>

                      <div className="glass rounded-3xl p-6 relative overflow-hidden">
                        <div className="text-slate-400 text-xs font-mono mb-2 uppercase">Total Video Views</div>
                        <div className="text-3xl font-display font-black text-white">
                          {channel.viewCount.toLocaleString()}
                        </div>
                        <div className="absolute bottom-4 right-4 text-gold/20">
                          <TrendingUp size={48} />
                        </div>
                      </div>

                      <div className="glass rounded-3xl p-6 relative overflow-hidden">
                        <div className="text-slate-400 text-xs font-mono mb-2 uppercase">Total Videos</div>
                        <div className="text-3xl font-display font-black text-white">
                          {channel.videoCount}
                        </div>
                        <div className="absolute bottom-4 right-4 text-mag/20">
                          <BarChart2 size={48} />
                        </div>
                      </div>
                    </div>

                    {/* Elite 3-Upload Catalyst Engine */}
                    <div className="space-y-6">
                      <div className="border-b border-white/10 pb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 bg-gradient-to-r from-gold/20 to-cyan/20 rounded-xl border border-gold/30">
                            <Zap className="text-gold animate-pulse" size={24} />
                          </div>
                          <div>
                            <h3 className="font-display text-lg font-black text-white uppercase tracking-tight">
                              🚀 Elite Turbo Social Discovery Audit & Catalyst
                            </h3>
                            <p className="text-xs text-slate-400">
                              Powered by Mindstorm™ technology. Crunches real-time metadata of your latest 3 uploads to recommend high-converting algorithmic adjustments.
                            </p>
                          </div>
                        </div>
                      </div>

                      {videos.length === 0 ? (
                        <div className="glass rounded-3xl p-8 text-center text-slate-500 text-xs">
                          No uploaded videos found in this channel to audit.
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {videos.slice(0, 3).map((video, index) => {
                            const isMetadataExpanded = expandedMetadataVideoId === video.id;
                            const isAuditExpanded = expandedAuditVideoId === video.id;
                            const isExplanationExpanded = expandedExplanationVideoId === video.id;
                            const auditState = recentAudits[video.id] || { loading: false };

                            const currentHashtags = extractCurrentHashtags(video.description, video.title);
                            const currentKeywords = extractCurrentKeywords(video.description, video.title);

                            return (
                              <div 
                                key={`catalyst-${video.id}`}
                                className="glass rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent p-6 space-y-6 relative overflow-hidden shadow-2xl"
                              >
                                {/* Badge and header */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                  <div className="flex items-center space-x-3">
                                    <span className="px-3 py-1 bg-gold/10 text-gold border border-gold/20 rounded-full text-[10px] font-mono uppercase tracking-wider">
                                      Upload #{index + 1}
                                    </span>
                                    <h4 className="text-sm font-bold text-white tracking-tight">{video.title}</h4>
                                  </div>
                                  <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
                                    <span className="flex items-center space-x-1">
                                      <TrendingUp size={14} className="text-cyan" />
                                      <span>{video.viewCount.toLocaleString()} Views</span>
                                    </span>
                                    <span className="text-slate-600">|</span>
                                    <span>Uploaded: {new Date(video.publishedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>

                                {/* Thumbnail Container (Large/Clear on Mobile) */}
                                <div className="space-y-2">
                                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                                    Current Thumbnail Visual Check
                                  </div>
                                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 group shadow-lg">
                                    <img 
                                      src={video.thumbnail.replace("mqdefault", "maxresdefault")} 
                                      onError={(e) => {
                                        // fallback if maxresdefault doesn't exist
                                        (e.target as HTMLImageElement).src = video.thumbnail;
                                      }}
                                      alt={video.title} 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent flex items-end p-4">
                                      <div className="text-xs text-white/90 font-mono truncate max-w-full">
                                        ID: {video.id}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Double Drawer Expansion Buttons */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                  <button
                                    onClick={() => {
                                      setExpandedMetadataVideoId(isMetadataExpanded ? null : video.id);
                                      setExpandedAuditVideoId(null);
                                    }}
                                    className={`flex items-center justify-center space-x-2 px-5 py-3 rounded-xl font-display text-xs font-bold uppercase tracking-wider border transition-all ${
                                      isMetadataExpanded 
                                        ? 'bg-white/10 border-white/20 text-white' 
                                        : 'bg-black/40 border-white/5 hover:border-white/10 text-slate-300'
                                    }`}
                                  >
                                    <span>📂 {isMetadataExpanded ? 'Close' : 'Inspect'} Current Metadata Columns</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setExpandedAuditVideoId(isAuditExpanded ? null : video.id);
                                      setExpandedMetadataVideoId(null);
                                    }}
                                    className={`flex items-center justify-center space-x-2 px-5 py-3 rounded-xl font-display text-xs font-bold uppercase tracking-wider border transition-all ${
                                      isAuditExpanded 
                                        ? 'bg-gold/10 border-gold/30 text-gold shadow-lg shadow-gold/5' 
                                        : 'bg-gradient-to-r from-gold/10 to-cyan/10 border-gold/20 hover:border-gold/30 text-gold'
                                    }`}
                                  >
                                    <Zap size={14} className="animate-bounce" />
                                    <span>⚡ {isAuditExpanded ? 'Close' : 'Ignite'} Elite AI Catalyst Spark</span>
                                  </button>
                                </div>

                                {/* A. Expandable Current Metadata Columns */}
                                <AnimatePresence>
                                  {isMetadataExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="bg-black/40 border border-white/5 rounded-2xl p-5 space-y-4">
                                        <div className="text-xs font-display font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">
                                          Current Metadata Columns Breakdown
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                          {/* Title Column */}
                                          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                                            <div>
                                              <div className="text-[10px] font-mono text-slate-400 uppercase mb-2">Video Title</div>
                                              <p className="text-xs text-white leading-relaxed font-semibold break-words">{video.title}</p>
                                            </div>
                                            <button 
                                              onClick={() => {
                                                navigator.clipboard.writeText(video.title);
                                                setSaveStatus(prev => ({ ...prev, [`copy-curr-title-${video.id}`]: 'copied' }));
                                                setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-curr-title-${video.id}`]: '' })), 2000);
                                              }}
                                              className="mt-4 py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono text-slate-300 flex items-center justify-center space-x-1 transition-all"
                                            >
                                              {saveStatus[`copy-curr-title-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                              <span>{saveStatus[`copy-curr-title-${video.id}`] === 'copied' ? 'Copied' : 'Copy Title'}</span>
                                            </button>
                                          </div>

                                          {/* Description Column */}
                                          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                                            <div>
                                              <div className="text-[10px] font-mono text-slate-400 uppercase mb-2">Video Description</div>
                                              <p className="text-xs text-slate-300 leading-relaxed max-h-32 overflow-y-auto break-words whitespace-pre-wrap font-mono">
                                                {video.description || 'No description found.'}
                                              </p>
                                            </div>
                                            <button 
                                              onClick={() => {
                                                navigator.clipboard.writeText(video.description || "");
                                                setSaveStatus(prev => ({ ...prev, [`copy-curr-desc-${video.id}`]: 'copied' }));
                                                setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-curr-desc-${video.id}`]: '' })), 2000);
                                              }}
                                              className="mt-4 py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono text-slate-300 flex items-center justify-center space-x-1 transition-all"
                                            >
                                              {saveStatus[`copy-curr-desc-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                              <span>{saveStatus[`copy-curr-desc-${video.id}`] === 'copied' ? 'Copied' : 'Copy Description'}</span>
                                            </button>
                                          </div>

                                          {/* Hashtags Column */}
                                          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                                            <div>
                                              <div className="text-[10px] font-mono text-slate-400 uppercase mb-2">High-Value Hashtags</div>
                                              <p className="text-xs text-cyan font-mono leading-relaxed break-words">{currentHashtags}</p>
                                            </div>
                                            <button 
                                              onClick={() => {
                                                navigator.clipboard.writeText(currentHashtags);
                                                setSaveStatus(prev => ({ ...prev, [`copy-curr-hash-${video.id}`]: 'copied' }));
                                                setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-curr-hash-${video.id}`]: '' })), 2000);
                                              }}
                                              className="mt-4 py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono text-slate-300 flex items-center justify-center space-x-1 transition-all"
                                            >
                                              {saveStatus[`copy-curr-hash-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                              <span>{saveStatus[`copy-curr-hash-${video.id}`] === 'copied' ? 'Copied' : 'Copy Hashtags'}</span>
                                            </button>
                                          </div>

                                          {/* Keywords Column */}
                                          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                                            <div>
                                              <div className="text-[10px] font-mono text-slate-400 uppercase mb-2">Targeted Keywords</div>
                                              <p className="text-xs text-gold font-mono leading-relaxed break-words">{currentKeywords}</p>
                                            </div>
                                            <button 
                                              onClick={() => {
                                                navigator.clipboard.writeText(currentKeywords);
                                                setSaveStatus(prev => ({ ...prev, [`copy-curr-key-${video.id}`]: 'copied' }));
                                                setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-curr-key-${video.id}`]: '' })), 2000);
                                              }}
                                              className="mt-4 py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono text-slate-300 flex items-center justify-center space-x-1 transition-all"
                                            >
                                              {saveStatus[`copy-curr-key-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                              <span>{saveStatus[`copy-curr-key-${video.id}`] === 'copied' ? 'Copied' : 'Copy Keywords'}</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* B. Expandable Turbo AI Catalyst Spark */}
                                <AnimatePresence>
                                  {isAuditExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="bg-black/50 border border-gold/15 rounded-2xl p-5 space-y-6">
                                        {!auditState.data && !auditState.loading && (
                                          <div className="text-center py-6 space-y-4">
                                            <div className="p-3 bg-gold/5 border border-gold/20 rounded-full w-14 h-14 flex items-center justify-center mx-auto">
                                              <Zap className="text-gold" size={24} />
                                            </div>
                                            <div>
                                              <h5 className="font-display text-sm font-bold text-white uppercase tracking-wider">Unleash Catalyst Audit Engine</h5>
                                              <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                                                Crunches existing meta structures against deep platform trends, viral hook models, and audience responses to build an elite, primed SEO metadata package.
                                              </p>
                                            </div>
                                            <button
                                              onClick={() => runRecentVideoAudit(video)}
                                              className="px-6 py-2.5 bg-gradient-to-r from-gold to-yellow-500 hover:from-gold/90 hover:to-yellow-500/90 text-black font-display text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg hover:shadow-gold/20"
                                            >
                                              Start Mindstorm™ Audit
                                            </button>
                                          </div>
                                        )}

                                        {auditState.loading && (
                                          <div className="text-center py-10 space-y-4">
                                            <Loader2 className="animate-spin text-gold mx-auto" size={32} />
                                            <div>
                                              <div className="font-display text-xs font-bold text-white uppercase tracking-widest animate-pulse">
                                                Spinning with Viral Catalyst
                                              </div>
                                              <p className="text-[10px] text-slate-400 mt-1">
                                                Applying highly advanced computing & logic core program...
                                              </p>
                                            </div>
                                          </div>
                                        )}

                                        {auditState.error && (
                                          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                                            <p className="text-xs text-red-400 font-mono">{auditState.error}</p>
                                            <button
                                              onClick={() => runRecentVideoAudit(video)}
                                              className="mt-3 text-xs text-white hover:underline uppercase font-bold"
                                            >
                                              Retry Audit
                                            </button>
                                          </div>
                                        )}

                                        {auditState.data && (
                                          <div className="space-y-6">
                                            {/* Score Board */}
                                            <div className="p-5 bg-gradient-to-r from-gold/[0.03] to-cyan/[0.03] border border-gold/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                                              <div>
                                                <div className="flex items-center space-x-2">
                                                  <span className="text-xs text-slate-400 font-mono uppercase">Social Performance Audit Score</span>
                                                  <span className="text-[10px] font-mono text-slate-500">(1 is Absolute Best, 10 is Immediate Need)</span>
                                                </div>
                                                <div className="flex items-baseline space-x-3 mt-1.5">
                                                  <div className="text-2xl font-display font-black text-white">
                                                    New Score: <span className="text-gold">{auditState.data.optimizedScore}/10</span>
                                                  </div>
                                                  <div className="text-xs font-bold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20">
                                                    +{auditState.data.scoreChange} improvement
                                                  </div>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                  Original evaluation score was <span className="text-red-400 font-bold">{auditState.data.originalScore}/10</span>. Algorithmic enhancements have boosted the distribution rank.
                                                </p>
                                              </div>
                                              <div className="px-4 py-2 bg-black/40 border border-white/5 rounded-lg flex items-center space-x-2">
                                                <Sparkles size={14} className="text-gold" />
                                                <span className="text-[10px] font-mono text-gold uppercase tracking-wider">VIRAL CATALYST PRIMED</span>
                                              </div>
                                            </div>

                                            {/* Reconstructed columns */}
                                            <div className="space-y-2">
                                              <div className="text-xs font-display font-bold text-gold uppercase tracking-wider">
                                                Reconstructed Primed SEO Metadata Package
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                {/* Title Column */}
                                                <div className="bg-black/30 border border-gold/10 p-4 rounded-xl flex flex-col justify-between">
                                                  <div>
                                                    <div className="text-[10px] font-mono text-gold uppercase mb-2">Optimized Title</div>
                                                    <p className="text-xs text-white leading-relaxed font-bold break-words">
                                                      {auditState.data.optimizedMetadata.title}
                                                    </p>
                                                  </div>
                                                  <button 
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(auditState.data!.optimizedMetadata.title);
                                                      setSaveStatus(prev => ({ ...prev, [`copy-opt-title-${video.id}`]: 'copied' }));
                                                      setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-opt-title-${video.id}`]: '' })), 2000);
                                                    }}
                                                    className="mt-4 py-1.5 px-3 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-lg text-[10px] font-mono text-gold flex items-center justify-center space-x-1 transition-all"
                                                  >
                                                    {saveStatus[`copy-opt-title-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                                    <span>{saveStatus[`copy-opt-title-${video.id}`] === 'copied' ? 'Copied' : 'Copy Title'}</span>
                                                  </button>
                                                </div>

                                                {/* Description Column */}
                                                <div className="bg-black/30 border border-gold/10 p-4 rounded-xl flex flex-col justify-between">
                                                  <div>
                                                    <div className="text-[10px] font-mono text-gold uppercase mb-2">Optimized Description</div>
                                                    <p className="text-xs text-slate-300 leading-relaxed max-h-32 overflow-y-auto break-words font-mono">
                                                      {auditState.data.optimizedMetadata.description}
                                                    </p>
                                                  </div>
                                                  <button 
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(auditState.data!.optimizedMetadata.description);
                                                      setSaveStatus(prev => ({ ...prev, [`copy-opt-desc-${video.id}`]: 'copied' }));
                                                      setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-opt-desc-${video.id}`]: '' })), 2000);
                                                    }}
                                                    className="mt-4 py-1.5 px-3 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-lg text-[10px] font-mono text-gold flex items-center justify-center space-x-1 transition-all"
                                                  >
                                                    {saveStatus[`copy-opt-desc-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                                    <span>{saveStatus[`copy-opt-desc-${video.id}`] === 'copied' ? 'Copied' : 'Copy Description'}</span>
                                                  </button>
                                                </div>

                                                {/* Hashtags Column */}
                                                <div className="bg-black/30 border border-gold/10 p-4 rounded-xl flex flex-col justify-between">
                                                  <div>
                                                    <div className="text-[10px] font-mono text-gold uppercase mb-2">Optimized Hashtags</div>
                                                    <p className="text-xs text-cyan font-mono leading-relaxed break-words">
                                                      {auditState.data.optimizedMetadata.hashtags}
                                                    </p>
                                                  </div>
                                                  <button 
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(auditState.data!.optimizedMetadata.hashtags);
                                                      setSaveStatus(prev => ({ ...prev, [`copy-opt-hash-${video.id}`]: 'copied' }));
                                                      setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-opt-hash-${video.id}`]: '' })), 2000);
                                                    }}
                                                    className="mt-4 py-1.5 px-3 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-lg text-[10px] font-mono text-gold flex items-center justify-center space-x-1 transition-all"
                                                  >
                                                    {saveStatus[`copy-opt-hash-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                                    <span>{saveStatus[`copy-opt-hash-${video.id}`] === 'copied' ? 'Copied' : 'Copy Hashtags'}</span>
                                                  </button>
                                                </div>

                                                {/* Keywords Column */}
                                                <div className="bg-black/30 border border-gold/10 p-4 rounded-xl flex flex-col justify-between">
                                                  <div>
                                                    <div className="text-[10px] font-mono text-gold uppercase mb-2">Optimized Keywords</div>
                                                    <p className="text-xs text-gold font-mono leading-relaxed break-words font-semibold">
                                                      {auditState.data.optimizedMetadata.keywords}
                                                    </p>
                                                  </div>
                                                  <button 
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(auditState.data!.optimizedMetadata.keywords);
                                                      setSaveStatus(prev => ({ ...prev, [`copy-opt-key-${video.id}`]: 'copied' }));
                                                      setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-opt-key-${video.id}`]: '' })), 2000);
                                                    }}
                                                    className="mt-4 py-1.5 px-3 bg-gold/10 hover:bg-gold/20 border border-gold/20 rounded-lg text-[10px] font-mono text-gold flex items-center justify-center space-x-1 transition-all"
                                                  >
                                                    {saveStatus[`copy-opt-key-${video.id}`] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                                    <span>{saveStatus[`copy-opt-key-${video.id}`] === 'copied' ? 'Copied' : 'Copy Keywords'}</span>
                                                  </button>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Expandable Explanation & Persistence */}
                                            <div className="space-y-3 pt-2">
                                              <button
                                                onClick={() => setExpandedExplanationVideoId(isExplanationExpanded ? null : video.id)}
                                                className="w-full text-left py-2 px-4 bg-white/[0.03] border border-white/5 rounded-xl text-xs font-display font-medium text-slate-300 flex items-center justify-between hover:bg-white/[0.05] transition-colors"
                                              >
                                                <span>📋 Why these algorithmic changes? (Forecasted Niche Analysis)</span>
                                                <ChevronRight size={14} className={`transform transition-transform ${isExplanationExpanded ? 'rotate-90' : ''}`} />
                                              </button>

                                              {isExplanationExpanded && (
                                                <motion.div
                                                  initial={{ opacity: 0, height: 0 }}
                                                  animate={{ opacity: 1, height: 'auto' }}
                                                  exit={{ opacity: 0, height: 0 }}
                                                  className="overflow-hidden bg-black/30 border border-white/5 p-5 rounded-xl space-y-4"
                                                >
                                                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                                                    {auditState.data.explanation}
                                                  </p>
                                                  
                                                  <div className="flex flex-wrap gap-3 pt-2">
                                                    <button
                                                      onClick={() => saveAuditExplanationToKnowledgeDNA(video.id, auditState.data!.explanation)}
                                                      disabled={saveStatus[`dna-${video.id}`] === 'saving'}
                                                      className="flex items-center space-x-1 px-4 py-2 bg-cyan/15 hover:bg-cyan/25 border border-cyan/30 rounded-lg text-[10px] font-mono text-cyan uppercase tracking-wider transition-all disabled:opacity-50"
                                                    >
                                                      <Database size={12} />
                                                      <span>
                                                        {saveStatus[`dna-${video.id}`] === 'saving' ? 'Syncing...' : 
                                                         saveStatus[`dna-${video.id}`] === 'saved' ? 'DNA Profile Updated' : 
                                                         'Save Strategy to Knowledge DNA'}
                                                      </span>
                                                    </button>

                                                    <button
                                                      onClick={() => saveAuditToSeoVault(
                                                        video.id,
                                                        auditState.data!.optimizedMetadata.title,
                                                        auditState.data!.optimizedMetadata.description,
                                                        auditState.data!.optimizedMetadata.hashtags,
                                                        auditState.data!.optimizedMetadata.keywords
                                                      )}
                                                      disabled={saveStatus[`vault-${video.id}`] === 'saving'}
                                                      className="flex items-center space-x-1 px-4 py-2 bg-gold/15 hover:bg-gold/25 border border-gold/30 rounded-lg text-[10px] font-mono text-gold uppercase tracking-wider transition-all disabled:opacity-50"
                                                    >
                                                      <History size={12} />
                                                      <span>
                                                        {saveStatus[`vault-${video.id}`] === 'saving' ? 'Storing...' : 
                                                         saveStatus[`vault-${video.id}`] === 'saved' ? 'Saved to SEO Vault' : 
                                                         'Save Package to SEO Vault'}
                                                      </span>
                                                    </button>
                                                  </div>
                                                </motion.div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Videos list */}
                    <div className="space-y-4">
                      <h3 className="font-display text-sm tracking-widest text-slate-400 uppercase">Repurpose Uploaded Content</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {videos.map((video) => (
                          <div 
                            key={video.id}
                            className="glass rounded-2xl p-4 flex space-x-4 border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden"
                          >
                            <img src={video.thumbnail} alt={video.title} className="w-28 h-20 object-cover rounded-lg border border-white/10" />
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <h4 className="text-xs font-bold text-white truncate group-hover:text-gold transition-colors">{video.title}</h4>
                                <p className="text-[10px] text-slate-500 line-clamp-2 mt-1">{video.description || "No description provided."}</p>
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2">
                                <span>{video.viewCount.toLocaleString()} Views</span>
                                <button 
                                  onClick={() => selectVideoForRepurpose(video)}
                                  className="text-gold hover:text-white flex items-center space-x-1"
                                >
                                  <span>Repurpose</span>
                                  <ChevronRight size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-3xl p-12 text-center max-w-xl mx-auto space-y-6">
                    <Youtube size={64} className="text-red-500 mx-auto animate-pulse" />
                    <h3 className="text-lg font-display font-black text-white">SYNC YOUTUBE ACCOUNT</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Syncing your active Creator profile enables immediate analysis of your uploads, automatic visual previews, and unlocks real-time metric-based grounding.
                    </p>
                    
                    {/* Troubleshooting Setup Details / Fix Alert */}
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-left space-y-3 max-w-md mx-auto">
                      <div className="text-[11px] font-mono text-gold uppercase tracking-wider font-bold">🚨 Setup Instructions & Fix Alert:</div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        If you experience errors connecting, please perform the following checks:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-[10px] text-slate-400 font-sans">
                        <li>Ensure <span className="text-white font-semibold">YouTube Data API v3</span> is enabled in your Google Cloud Project.</li>
                        <li>When the Google Sign-in popup appears, <span className="text-gold font-semibold">you MUST check the box</span> to grant "View your YouTube account" permissions.</li>
                        <li>The Google Account you use must have an <span className="text-white font-semibold">active, created YouTube Channel</span>.</li>
                      </ul>
                    </div>

                    <button 
                      onClick={handleGoogleSignIn}
                      className="bg-red-600 hover:bg-red-500 text-white font-display font-bold px-8 py-3.5 rounded-xl uppercase tracking-wider text-xs mx-auto shadow-lg hover:shadow-red-600/30 transition-all flex items-center space-x-2"
                    >
                      <Youtube size={16} fill="currentColor" />
                      <span>Authenticate Creator Access</span>
                    </button>
                  </div>
                )}
                  </>
                )}

                {/* SUB TAB 2: Trend Dashboard */}
                {analyticsSubTab === 'trends' && (
                  <div className="space-y-6">
                    <div className="glass rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan to-transparent opacity-50" />
                      
                      <div className="max-w-2xl">
                        <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">AI Trend Intelligence Forecast</h3>
                        <p className="text-xs text-slate-400 mt-1">Search any creator keyword, niche, or topic to forecast current velocity, key psychological momentum, and viral title models.</p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                          <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
                          <input 
                            type="text"
                            value={trendQuery}
                            onChange={(e) => setTrendQuery(e.target.value)}
                            placeholder="e.g. lofi hip hop, ASMR baking, tech reviews..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:border-cyan/50 outline-none transition-all text-white"
                          />
                        </div>
                        <button
                          onClick={handleFetchTrends}
                          disabled={trendLoading || !trendQuery}
                          className="px-6 py-3.5 bg-cyan hover:bg-cyan/90 text-black font-display font-black rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                        >
                          {trendLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                          <span>{trendLoading ? 'Crunching Velocity...' : 'Analyze Niche'}</span>
                        </button>
                      </div>
                    </div>

                    {trendLoading && (
                      <div className="glass rounded-3xl p-16 text-center space-y-4">
                        <Loader2 className="animate-spin text-cyan mx-auto" size={36} />
                        <p className="text-xs font-mono text-cyan uppercase tracking-widest animate-pulse">Scanning Social Graph Networks...</p>
                        <p className="text-[10px] text-slate-500">Retrieving real-time topic volume indices, psychological trigger points, and viral hook formulas...</p>
                      </div>
                    )}

                    {!trendLoading && trendData && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Column 1 & 2: Main Velocity & Suggested Topics */}
                        <div className="lg:col-span-2 space-y-6">
                          {/* Hot topics with momentum */}
                          <div className="glass rounded-3xl p-6 space-y-4">
                            <h4 className="text-xs font-mono text-cyan uppercase tracking-widest">Trending Niche Segments</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {trendData.hotTopics.map((topicItem, index) => (
                                <div key={index} className="bg-black/30 border border-white/5 p-4 rounded-2xl space-y-3 hover:border-cyan/30 transition-all">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white truncate max-w-[150px]">{topicItem.topic}</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                                      topicItem.momentum === 'up' 
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                        : topicItem.momentum === 'stable' 
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                      {topicItem.momentum === 'up' ? '↗ High' : topicItem.momentum === 'stable' ? '→ Stable' : '↘ Cooling'}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline justify-between">
                                    <span className="text-[10px] text-slate-500 font-mono">Forecast Volume</span>
                                    <span className="text-xs font-mono text-slate-300">{topicItem.searchVolume}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-relaxed border-t border-white/5 pt-2 font-sans">
                                    {topicItem.explanation}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Hook structures & engagement triggers */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="glass rounded-3xl p-6 space-y-4">
                              <h4 className="text-xs font-mono text-cyan uppercase tracking-widest">Psychological Triggers</h4>
                              <div className="space-y-3">
                                {trendData.engagementTriggers.map((trigger, idx) => (
                                  <div key={idx} className="flex items-start space-x-2.5 text-xs bg-black/40 p-3 rounded-xl border border-white/5">
                                    <div className="p-1 bg-cyan/15 rounded-md text-cyan mt-0.5">
                                      <TrendingUp size={12} />
                                    </div>
                                    <p className="text-slate-300 leading-relaxed">{trigger}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="glass rounded-3xl p-6 space-y-4">
                              <h4 className="text-xs font-mono text-cyan uppercase tracking-widest">Viral Hook Templates</h4>
                              <div className="space-y-3">
                                {trendData.viralHooks.map((hook, idx) => (
                                  <div 
                                    key={idx} 
                                    onClick={() => {
                                      navigator.clipboard.writeText(hook);
                                      setSaveStatus(prev => ({ ...prev, [`copy-hook-${idx}`]: 'copied' }));
                                      setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-hook-${idx}`]: '' })), 2000);
                                    }}
                                    className="p-3 bg-black/40 hover:bg-black/60 rounded-xl border border-white/5 cursor-pointer flex items-center justify-between text-xs italic text-slate-300 transition-colors group"
                                  >
                                    <span className="truncate pr-4 group-hover:text-cyan transition-colors">"{hook}"</span>
                                    <button className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                                      {saveStatus[`copy-hook-${idx}`] === 'copied' ? 'Copied' : 'Copy'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Column 3: Recommended Niche Titles */}
                        <div className="space-y-6">
                          <div className="glass rounded-3xl p-6 space-y-4 relative overflow-hidden">
                            <div className="text-xs font-mono text-cyan uppercase tracking-widest">AI Generated Hot Titles</div>
                            <p className="text-[11px] text-slate-400">These titles are modeled after premium organic reach algorithms. Click any title to copy and load it into the Engagement Simulator.</p>
                            
                            <div className="space-y-3">
                              {trendData.suggestedNicheTitles.map((title, idx) => (
                                <div 
                                  key={idx}
                                  onClick={() => {
                                    setCandidateTitle(title);
                                    setAnalyticsSubTab('engagement');
                                    setPrediction(null);
                                    navigator.clipboard.writeText(title);
                                  }}
                                  className="p-3 bg-black/30 hover:bg-cyan/10 border border-white/5 hover:border-cyan/30 rounded-xl text-xs font-bold text-white cursor-pointer transition-all flex items-center justify-between group"
                                >
                                  <span className="truncate pr-2 group-hover:text-cyan transition-colors">{title}</span>
                                  <ArrowRight size={14} className="text-slate-500 group-hover:text-cyan transform group-hover:translate-x-1 transition-all" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SUB TAB 3: Video Engagement Simulator */}
                {analyticsSubTab === 'engagement' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left: Simulation Control Form */}
                      <div className="lg:col-span-1 space-y-6">
                        <div className="glass rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-mag to-transparent opacity-50" />
                          
                          <div>
                            <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">Algorithmic Simulator</h3>
                            <p className="text-xs text-slate-400 mt-1">Simulate click propensity and watch-time retention scores BEFORE publishing.</p>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="block text-[10px] font-mono text-slate-400 uppercase">Draft Video Title</label>
                              <input 
                                type="text"
                                value={candidateTitle}
                                onChange={(e) => setCandidateTitle(e.target.value)}
                                placeholder="Paste your draft title here..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-mag/50 outline-none transition-all text-white font-bold"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="block text-[10px] font-mono text-slate-400 uppercase">Thumbnail Concept / Visuals</label>
                              <textarea 
                                value={thumbnailConcept}
                                onChange={(e) => setThumbnailConcept(e.target.value)}
                                rows={4}
                                placeholder="Describe the imagery, text overlay, background color, and emotion in the thumbnail..."
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-mag/50 outline-none transition-all text-slate-300 resize-none font-mono"
                              />
                            </div>

                            <button
                              onClick={handlePredictEngagement}
                              disabled={predicting || !candidateTitle}
                              className="w-full mt-2 py-3.5 bg-gradient-to-r from-mag to-pink-600 hover:from-mag hover:to-mag text-white font-display font-black rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                            >
                              {predicting ? (
                                <>
                                  <Loader2 className="animate-spin" size={16} />
                                  <span>Simulating Metrics...</span>
                                </>
                              ) : (
                                <>
                                  <Zap size={16} fill="currentColor" />
                                  <span>Run Simulator</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Simulation Output */}
                      <div className="lg:col-span-2">
                        {predicting && (
                          <div className="glass rounded-3xl p-16 text-center space-y-4 h-full flex flex-col justify-center items-center">
                            <Loader2 className="animate-spin text-mag" size={40} />
                            <p className="text-xs font-mono text-mag uppercase tracking-widest animate-pulse">Analyzing Title Word Weights...</p>
                            <p className="text-[10px] text-slate-500 max-w-sm">Comparing descriptive imagery descriptors, emotional density, cognitive dissonance level, and thumbnail alignments...</p>
                          </div>
                        )}

                        {!predicting && !prediction && (
                          <div className="glass rounded-3xl p-16 text-center space-y-6 h-full flex flex-col justify-center items-center">
                            <div className="p-4 bg-mag/5 border border-mag/20 rounded-full text-mag">
                              <BarChart2 size={32} />
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider">Simulator Dashboard Ready</h4>
                              <p className="text-xs text-slate-400 max-w-md mx-auto">
                                Feed your draft title and a brief description of your planned thumbnail into the controller on the left, and let Gemini audit its performance vectors!
                              </p>
                            </div>
                          </div>
                        )}

                        {!predicting && prediction && (
                          <div className="space-y-6">
                            {/* Score Gages */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* CTR Card */}
                              <div className="glass rounded-3xl p-6 relative overflow-hidden text-center space-y-2">
                                <div className="text-[10px] font-mono text-slate-400 uppercase">Estimated CTR Index</div>
                                <div className="text-4xl font-display font-black text-white">
                                  {prediction.ctrScore}%
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mt-2">
                                  <div 
                                    className={`h-full rounded-full ${
                                      prediction.ctrScore >= 80 ? 'bg-green-400' : prediction.ctrScore >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${prediction.ctrScore}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-slate-500">How likely users are to click based on curiosity weight.</p>
                              </div>

                              {/* Retention Card */}
                              <div className="glass rounded-3xl p-6 relative overflow-hidden text-center space-y-2">
                                <div className="text-[10px] font-mono text-slate-400 uppercase">Retention Alignment</div>
                                <div className="text-4xl font-display font-black text-white">
                                  {prediction.retentionScore}%
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mt-2">
                                  <div 
                                    className={`h-full rounded-full ${
                                      prediction.retentionScore >= 80 ? 'bg-green-400' : prediction.retentionScore >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${prediction.retentionScore}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-slate-500">Calculates title-thumbnail consistency rating.</p>
                              </div>

                              {/* Virality Card */}
                              <div className="glass rounded-3xl p-6 relative overflow-hidden text-center space-y-2">
                                <div className="text-[10px] font-mono text-slate-400 uppercase">Virality Index</div>
                                <div className="text-4xl font-display font-black text-white">
                                  {prediction.viralityIndex}%
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mt-2">
                                  <div 
                                    className={`h-full rounded-full ${
                                      prediction.viralityIndex >= 80 ? 'bg-green-400' : prediction.viralityIndex >= 50 ? 'bg-amber-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${prediction.viralityIndex}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-slate-500">Calculates visual/textual shares propensity.</p>
                              </div>
                            </div>

                            {/* Algorithmic Review Critique */}
                            <div className="glass rounded-3xl p-6 space-y-4">
                              <h4 className="text-xs font-mono text-mag uppercase tracking-widest">Algorithmic Mindstorm™ Audit</h4>
                              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                                {prediction.critique}
                              </p>
                            </div>

                            {/* Optimized Title recommendations & alternative copy buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="glass rounded-3xl p-6 space-y-4">
                                <h4 className="text-xs font-mono text-mag uppercase tracking-widest">Optimized Alternative Title</h4>
                                <div className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-4">
                                  <p className="text-xs font-bold text-white">{prediction.optimizedTitle}</p>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(prediction.optimizedTitle);
                                        setSaveStatus(prev => ({ ...prev, 'copy-opt-pred': 'copied' }));
                                        setTimeout(() => setSaveStatus(prev => ({ ...prev, 'copy-opt-pred': '' })), 2000);
                                      }}
                                      className="py-1.5 px-3 bg-mag/10 hover:bg-mag/20 border border-mag/20 rounded-lg text-[10px] font-mono text-mag flex items-center justify-center space-x-1 transition-all"
                                    >
                                      {saveStatus['copy-opt-pred'] === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                                      <span>{saveStatus['copy-opt-pred'] === 'copied' ? 'Copied' : 'Copy'}</span>
                                    </button>

                                    <button 
                                      onClick={() => {
                                        setUrl('');
                                        setContext(`Original Optimized Title: ${prediction.optimizedTitle}\nGrounding Style: High engagement viral distribution.`);
                                        setActiveTab('engine');
                                      }}
                                      className="py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-mono text-slate-300 flex items-center justify-center space-x-1 transition-all"
                                    >
                                      <Zap size={12} />
                                      <span>Load into AI Engine</span>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="glass rounded-3xl p-6 space-y-4">
                                <h4 className="text-xs font-mono text-mag uppercase tracking-widest">Retention Hook Models</h4>
                                <div className="space-y-2">
                                  {prediction.recommendedHooks.map((hook, index) => (
                                    <div 
                                      key={index}
                                      onClick={() => {
                                        navigator.clipboard.writeText(hook);
                                        setSaveStatus(prev => ({ ...prev, [`copy-hook-pred-${index}`]: 'copied' }));
                                        setTimeout(() => setSaveStatus(prev => ({ ...prev, [`copy-hook-pred-${index}`]: '' })), 2000);
                                      }}
                                      className="p-2.5 bg-black/40 hover:bg-black/60 rounded-xl border border-white/5 text-[11px] italic text-slate-300 transition-all flex items-center justify-between cursor-pointer group"
                                    >
                                      <span className="truncate pr-2 font-mono group-hover:text-mag">"{hook}"</span>
                                      <span className="text-[9px] font-mono text-slate-500">
                                        {saveStatus[`copy-hook-pred-${index}`] === 'copied' ? 'Copied' : 'Copy'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* brand DNA tab */}
            {activeTab === 'brand' && (
              <motion.div 
                key="brand"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">Creator DNA Knowledge Graph</h2>
                  <p className="text-xs text-slate-400">An active, grounded intelligence map constructed from your previous content performance trends.</p>
                </div>

                {knowledgeGraph ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* DNA Profile Cards */}
                    <div className="space-y-6">
                      <div className="glass rounded-3xl p-6 border-mag/20">
                        <div className="text-[10px] font-mono text-mag uppercase tracking-widest mb-1">Identified Creator Niche</div>
                        <h3 className="text-lg font-bold text-white">{knowledgeGraph.niche}</h3>
                      </div>

                      <div className="glass rounded-3xl p-6 border-cyan/20">
                        <div className="text-[10px] font-mono text-cyan uppercase tracking-widest mb-1">Tone & Communication Style</div>
                        <h3 className="text-lg font-bold text-white">{knowledgeGraph.toneOfVoice}</h3>
                      </div>

                      <div className="glass rounded-3xl p-6">
                        <div className="text-[10px] font-mono text-gold uppercase tracking-widest mb-3">Key Target Demographics</div>
                        <div className="flex flex-wrap gap-2">
                          {knowledgeGraph.keyAudiences.map((aud, idx) => (
                            <span key={idx} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                              {aud}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="glass rounded-3xl p-6">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3">Core Content Themes</div>
                        <div className="space-y-2">
                          {knowledgeGraph.mainThemes.map((theme, idx) => (
                            <div key={idx} className="flex items-center space-x-3 text-xs bg-black/40 p-3 rounded-xl border border-white/5">
                              <div className="w-1.5 h-1.5 bg-mag rounded-full" />
                              <span>{theme}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="glass rounded-3xl p-6">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3">AI Recommendations & Hooks</div>
                        <div className="space-y-2">
                          {knowledgeGraph.suggestedHooks.slice(0, 3).map((hook, idx) => (
                            <div key={idx} className="text-xs bg-black/40 p-3 rounded-xl border border-white/5 italic text-slate-300">
                              "{hook}"
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-3xl p-12 text-center max-w-xl mx-auto space-y-6">
                    <Network size={64} className="text-mag mx-auto animate-pulse" />
                    <h3 className="text-lg font-display font-black text-white">CONSTRUCT BRAND KNOWLEDGE GRAPH</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Let Gemini analyze your channel uploads to build a Content DNA profile. This automates personal grounding, making all generated metadata highly personalized.
                    </p>
                    <button 
                      onClick={handleBuildKnowledgeGraph}
                      disabled={kgLoading || videos.length === 0}
                      className="bg-mag hover:bg-mag/80 text-white font-display font-bold px-8 py-3.5 rounded-xl uppercase tracking-wider text-xs mx-auto shadow-lg hover:shadow-mag/30 transition-all flex items-center space-x-2 disabled:opacity-40"
                    >
                      {kgLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Mapping Brand DNA...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Initialize Knowledge Graph</span>
                        </>
                      )}
                    </button>
                    {videos.length === 0 && (
                      <p className="text-[10px] text-amber-400 font-mono">
                        * Please link your YouTube account under "Real-time Insights" first.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* vault tab */}
            {activeTab === 'vault' && (
              <motion.div 
                key="vault"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">SEO Distribution Vault</h2>
                  <p className="text-xs text-slate-400">Your secure, cloud-saved distribution campaigns history.</p>
                </div>

                {vaultLoading ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-gold" size={32} />
                  </div>
                ) : vault.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {vault.map((item) => (
                      <div 
                        key={item.id}
                        className="glass rounded-3xl p-6 border border-white/5 space-y-4 hover:border-gold/20 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span>Saved Campaign</span>
                            <span>{new Date(item.timestamp?.seconds * 1000 || item.timestamp).toLocaleDateString()}</span>
                          </div>
                          <h3 className="text-sm font-bold text-white mt-2 line-clamp-1">{item.seo.youtube.title}</h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.context}</p>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs">
                          <span className="text-[10px] font-mono text-slate-500 overflow-hidden text-ellipsis max-w-[200px] whitespace-nowrap">{item.url}</span>
                          <button 
                            onClick={() => {
                              setResult(item.seo);
                              setUrl(item.url);
                              setContext(item.context);
                              setActiveTab('engine');
                            }}
                            className="text-gold hover:text-white flex items-center space-x-1 font-bold text-xs uppercase"
                          >
                            <span>Load</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
                    <Database size={64} className="text-amber-400/40 mx-auto" />
                    <h3 className="text-lg font-display font-black text-white">VAULT IS EMPTY</h3>
                    <p className="text-xs text-slate-400">
                      When you generate SEO packages while signed in, they are securely preserved in the cloud database for instant retrieval.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function PlatformCard({ icon, name, title, content, hashtags, onCopy, isCopied, url, featured = false }: any) {
  const shareText = `${title}\n\n${hashtags}\n\n${url}`;
  
  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    instagram: `https://www.instagram.com/`,
    tiktok: `https://www.tiktok.com/upload`,
    youtube: `https://studio.youtube.com/`
  };

  return (
    <motion.div 
      className={`glass rounded-3xl p-6 relative overflow-hidden group ${featured ? 'border-gold/30' : ''}`}
      whileHover={{ y: -5 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white/5 rounded-xl">
            {icon}
          </div>
          <h3 className="font-display text-[10px] tracking-widest uppercase text-slate-400">{name}</h3>
        </div>
        <button 
          onClick={onCopy}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gold flex items-center space-x-2"
        >
          {isCopied ? <Check size={18} /> : <Copy size={18} />}
          <span className="text-[10px] font-display uppercase tracking-widest">Copy</span>
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] font-display text-slate-500 uppercase tracking-tighter">SEO Optimized Title</span>
          <h4 className="text-lg font-bold text-white leading-tight">{title}</h4>
        </div>
        
        <div className="space-y-1">
          <span className="text-[10px] font-display text-slate-500 uppercase tracking-tighter">Algorithm Primed Content</span>
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 max-h-40 overflow-y-auto text-sm text-slate-300 leading-relaxed scrollbar-hide">
            {content}
          </div>
        </div>

        <div className="pt-2">
          <div className="flex flex-wrap gap-2">
            {hashtags.split(' ').map((tag: string, i: number) => (
              <span key={i} className="text-[10px] font-mono text-cyan/80 bg-cyan/5 px-2 py-1 rounded-md border border-cyan/10">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Share Section */}
        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-display text-slate-500 uppercase tracking-widest">Direct Share</span>
            <div className="flex items-center space-x-3">
              <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors" title="Share to Facebook">
                <Facebook size={18} />
              </a>
              <a href={shareLinks.x} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors" title="Share to X">
                <Twitter size={18} />
              </a>
              <a href={shareLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-mag transition-colors" title="Open Instagram">
                <Instagram size={18} />
              </a>
              <a href={shareLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-cyan transition-colors" title="Open TikTok">
                <Music2 size={18} />
              </a>
              <a href={shareLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-red-500 transition-colors" title="Open YouTube Studio">
                <Youtube size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
