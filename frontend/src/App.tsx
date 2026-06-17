import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { 
  Camera as CameraIcon, 
  UserPlus, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Trash2,
  Sun,
  Moon,
  Info,
  Settings,
  X,
  Lock,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

// Use local backend if running on localhost, otherwise use production Railway URL
// Force Vercel Redeploy - Build Timestamp: 2026-06-16 15:30
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000' 
  : 'https://facial-rec-fm.up.railway.app';

const App = () => {
  const [mode, setMode] = useState<'recognize' | 'register' | 'admin'>('recognize');
  const [adminTab, setAdminTab] = useState<'profiles' | 'history'>('profiles');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [name, setName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [qualityTip, setQualityTip] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axios.get(`${API_BASE_URL}/profiles`, {
        headers: { 'X-Admin-Password': passwordInput }
      });
      setAdminPassword(passwordInput);
      setIsAdminAuthenticated(true);
      fetchProfiles(passwordInput);
      fetchLogs(passwordInput);
    } catch (err: any) {
      setError(err.response?.status === 401 ? 'Invalid Admin Password' : 'Admin authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async (pass: string = adminPassword) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/profiles`, {
        headers: { 'X-Admin-Password': pass }
      });
      setProfiles(response.data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (pass: string = adminPassword) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/logs`, {
        headers: { 'X-Admin-Password': pass }
      });
      setLogs(response.data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const deleteProfile = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Profile',
      message: 'Are you sure you want to delete this profile? This action cannot be undone.',
      isDangerous: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          await axios.delete(`${API_BASE_URL}/profiles/${id}`, {
            headers: { 'X-Admin-Password': adminPassword }
          });
          setProfiles(profiles.filter(p => p.id !== id));
        } catch (err) {
          setError('Failed to delete profile');
        } finally {
          setLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const clearProfiles = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear All Profiles',
      message: 'DANGEROUS: This will permanently delete ALL registered profiles and face data. Are you absolutely sure?',
      isDangerous: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          await axios.delete(`${API_BASE_URL}/profiles`, {
            headers: { 'X-Admin-Password': adminPassword }
          });
          setProfiles([]);
        } catch (err) {
          setError('Failed to clear profiles');
        } finally {
          setLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const clearLogs = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Logs',
      message: 'Are you sure you want to clear the match history?',
      isDangerous: false,
      onConfirm: async () => {
        setLoading(true);
        try {
          await axios.delete(`${API_BASE_URL}/logs`, {
            headers: { 'X-Admin-Password': adminPassword }
          });
          setLogs([]);
        } catch (err) {
          setError('Failed to clear logs');
        } finally {
          setLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const checkImageQuality = (canvas: HTMLCanvasElement): string | null => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let brightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      brightness += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    const avgBrightness = brightness / (canvas.width * canvas.height);
    if (avgBrightness < 40) return "Image too dark. Improve lighting.";
    if (avgBrightness > 220) return "Image too bright. Avoid direct light.";
    return null;
  };

  const capture = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setQualityTip(null);

    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    const tip = checkImageQuality(canvas);
    if (tip) setQualityTip(tip);

    const maskWidth = img.width * 0.4;
    const maskHeight = img.height * 0.8;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.ellipse(img.width / 2, img.height / 2, maskWidth / 2, maskHeight / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg'));
    if (!blob) return;

    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append('file', file);

    try {
      if (mode === 'register') {
        if (!name || !matricNumber) {
          setError('Please enter both name and matric number');
          setLoading(false);
          return;
        }
        formData.append('name', name);
        formData.append('matric_number', matricNumber);
        const response = await axios.post(`${API_BASE_URL}/register`, formData);
        setResult({ success: true, message: `Registered ${response.data.name} (${response.data.matric_number}) successfully!` });
        setName('');
        setMatricNumber('');
      } else {
        const response = await axios.post(`${API_BASE_URL}/recognize`, formData);
        setResult(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred during processing');
    } finally {
      setLoading(false);
    }
  }, [mode, name, matricNumber, webcamRef]);

  const toggleAdmin = () => {
    if (mode === 'admin') setMode('recognize');
    else { setMode('admin'); setError(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">FaceAuth</h1>
              <p className="text-slate-500 dark:text-slate-400">Secure Facial Recognition System</p>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <button onClick={toggleAdmin} className={`p-2 rounded-lg border transition-colors ${mode === 'admin' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <Settings size={20} />
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <nav className="flex flex-1 md:flex-none bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-1">
              <button onClick={() => setMode('recognize')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-md transition-all text-sm font-medium ${mode === 'recognize' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <Search size={16} /> Identify
              </button>
              <button onClick={() => setMode('register')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-md transition-all text-sm font-medium ${mode === 'register' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <UserPlus size={16} /> Register
              </button>
            </nav>
            
            <div className="hidden md:flex items-center gap-2">
              <button onClick={toggleAdmin} className={`p-2.5 rounded-lg border transition-all ${mode === 'admin' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title="Admin Panel">
                <Settings size={20} />
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" title={darkMode ? "Light Mode" : "Dark Mode"}>
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {mode !== 'admin' ? (
            <>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video mb-6">
                  <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" videoConstraints={{ facingMode: "user" }} />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-28 h-40 md:w-36 md:h-52 border-2 border-dashed border-indigo-400/60 rounded-[100%] shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] flex items-center justify-center">
                      <div className="text-indigo-200/40 text-[8px] font-medium uppercase tracking-widest text-center px-4">Face</div>
                    </div>
                  </div>
                  {qualityTip && (
                    <div className="absolute bottom-4 left-4 right-4 bg-amber-500/90 text-white text-xs py-2 px-3 rounded-lg flex items-center gap-2 animate-bounce">
                      <Info size={14} /> {qualityTip}
                    </div>
                  )}
                  {loading && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-10">
                      <RefreshCw className="text-white animate-spin" size={48} />
                    </div>
                  )}
                </div>

                {mode === 'register' && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Registration Name</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Matric Number</label>
                      <input type="text" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} placeholder="Enter matric number" className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    </div>
                  </div>
                )}

                <button onClick={capture} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-4 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-3 transition-all active:scale-[0.98]">
                  <CameraIcon size={24} />
                  {mode === 'register' ? 'Register Face' : 'Identify Face'}
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 min-h-[300px] flex flex-col justify-center items-center text-center">
                  {!result && !error && !loading && (
                    <div className="text-slate-400 dark:text-slate-500">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 mx-auto"><CameraIcon size={32} /></div>
                      <p className="text-lg font-medium">Capture a photo to begin</p>
                    </div>
                  )}
                  {loading && <p className="text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">Processing image...</p>}
                  {error && (
                    <div className="text-red-500 dark:text-red-400">
                      <AlertCircle size={48} className="mb-4 mx-auto" />
                      <p className="text-lg font-bold">Error</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  )}
                  {result && (
                    <div className={result.match || result.success ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}>
                      {result.match || result.success ? <CheckCircle2 size={64} className="mb-4 mx-auto" /> : <AlertCircle size={64} className="mb-4 mx-auto" />}
                      <h2 className="text-2xl font-bold">{result.success ? "Success" : result.match ? "Match Found" : "No Match"}</h2>
                      {result.name && <p className="text-4xl font-black mt-2 tracking-tight uppercase">{result.name}</p>}
                      {result.matric_number && <p className="text-lg text-slate-500 dark:text-slate-400 font-bold mt-1">MATRIC: {result.matric_number}</p>}
                      {result.distance && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic font-mono">Confidence Gap: {(result.distance * 100).toFixed(1)}%</p>}
                      {result.message && <p className="text-slate-600 dark:text-slate-400 mt-2">{result.message}</p>}
                    </div>
                  )}
                </div>
                <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl text-white">
                  <h3 className="font-bold text-lg mb-2">Tips for better results</h3>
                  <ul className="text-indigo-100 space-y-1 list-disc list-inside text-sm">
                    <li>Good lighting is essential</li>
                    <li>Look directly into the camera</li>
                    <li>Keep your face centered</li>
                  </ul>
                </div>
              </div>
            </>
          ) : !isAdminAuthenticated ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md text-center">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Admin Access</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">Enter your administrative password to continue</p>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="relative">
                    <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Admin Password" autoFocus className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-12" />
                    <button type="submit" disabled={loading} className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-xl flex items-center justify-center transition-colors disabled:bg-indigo-400">
                      {loading ? <RefreshCw size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    </button>
                  </div>
                  {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                </form>
                <button onClick={() => setMode('recognize')} className="mt-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold flex items-center justify-center gap-2 mx-auto"><X size={16} /> Cancel</button>
              </div>
            </div>
          ) : (
            <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-6">
                  <button onClick={() => setAdminTab('profiles')} className={`pb-2 text-sm font-bold transition-all border-b-2 ${adminTab === 'profiles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Profiles ({profiles.length})</button>
                  <button onClick={() => setAdminTab('history')} className={`pb-2 text-sm font-bold transition-all border-b-2 ${adminTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>History</button>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => { setIsAdminAuthenticated(false); setAdminPassword(''); setPasswordInput(''); }} className="p-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors mr-2">Logout</button>
                   <button onClick={() => setMode('recognize')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><X size={20} /></button>
                </div>
              </div>

              <div className="p-6 min-h-[400px]">
                {adminTab === 'profiles' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Manage Users</h3>
                      <div className="flex gap-2">
                        <button onClick={() => fetchProfiles()} disabled={loading} className="text-indigo-600 dark:text-indigo-400 text-sm font-bold flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all">
                          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button onClick={clearProfiles} className="text-red-500 text-sm font-bold flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all">
                          <Trash2 size={16} /> Delete All
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {profiles.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400">No profiles registered</div>
                      ) : (
                        profiles.map((p) => (
                          <div key={p.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold">{p.name[0]}</div>
                              <div>
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.name}</h4>
                                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{p.matric_number}</p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500">ID: {p.id.toString().padStart(4, '0')}</p>
                              </div>
                            </div>
                            <button onClick={() => deleteProfile(p.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Match Logs</h3>
                      <div className="flex gap-2">
                        <button onClick={() => fetchLogs()} disabled={loading} className="text-indigo-600 dark:text-indigo-400 text-sm font-bold flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all">
                          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button onClick={clearLogs} className="text-slate-400 text-sm font-bold flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                          <Trash2 size={16} /> Clear Logs
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                          <tr><th className="pb-4">User</th><th className="pb-4">Status</th><th className="pb-4">Gap</th><th className="pb-4 text-right">Time</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {logs.length === 0 ? (
                            <tr><td colSpan={4} className="py-12 text-center text-slate-400">No history available</td></tr>
                          ) : (
                            logs.map((log) => (
                              <tr key={log.id}>
                                <td className="py-3">
                                  <div className="font-bold text-slate-700 dark:text-slate-200">{log.name}</div>
                                  <div className="text-[10px] text-slate-400">{log.matric_number}</div>
                                </td>
                                <td className="py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.success ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'}`}>{log.success ? 'OK' : 'FAIL'}</span></td>
                                <td className="py-3 text-slate-400 font-mono text-[10px]">{log.distance !== 'N/A' ? `${(parseFloat(log.distance) * 100).toFixed(1)}%` : '-'}</td>
                                <td className="py-3 text-right text-slate-400 text-[10px]">
                                  <div className="font-bold">{new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').toLocaleDateString()}</div>
                                  <div>{new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmModal.isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 px-4 py-3 rounded-xl text-white font-bold transition-all ${confirmModal.isDangerous ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none'}`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
