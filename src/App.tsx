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
  ExternalLink,
  TrendingUp,
  Share2,
  Sparkles
} from 'lucide-react';
import { generateViralSEO } from './lib/gemini';

interface SEOPackage {
  youtube: { title: string; description: string; hashtags: string };
  shorts: { title: string; caption: string; hashtags: string };
  tiktok: { hook: string; caption: string; hashtags: string };
  instagram: { caption: string; hashtags: string };
  facebook: { title: string; description: string; hashtags: string };
  x: { post: string; hashtags: string };
  keywordBank: string;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SEOPackage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    if (!url || !context) return;
    setLoading(true);
    try {
      const data = await generateViralSEO(url, context);
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Failed to generate SEO package. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="relative py-12 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10"
        >
          <div className="text-[10px] font-display tracking-[0.3em] text-gold/60 mb-2 uppercase">Exclusive Production Suite</div>
          <h1 className="text-4xl md:text-6xl font-display font-black text-gold gold-glow tracking-tighter mb-4">
            VIRAL CATALYST V4.0
          </h1>
          <p className="text-cyan cyan-glow font-display text-xs md:text-sm tracking-[0.2em] font-bold uppercase">
            Turbo-Charged Social Discovery Engine
          </p>
        </motion.div>
      </header>

      <main className="max-w-5xl mx-auto px-4 space-y-8">
        {/* Input Section */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
        >
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
                <label className="block font-display text-[10px] text-slate-400 tracking-widest uppercase">Artist, Song & Context</label>
                <textarea 
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={4}
                  placeholder="e.g. @IconicBeatsLA - Sunset Drive. Smooth lo-fi trap, luxury vibing in Hollywood..."
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
                    <span className="text-[10px] font-display tracking-widest uppercase">Preview Ready</span>
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
        </motion.section>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
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
              <motion.div 
                className="glass rounded-3xl p-8 border-cyan/20 relative overflow-hidden"
                whileHover={{ scale: 1.01 }}
              >
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-20 text-center py-8 border-t border-white/5">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Zap size={14} className="text-gold" />
          <span className="text-[10px] font-display tracking-[0.4em] text-slate-500 uppercase">Powered by Iconic Beats AI</span>
        </div>
      </footer>
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
