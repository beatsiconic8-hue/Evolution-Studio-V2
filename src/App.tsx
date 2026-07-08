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
  Play
} from 'lucide-react';
import { generateViralSEO, generateKnowledgeGraph, KnowledgeGraph } from './lib/gemini';
import { auth, db, googleProvider } from './lib/firebase';
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
      // 1. Fetch Knowledge Graph
      const kgDoc = await getDoc(doc(db, "knowledge_graphs", uid));
      if (kgDoc.exists()) {
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
      const snap = await getDocs(q);
      const items: VaultItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as VaultItem);
      });
      setVault(items);
      setVaultLoading(false);
    } catch (e) {
      console.error("Error fetching persisted user data:", e);
      setVaultLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        setAccessToken(token);
        // Sync channel stats and videos
        await syncYouTubeAccount(token, result.user.uid);
      }
    } catch (error) {
      console.error("Sign-in error:", error);
      alert("Google Sign-In failed or was cancelled.");
    } finally {
      setAuthLoading(false);
    }
  };

  const syncYouTubeAccount = async (token: string, uid: string) => {
    setYoutubeLoading(true);
    try {
      const channelData = await fetchYouTubeChannel(token);
      setChannel(channelData);

      // Save user profile info to Firestore
      await setDoc(doc(db, "users", uid), {
        uid,
        channelId: channelData.id,
        channelTitle: channelData.title,
        avatar: channelData.avatar,
        lastSynced: new Date().toISOString()
      }, { merge: true });

      if (channelData.uploadsPlaylistId) {
        const videoList = await fetchYouTubeVideos(token, channelData.uploadsPlaylistId);
        setVideos(videoList);
      }
    } catch (e) {
      console.error("YouTube sync error:", e);
      alert("Failed to sync YouTube channel statistics. Continuing as a general account.");
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
      await setDoc(doc(db, "knowledge_graphs", user.uid), graph);
    } catch (e) {
      console.error(e);
      alert("Failed to compile user content DNA profile.");
    } finally {
      setKgLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!url || !context) return;
    setLoading(true);
    try {
      const data = await generateViralSEO(url, context, knowledgeGraph);
      setResult(data);

      // Persist in history if user is authenticated
      if (user) {
        const docRef = await addDoc(collection(db, "history"), {
          uid: user.uid,
          url,
          context,
          seo: data,
          timestamp: new Date()
        });

        // Add to active Vault state
        setVault(prev => [{
          id: docRef.id,
          url,
          context,
          seo: data,
          timestamp: new Date()
        }, ...prev]);
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
                <div>
                  <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">Real-Time Channel Insights</h2>
                  <p className="text-xs text-slate-400">Deep, accurate metric evaluation direct from your linked YouTube Creator profile.</p>
                </div>

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
                    <button 
                      onClick={handleGoogleSignIn}
                      className="bg-red-600 hover:bg-red-500 text-white font-display font-bold px-8 py-3.5 rounded-xl uppercase tracking-wider text-xs mx-auto shadow-lg hover:shadow-red-600/30 transition-all flex items-center space-x-2"
                    >
                      <Youtube size={16} fill="currentColor" />
                      <span>Authenticate Creator Access</span>
                    </button>
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
