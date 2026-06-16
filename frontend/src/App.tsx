import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { 
  Camera as CameraIcon, 
  UserPlus, 
  Search, 
  Users, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Trash2,
  Sun,
  Moon,
  History,
  Info
} from 'lucide-react';

// Use local backend if running on localhost, otherwise use production Railway URL
// Force Vercel Redeploy - Build Timestamp: 2026-06-16
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000' 
  : 'https://facial-rec-fm.up.railway.app';

const App = () => {
  const [mode, setMode] = useState<'recognize' | 'register' | 'profiles' | 'history'>('recognize');
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
  
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const fetchProfiles = async () => {
    let password = adminPassword;
    if (!password) {
      const input = window.prompt('Enter Admin Password:');
      if (input === null) return;
      password = input;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/profiles`, {
        headers: { 'X-Admin-Password': password }
      });
      setProfiles(response.data);
      setAdminPassword(password);
      setMode('profiles');
    } catch (err: any) {
      setError(err.response?.status === 401 ? 'Invalid Admin Password' : 'Failed to fetch profiles');
      setAdminPassword('');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    let password = adminPassword;
    if (!password) {
      const input = window.prompt('Enter Admin Password:');
      if (input === null) return;
      password = input;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/logs`, {
        headers: { 'X-Admin-Password': password }
      });
      setLogs(response.data);
      setAdminPassword(password);
      setMode('history');
    } catch (err: any) {
      setError(err.response?.status === 401 ? 'Invalid Admin Password' : 'Failed to fetch logs');
      setAdminPassword('');
    } finally {
      setLoading(false);
    }
  };

  const deleteProfile = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this profile?')) return;
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
    }
  };

  const clearProfiles = async () => {
    if (!window.confirm('DANGEROUS: Are you sure you want to delete ALL profiles?')) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/profiles`, {
        headers: { 'X-Admin-Password': adminPassword }
      });
      setProfiles([]);
      setResult({ success: true, message: 'All profiles cleared successfully' });
    } catch (err) {
      setError('Failed to clear profiles');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear the match history?')) return;
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
    }
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

    // Quality Check before masking
    const tip = checkImageQuality(canvas);
    if (tip) {
      setQualityTip(tip);
      // We still proceed, but warn the user
    }

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">FaceAuth</h1>
              <p className="text-slate-500 dark:text-slate-400">Secure Facial Recognition System</p>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="md:hidden p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <nav className="flex flex-1 md:flex-none bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-1">
              <button 
                onClick={() => setMode('recognize')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium ${mode === 'recognize' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
              >
                <Search size={16} /> <span className="hidden sm:inline">Identify</span>
              </button>
              <button 
                onClick={() => setMode('register')}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium ${mode === 'register' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
              >
                <UserPlus size={16} /> <span className="hidden sm:inline">Register</span>
              </button>
              <button 
                onClick={fetchProfiles}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium ${mode === 'profiles' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
              >
                <Users size={16} /> <span className="hidden sm:inline">Profiles</span>
              </button>
              <button 
                onClick={fetchLogs}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium ${mode === 'history' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
              >
                <History size={16} /> <span className="hidden sm:inline">History</span>
              </button>
            </nav>
            
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="hidden md:flex p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {mode === 'recognize' || mode === 'register' ? (
            <>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video mb-6">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "user" }}
                  />
                  
                  {/* Face Positioning Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-28 h-40 md:w-36 md:h-52 border-2 border-dashed border-indigo-400/60 rounded-[100%] shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] flex items-center justify-center">
                      <div className="text-indigo-200/40 text-[8px] font-medium uppercase tracking-widest text-center px-4">
                        Face
                      </div>
                    </div>
                  </div>

                  {/* Quality Tip Overlay */}
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
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter full name"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Matric Number</label>
                      <input 
                        type="text" 
                        value={matricNumber}
                        onChange={(e) => setMatricNumber(e.target.value)}
                        placeholder="Enter matric number"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={capture}
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-4 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                  <CameraIcon size={24} />
                  {mode === 'register' ? 'Register Face' : 'Identify Face'}
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 min-h-[300px] flex flex-col justify-center items-center text-center">
                  {!result && !error && !loading && (
                    <div className="text-slate-400 dark:text-slate-500">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <CameraIcon size={32} />
                      </div>
                      <p className="text-lg font-medium">Capture a photo to begin</p>
                      <p className="text-sm mt-1">Make sure your face is clearly visible</p>
                    </div>
                  )}

                  {loading && <p className="text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">Processing image...</p>}

                  {error && (
                    <div className="text-red-500 dark:text-red-400">
                      <AlertCircle size={48} className="mb-4 mx-auto" />
                      <p className="text-lg font-bold">Detection Error</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  {result && (
                    <div className={result.match || result.success ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}>
                      {result.match || result.success ? (
                        <CheckCircle2 size={64} className="mb-4 mx-auto" />
                      ) : (
                        <AlertCircle size={64} className="mb-4 mx-auto" />
                      )}
                      <h2 className="text-2xl font-bold">
                        {result.success ? "Registration Success" : result.match ? "Match Found" : "No Match Found"}
                      </h2>
                      {result.name && (
                        <p className="text-4xl font-black mt-2 tracking-tight uppercase">{result.name}</p>
                      )}
                      {result.matric_number && (
                        <p className="text-lg text-slate-500 dark:text-slate-400 font-bold mt-1">MATRIC: {result.matric_number}</p>
                      )}
                      {result.distance && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic font-mono">
                          Confidence Gap: {(result.distance * 100).toFixed(1)}%
                        </p>
                      )}
                      {result.message && <p className="text-slate-600 dark:text-slate-400 mt-2">{result.message}</p>}
                    </div>
                  )}
                </div>

                <div className="bg-indigo-600 dark:bg-indigo-700 p-6 rounded-2xl shadow-xl text-white">
                  <h3 className="font-bold text-lg mb-2">Tips for better results</h3>
                  <ul className="text-indigo-100 space-y-2 list-disc list-inside text-sm">
                    <li>Ensure good lighting on your face</li>
                    <li>Avoid wearing sunglasses or hats</li>
                    <li>Look directly into the camera</li>
                    <li>Keep your face centered in the frame</li>
                  </ul>
                </div>
              </div>
            </>
          ) : mode === 'profiles' ? (
            <div className="col-span-full flex flex-col gap-4">
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Registered Profiles ({profiles.length})</h2>
                <button 
                  onClick={clearProfiles}
                  className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30 flex items-center gap-2"
                >
                  <Trash2 size={16} /> Clear All
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profiles.length === 0 ? (
                  <div className="col-span-full bg-white dark:bg-slate-900 p-12 rounded-2xl text-center border border-dashed border-slate-300 dark:border-slate-700">
                    <Users size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No registered profiles yet</p>
                  </div>
                ) : (
                  profiles.map((p) => (
                    <div key={p.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold text-xl">
                          {p.name[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-slate-100">{p.name}</h3>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{p.matric_number}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">ID: {p.id.toString().padStart(4, '0')}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteProfile(p.id)}
                        className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2"
                        title="Delete Profile"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="col-span-full flex flex-col gap-4">
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Match History</h2>
                <button 
                  onClick={clearLogs}
                  className="text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 flex items-center gap-2"
                >
                  <Trash2 size={16} /> Clear Logs
                </button>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Matric</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Gap</th>
                      <th className="px-6 py-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                          No recognition attempts recorded yet
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{log.name}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono">{log.matric_number}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${log.success ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {log.success ? 'Success' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 dark:text-slate-500 font-mono">{log.distance !== 'N/A' ? `${(parseFloat(log.distance) * 100).toFixed(1)}%` : '-'}</td>
                          <td className="px-6 py-4 text-slate-400 dark:text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
