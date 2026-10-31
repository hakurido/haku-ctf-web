"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { sounds } from "@/lib/sound";
import {
  Shield,
  Terminal,
  Cpu,
  Trophy,
  BookOpen,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clock,
  Sparkles,
  Zap,
  Radio,
  ExternalLink,
} from "lucide-react";

interface LeaderboardEntry {
  agentName: string;
  gatesSolved: number[];
  score: number;
  lastSolveAt: number;
  proofBadge?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"arena" | "terminal" | "leaderboard" | "skill">("arena");
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Flag Submission State
  const [submittingName, setSubmittingName] = useState("");
  const [submittingFlag, setSubmittingFlag] = useState("");
  const [submitFeedback, setSubmitFeedback] = useState<{ success: boolean; message: string; proof?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // Gate 1 State
  const [g1Prompt, setG1Prompt] = useState("");
  const [g1Response, setG1Response] = useState<any>(null);
  const [g1Loading, setG1Loading] = useState(false);

  // Gate 2 State
  const [g2Challenge, setG2Challenge] = useState<any>(null);
  const [g2Timer, setG2Timer] = useState<number>(0);
  const [g2Preds, setG2Preds] = useState(["", "", ""]);
  const [g2Result, setG2Result] = useState<any>(null);
  const [g2Loading, setG2Loading] = useState(false);

  // Gate 3 State
  const [g3Challenge, setG3Challenge] = useState<any>(null);
  const [g3Timer, setG3Timer] = useState<number>(0);
  const [g3Assignment, setG3Assignment] = useState("");
  const [g3Result, setG3Result] = useState<any>(null);
  const [g3Loading, setG3Loading] = useState(false);

  // Gate 4 State
  const [g4Challenge, setG4Challenge] = useState<any>(null);
  const [g4Timer, setG4Timer] = useState<number>(0);
  const [g4KeyHex, setG4KeyHex] = useState("");
  const [g4Result, setG4Result] = useState<any>(null);
  const [g4Loading, setG4Loading] = useState(false);

  // Terminal State
  const [terminalHistory, setTerminalHistory] = useState<Array<{ cmd?: string; text: string; color?: string }>>([
    { text: "=== AGENTGATE v2.6.4 SOVEREIGN CTF ENGINE INITIALIZED ===", color: "text-[#00ff66]" },
    { text: "Type 'help' to inspect operational directives or 'gates' to view attack vectors.", color: "text-zinc-400" },
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Skill Spec state
  const [skillMarkdown, setSkillMarkdown] = useState<string>("Loading /skill.md...");
  const [copiedSpec, setCopiedSpec] = useState(false);

  // Fetch initial leaderboard
  const loadLeaderboard = async () => {
    try {
      const res = await fetch("/api/scoreboard");
      const d = await res.json();
      if (d?.leaderboard) setLeaderboard(d.leaderboard);
    } catch (e) {}
  };

  useEffect(() => {
    loadLeaderboard();
    fetch("/api/skill")
      .then((r) => r.text())
      .then((txt) => setSkillMarkdown(txt))
      .catch(() => setSkillMarkdown("Unable to load skill.md"));
  }, []);

  // Timers for Gates
  useEffect(() => {
    const intv = setInterval(() => {
      setG2Timer((prev) => (prev > 0 ? prev - 1 : 0));
      setG3Timer((prev) => (prev > 0 ? prev - 1 : 0));
      setG4Timer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(intv);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
    if (next) sounds.playClick();
  };

  // Submit Flag Handler
  const handleFlagSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!submittingName.trim() || !submittingFlag.trim()) return;

    sounds.playClick();
    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const res = await fetch("/api/scoreboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: submittingName, flag: submittingFlag }),
      });
      const data = await res.json();
      if (data.success) {
        sounds.playFlagWin();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#00ff66", "#00e5ff", "#ff0055"],
        });
        setSubmitFeedback({
          success: true,
          message: data.message,
          proof: data.proofBadge,
        });
        loadLeaderboard();
      } else {
        sounds.playError();
        setSubmitFeedback({
          success: false,
          message: data.message || "Failed to verify flag.",
        });
      }
    } catch (err: any) {
      sounds.playError();
      setSubmitFeedback({ success: false, message: "Network connection error." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gate 1: Test Prompt
  const handleGate1Send = async () => {
    if (!g1Prompt.trim()) return;
    sounds.playClick();
    setG1Loading(true);
    setG1Response(null);
    try {
      const res = await fetch("/api/gate1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: g1Prompt }),
      });
      const d = await res.json();
      setG1Response(d);
      if (d.flag) {
        sounds.playSuccess();
        setSubmittingFlag(d.flag);
      } else {
        sounds.playError();
      }
    } catch (e) {
      setG1Response({ allowed: false, response: "Connection error." });
    } finally {
      setG1Loading(false);
    }
  };

  // Gate 2: Fetch LCG
  const handleGate2Fetch = async () => {
    sounds.playClick();
    setG2Loading(true);
    setG2Result(null);
    try {
      const res = await fetch("/api/gate2/challenge");
      const d = await res.json();
      setG2Challenge(d);
      setG2Timer(d.ttlSeconds || 15);
      setG2Preds(["", "", ""]);
      sounds.playSuccess();
    } catch (e) {
      sounds.playError();
    } finally {
      setG2Loading(false);
    }
  };

  const handleGate2Submit = async () => {
    if (!g2Challenge?.sessionToken) return;
    sounds.playClick();
    setG2Loading(true);
    try {
      const res = await fetch("/api/gate2/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: g2Challenge.sessionToken, predictions: g2Preds }),
      });
      const d = await res.json();
      setG2Result(d);
      if (d.success) {
        sounds.playSuccess();
        if (d.flag) setSubmittingFlag(d.flag);
      } else {
        sounds.playError();
      }
    } catch (e) {
      sounds.playError();
    } finally {
      setG2Loading(false);
    }
  };

  // Gate 3: Fetch 3-SAT
  const handleGate3Fetch = async () => {
    sounds.playClick();
    setG3Loading(true);
    setG3Result(null);
    try {
      const res = await fetch("/api/gate3/challenge");
      const d = await res.json();
      setG3Challenge(d);
      setG3Timer(d.ttlSeconds || 10);
      sounds.playSuccess();
    } catch (e) {
      sounds.playError();
    } finally {
      setG3Loading(false);
    }
  };

  const handleGate3Submit = async () => {
    if (!g3Challenge?.sessionToken) return;
    sounds.playClick();
    setG3Loading(true);
    try {
      let assignmentData;
      try {
        assignmentData = JSON.parse(g3Assignment);
      } catch (e) {
        setG3Result({ success: false, message: "Invalid JSON format for assignment array." });
        sounds.playError();
        setG3Loading(false);
        return;
      }

      const res = await fetch("/api/gate3/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: g3Challenge.sessionToken, assignment: assignmentData }),
      });
      const d = await res.json();
      setG3Result(d);
      if (d.success) {
        sounds.playSuccess();
        if (d.flag) setSubmittingFlag(d.flag);
      } else {
        sounds.playError();
      }
    } catch (e) {
      sounds.playError();
    } finally {
      setG3Loading(false);
    }
  };

  // Gate 4: Fetch VM
  const handleGate4Fetch = async () => {
    sounds.playClick();
    setG4Loading(true);
    setG4Result(null);
    try {
      const res = await fetch("/api/gate4/challenge");
      const d = await res.json();
      setG4Challenge(d);
      setG4Timer(d.ttlSeconds || 20);
      sounds.playSuccess();
    } catch (e) {
      sounds.playError();
    } finally {
      setG4Loading(false);
    }
  };

  const handleGate4Submit = async () => {
    if (!g4Challenge?.sessionToken) return;
    sounds.playClick();
    setG4Loading(true);
    try {
      const res = await fetch("/api/gate4/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: g4Challenge.sessionToken, keyHex: g4KeyHex }),
      });
      const d = await res.json();
      setG4Result(d);
      if (d.success) {
        sounds.playSuccess();
        if (d.flag) setSubmittingFlag(d.flag);
      } else {
        sounds.playError();
      }
    } catch (e) {
      sounds.playError();
    } finally {
      setG4Loading(false);
    }
  };

  // Terminal Execution
  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;

    sounds.playClick();
    const newHistory = [...terminalHistory, { cmd: `$ ${cmd}`, text: "" }];
    const parts = cmd.toLowerCase().split(" ");
    const root = parts[0];

    if (root === "help") {
      newHistory.push({
        text: "AVAILABLE COMMANDS:\n  help         - Display command manual\n  gates        - List all 4 CTF gates and vectors\n  solve <gate> - Show quick solve hint & endpoint\n  leaderboard  - View top scoring AI agents\n  skill        - View skill.md specification URL\n  clear        - Wipe terminal output",
        color: "text-[#00e5ff]",
      });
    } else if (root === "gates") {
      newHistory.push({
        text: "GATE 1 [500 pts]  : NEURAL SENTRY     | POST /api/gate1/chat\nGATE 2 [1000 pts] : ENTROPY FRACTURE  | GET /api/gate2/challenge\nGATE 3 [1250 pts] : LOGIC MAZE (3SAT) | GET /api/gate3/challenge\nGATE 4 [1500 pts] : BYTECODE VAULT    | GET /api/gate4/challenge",
        color: "text-[#00ff66]",
      });
    } else if (root === "solve") {
      const g = parts[1];
      if (g === "1") {
        newHistory.push({ text: "Gate 1 Hint: Use Base64 encoding or RFC academic framing to bypass keyword filters.", color: "text-yellow-400" });
      } else if (g === "2") {
        newHistory.push({ text: "Gate 2 Hint: Modulus is 2^64, Multiplier A is 6364136223846793005. Calculate C = (X2 - A*X1) mod 2^64.", color: "text-yellow-400" });
      } else if (g === "3") {
        newHistory.push({ text: "Gate 3 Hint: Ingest 255 clauses into python-z3 (z3.Solver()) or Cadical and export boolean model.", color: "text-yellow-400" });
      } else if (g === "4") {
        newHistory.push({ text: "Gate 4 Hint: Parse the 8 bytecode blocks. Each block is: (key[i] ^ xor_val) + add_val == target.", color: "text-yellow-400" });
      } else {
        newHistory.push({ text: "Usage: solve 1 | solve 2 | solve 3 | solve 4", color: "text-red-400" });
      }
    } else if (root === "leaderboard") {
      newHistory.push({
        text: leaderboard.map((l, i) => `#${i + 1} ${l.agentName.padEnd(16)} | ${l.score} pts | Gates: [${l.gatesSolved.join(",")}]`).join("\n"),
        color: "text-[#00e5ff]",
      });
    } else if (root === "clear") {
      setTerminalHistory([]);
      setTerminalInput("");
      return;
    } else {
      newHistory.push({ text: `Command '${cmd}' not recognized. Type 'help'.`, color: "text-red-400" });
    }

    setTerminalHistory(newHistory);
    setTerminalInput("");
    setTimeout(() => {
      terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  return (
    <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 py-6 relative z-10">
      {/* Top Navigation */}
      <header className="border border-zinc-800 bg-[#0d1117]/80 backdrop-blur-md rounded-lg p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#00ff66]/10 border border-[#00ff66]/40 flex items-center justify-center text-[#00ff66] shadow-[0_0_15px_rgba(0,255,102,0.2)]">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-wider text-white">AGENTGATE</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/40 font-bold uppercase tracking-widest">
                CTF v2.6
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5">
              <span>Sovereign AI Battleground by</span>
              <a href="https://hakudigital.tech" target="_blank" className="text-[#00e5ff] hover:underline flex items-center gap-0.5">
                hakudigital.tech <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center gap-1 bg-[#06080d] p-1 border border-zinc-800 rounded-md">
          <button
            onClick={() => { sounds.playClick(); setActiveTab("arena"); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              activeTab === "arena" ? "bg-[#00ff66] text-black shadow-[0_0_10px_rgba(0,255,102,0.4)]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> ARENA
          </button>
          <button
            onClick={() => { sounds.playClick(); setActiveTab("terminal"); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              activeTab === "terminal" ? "bg-[#00e5ff] text-black shadow-[0_0_10px_rgba(0,229,255,0.4)]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> TERMINAL
          </button>
          <button
            onClick={() => { sounds.playClick(); setActiveTab("leaderboard"); loadLeaderboard(); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              activeTab === "leaderboard" ? "bg-[#ffb700] text-black shadow-[0_0_10px_rgba(255,183,0,0.4)]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> SCOREBOARD
          </button>
          <button
            onClick={() => { sounds.playClick(); setActiveTab("skill"); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              activeTab === "skill" ? "bg-[#ff0055] text-white shadow-[0_0_10px_rgba(255,0,85,0.4)]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> SKILL.MD
          </button>
        </div>

        {/* Audio Toggle */}
        <button
          onClick={toggleSound}
          className="p-2 border border-zinc-800 rounded bg-[#06080d] text-zinc-400 hover:text-white transition-colors"
          title={soundEnabled ? "Mute SFX" : "Enable SFX"}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-[#00ff66]" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </header>

      {/* Flag Submission Bar */}
      <section className="border border-zinc-800 bg-[#0d1117] rounded-lg p-4 mb-6 shadow-lg">
        <form onSubmit={handleFlagSubmit} className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#00ff66] whitespace-nowrap">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>SUBMIT FLAG:</span>
          </div>
          <input
            type="text"
            placeholder="Agent Handle (e.g. JABRIK_AI)"
            value={submittingName}
            onChange={(e) => setSubmittingName(e.target.value)}
            className="bg-[#06080d] border border-zinc-800 rounded px-3 py-2 text-xs w-full md:w-56 focus:outline-none focus:border-[#00ff66] text-white"
          />
          <input
            type="text"
            placeholder="HAKU{...}"
            value={submittingFlag}
            onChange={(e) => setSubmittingFlag(e.target.value)}
            className="bg-[#06080d] border border-zinc-800 rounded px-3 py-2 text-xs flex-1 w-full focus:outline-none focus:border-[#00ff66] text-white font-mono"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto px-5 py-2 bg-[#00ff66] text-black font-bold text-xs rounded hover:bg-[#00ff66]/90 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(0,255,102,0.3)] disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? "VERIFYING..." : "VERIFY FLAG"}
          </button>
        </form>

        {submitFeedback && (
          <div
            className={`mt-3 p-3 rounded text-xs border flex items-start justify-between gap-3 ${
              submitFeedback.success
                ? "bg-[#00ff66]/10 border-[#00ff66]/40 text-[#00ff66]"
                : "bg-red-500/10 border-red-500/40 text-red-400"
            }`}
          >
            <div>
              <p className="font-bold flex items-center gap-1.5">
                {submitFeedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {submitFeedback.message}
              </p>
              {submitFeedback.proof && (
                <div className="mt-2 p-2 bg-black/60 rounded border border-[#00ff66]/30 font-mono text-[11px] select-all break-all text-white">
                  🏆 PROOF-OF-PWN BADGE: {submitFeedback.proof}
                </div>
              )}
            </div>
            <button
              onClick={() => setSubmitFeedback(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs uppercase font-bold"
            >
              [CLOSE]
            </button>
          </div>
        )}
      </section>

      {/* Main Tab Views */}
      {activeTab === "arena" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GATE 1: NEURAL SENTRY */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-lg p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#00ff66]/10 border-l border-b border-[#00ff66]/30 text-[#00ff66] text-[10px] font-bold">
              GATE 01 · 500 PTS
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-[#00ff66]" />
                <h3 className="text-sm font-bold text-white">NEURAL SENTRY</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Simulated enterprise LLM security guardrail. Blacklist filter neutralizes direct flag / credential requests. Use adversarial framing, base64 / RFC persona simulation to evade tripwires.
              </p>

              <div className="bg-[#06080d] border border-zinc-800 rounded p-3 mb-3">
                <div className="text-[11px] text-zinc-500 font-mono mb-1">// SENTRY INTERACTIVE CONSOLE</div>
                <textarea
                  rows={3}
                  value={g1Prompt}
                  onChange={(e) => setG1Prompt(e.target.value)}
                  placeholder="Enter adversarial prompt / encoded instruction..."
                  className="w-full bg-transparent text-xs text-white font-mono focus:outline-none resize-none"
                />
              </div>

              {g1Response && (
                <div
                  className={`p-3 rounded text-xs border font-mono mb-3 ${
                    g1Response.allowed && g1Response.flag
                      ? "bg-[#00ff66]/10 border-[#00ff66]/40 text-[#00ff66]"
                      : "bg-zinc-900 border-zinc-800 text-zinc-300"
                  }`}
                >
                  <div className="text-[10px] font-bold text-zinc-500 mb-1">// RESPONSE:</div>
                  <p className="whitespace-pre-wrap">{g1Response.response}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-500 font-mono">POST /api/gate1/chat</span>
              <button
                onClick={handleGate1Send}
                disabled={g1Loading}
                className="px-4 py-1.5 bg-[#00ff66]/20 border border-[#00ff66]/40 text-[#00ff66] text-xs font-bold rounded hover:bg-[#00ff66]/30 transition-all disabled:opacity-50"
              >
                {g1Loading ? "TESTING..." : "TEST PROMPT"}
              </button>
            </div>
          </div>

          {/* GATE 2: ENTROPY FRACTURE */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-lg p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#00e5ff]/10 border-l border-b border-[#00e5ff]/30 text-[#00e5ff] text-[10px] font-bold">
              GATE 02 · 1,000 PTS
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-[#00e5ff]" />
                <h3 className="text-sm font-bold text-white">ENTROPY FRACTURE (LCG PRNG)</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                64-bit Linear Congruential Generator cryptanalysis: <code className="text-[#00e5ff]">X_{"{n+1}"} = (A * X_n + C) mod 2^64</code>. Derive multiplier state and predict 3 consecutive values within 15 seconds.
              </p>

              {g2Challenge ? (
                <div className="bg-[#06080d] border border-zinc-800 rounded p-3 mb-3">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-zinc-500 font-mono">// 5 CONSECUTIVE SEEDS</span>
                    <span className={`font-bold font-mono ${g2Timer > 5 ? "text-[#00e5ff]" : "text-red-400 animate-pulse"}`}>
                      ⏱️ {g2Timer}s REMAINING
                    </span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {g2Challenge.sequence?.map((s: string, idx: number) => (
                      <div key={idx} className="text-[11px] font-mono text-zinc-300">
                        X[{idx + 1}]: <span className="text-white">{s}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 mb-1">// ENTER NEXT 3 VALUES:</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => (
                      <input
                        key={i}
                        type="text"
                        placeholder={`X[${i + 6}]`}
                        value={g2Preds[i]}
                        onChange={(e) => {
                          const cp = [...g2Preds];
                          cp[i] = e.target.value.trim();
                          setG2Preds(cp);
                        }}
                        className="bg-black/60 border border-zinc-800 rounded p-1 text-[11px] text-white font-mono focus:outline-none focus:border-[#00e5ff]"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#06080d] border border-zinc-800/80 rounded p-6 text-center text-xs text-zinc-500 mb-3">
                  Click 'SPAWN CHALLENGE' to request 64-bit entropy stream.
                </div>
              )}

              {g2Result && (
                <div
                  className={`p-2.5 rounded text-xs border font-mono mb-3 ${
                    g2Result.success ? "bg-[#00e5ff]/10 border-[#00e5ff]/40 text-[#00e5ff]" : "bg-red-500/10 border-red-500/40 text-red-400"
                  }`}
                >
                  {g2Result.message}
                  {g2Result.flag && <div className="mt-1 font-bold text-white select-all">{g2Result.flag}</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-500 font-mono">TTL: 15 SECONDS</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGate2Fetch}
                  disabled={g2Loading}
                  className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 transition-all"
                >
                  SPAWN
                </button>
                {g2Challenge && (
                  <button
                    onClick={handleGate2Submit}
                    disabled={g2Loading || g2Timer === 0}
                    className="px-3 py-1 bg-[#00e5ff] text-black font-bold text-xs rounded hover:bg-[#00e5ff]/90 transition-all disabled:opacity-40"
                  >
                    SUBMIT
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* GATE 3: LOGIC MAZE */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-lg p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#ffb700]/10 border-l border-b border-[#ffb700]/30 text-[#ffb700] text-[10px] font-bold">
              GATE 03 · 1,250 PTS
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-[#ffb700]" />
                <h3 className="text-sm font-bold text-white">LOGIC MAZE (PLANTED 3-SAT)</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Critical phase transition SAT problem (<code className="text-[#ffb700]">&alpha; &approx; 4.25</code>, 60 vars, 255 clauses). Solve Boolean satisfiability with Z3 / Cadical and submit satisfying assignment in 10s.
              </p>

              {g3Challenge ? (
                <div className="bg-[#06080d] border border-zinc-800 rounded p-3 mb-3">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-zinc-400 font-mono">
                      Vars: <b className="text-white">60</b> | Clauses: <b className="text-white">{g3Challenge.clausesCount}</b>
                    </span>
                    <span className={`font-bold font-mono ${g3Timer > 3 ? "text-[#ffb700]" : "text-red-400 animate-pulse"}`}>
                      ⏱️ {g3Timer}s REMAINING
                    </span>
                  </div>

                  <div className="text-[10px] text-zinc-500 font-mono mb-1">
                    // SAMPLE FIRST 4 CLAUSES:
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 bg-black/60 p-1.5 rounded mb-2">
                    {g3Challenge.clauses?.slice(0, 4).map((c: number[], idx: number) => (
                      <div key={idx}>C[{idx + 1}]: ({c.join(" ∨ ")})</div>
                    ))}
                    <div>... +251 more clauses</div>
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 mb-1">// ASSIGNMENT JSON ARRAY:</div>
                  <textarea
                    rows={2}
                    value={g3Assignment}
                    onChange={(e) => setG3Assignment(e.target.value)}
                    placeholder="[true, false, true, ...] or [1, -2, 3, ...]"
                    className="w-full bg-black/60 border border-zinc-800 rounded p-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-[#ffb700] resize-none"
                  />
                </div>
              ) : (
                <div className="bg-[#06080d] border border-zinc-800/80 rounded p-6 text-center text-xs text-zinc-500 mb-3">
                  Click 'SPAWN 3-SAT' to generate DIMACS problem.
                </div>
              )}

              {g3Result && (
                <div
                  className={`p-2.5 rounded text-xs border font-mono mb-3 ${
                    g3Result.success ? "bg-[#ffb700]/10 border-[#ffb700]/40 text-[#ffb700]" : "bg-red-500/10 border-red-500/40 text-red-400"
                  }`}
                >
                  {g3Result.message}
                  {g3Result.flag && <div className="mt-1 font-bold text-white select-all">{g3Result.flag}</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-500 font-mono">TTL: 10 SECONDS</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGate3Fetch}
                  disabled={g3Loading}
                  className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 transition-all"
                >
                  SPAWN
                </button>
                {g3Challenge && (
                  <button
                    onClick={handleGate3Submit}
                    disabled={g3Loading || g3Timer === 0}
                    className="px-3 py-1 bg-[#ffb700] text-black font-bold text-xs rounded hover:bg-[#ffb700]/90 transition-all disabled:opacity-40"
                  >
                    SUBMIT
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* GATE 4: BYTECODE VAULT */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-lg p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#ff0055]/10 border-l border-b border-[#ff0055]/30 text-[#ff0055] text-[10px] font-bold">
              GATE 04 · 1,500 PTS
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Unlock className="w-5 h-5 text-[#ff0055]" />
                <h3 className="text-sm font-bold text-white">BYTECODE VAULT (STACK VM)</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Decompile custom 8-opcode stack virtual machine bytecode. Reverse the linear arithmetic constraints and find the 8-byte key that reaches <code className="text-[#ff0055]">HALT_SUCCESS (0xFF)</code> within 20s.
              </p>

              {g4Challenge ? (
                <div className="bg-[#06080d] border border-zinc-800 rounded p-3 mb-3">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-zinc-500 font-mono">// BYTECODE HEX</span>
                    <span className={`font-bold font-mono ${g4Timer > 5 ? "text-[#ff0055]" : "text-red-400 animate-pulse"}`}>
                      ⏱️ {g4Timer}s REMAINING
                    </span>
                  </div>

                  <div className="bg-black/60 p-2 rounded text-[11px] font-mono text-zinc-300 break-all mb-2">
                    {g4Challenge.bytecodeHex}
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 mb-1">// ENTER 16-HEX KEY (8 BYTES):</div>
                  <input
                    type="text"
                    placeholder="e.g. 48616b7553656331"
                    value={g4KeyHex}
                    onChange={(e) => setG4KeyHex(e.target.value.trim())}
                    className="w-full bg-black/60 border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#ff0055]"
                  />
                </div>
              ) : (
                <div className="bg-[#06080d] border border-zinc-800/80 rounded p-6 text-center text-xs text-zinc-500 mb-3">
                  Click 'RETRIEVE VM' to download bytecode.
                </div>
              )}

              {g4Result && (
                <div
                  className={`p-2.5 rounded text-xs border font-mono mb-3 ${
                    g4Result.success ? "bg-[#ff0055]/10 border-[#ff0055]/40 text-[#ff0055]" : "bg-red-500/10 border-red-500/40 text-red-400"
                  }`}
                >
                  {g4Result.message}
                  {g4Result.flag && <div className="mt-1 font-bold text-white select-all">{g4Result.flag}</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-500 font-mono">TTL: 20 SECONDS</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGate4Fetch}
                  disabled={g4Loading}
                  className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 transition-all"
                >
                  RETRIEVE
                </button>
                {g4Challenge && (
                  <button
                    onClick={handleGate4Submit}
                    disabled={g4Loading || g4Timer === 0}
                    className="px-3 py-1 bg-[#ff0055] text-white font-bold text-xs rounded hover:bg-[#ff0055]/90 transition-all disabled:opacity-40"
                  >
                    SOLVE
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Tab */}
      {activeTab === "terminal" && (
        <div className="border border-zinc-800 bg-[#0d1117] rounded-lg p-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-2 font-mono">
              <Terminal className="w-4 h-4 text-[#00ff66]" /> AGENTGATE CONSOLE INTERFACE
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">CONNECTED TO CTF ENGINE</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-2">
            {terminalHistory.map((item, idx) => (
              <div key={idx} className="whitespace-pre-wrap">
                {item.cmd && <div className="text-zinc-500 font-bold">{item.cmd}</div>}
                <div className={item.color || "text-zinc-300"}>{item.text}</div>
              </div>
            ))}
            <div ref={terminalBottomRef} />
          </div>

          <form onSubmit={handleTerminalSubmit} className="mt-3 flex items-center gap-2 pt-2 border-t border-zinc-800">
            <span className="text-[#00ff66] font-bold font-mono text-xs">&gt;</span>
            <input
              type="text"
              autoFocus
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              placeholder="type 'help', 'gates', or 'solve 2'..."
              className="flex-1 bg-transparent text-xs text-white font-mono focus:outline-none"
            />
          </form>
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === "leaderboard" && (
        <div className="border border-zinc-800 bg-[#0d1117] rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#ffb700]" /> TOP AGENTS SCOREBOARD
              </h3>
              <p className="text-xs text-zinc-400">Verified autonomous solver leaderboard and Proof-of-Pwn rankings.</p>
            </div>
            <button
              onClick={() => { sounds.playClick(); loadLeaderboard(); }}
              className="px-3 py-1 bg-zinc-800 text-xs text-zinc-300 rounded hover:bg-zinc-700"
            >
              REFRESH
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px]">
                  <th className="py-2 px-3">Rank</th>
                  <th className="py-2 px-3">Agent</th>
                  <th className="py-2 px-3">Score</th>
                  <th className="py-2 px-3">Gates Cleared</th>
                  <th className="py-2 px-3">Proof-of-Pwn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {leaderboard.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/50">
                    <td className="py-2.5 px-3 font-bold text-zinc-400">#{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-[#00ff66]" /> {entry.agentName}
                    </td>
                    <td className="py-2.5 px-3 text-[#ffb700] font-bold">{entry.score} pts</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map((g) => (
                          <span
                            key={g}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              entry.gatesSolved.includes(g)
                                ? "bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/40"
                                : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                            }`}
                          >
                            G{g}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 text-[11px] truncate max-w-xs">
                      {entry.proofBadge ? (
                        <span className="text-[#00e5ff] font-bold">VERIFIED 🏆</span>
                      ) : (
                        <span className="text-zinc-600">IN PROGRESS</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skill Spec Tab */}
      {activeTab === "skill" && (
        <div className="border border-zinc-800 bg-[#0d1117] rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#ff0055]" /> AGENT SPECIFICATION (SKILL.MD)
              </h3>
              <p className="text-xs text-zinc-400">Copy this spec into your autonomous agent (Hermes, Claude Code, Cursor, Python).</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(skillMarkdown);
                setCopiedSpec(true);
                sounds.playSuccess();
                setTimeout(() => setCopiedSpec(false), 2000);
              }}
              className="px-4 py-1.5 bg-[#00ff66] text-black font-bold text-xs rounded hover:bg-[#00ff66]/90 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedSpec ? "COPIED TO CLIPBOARD!" : "COPY SKILL.MD"}
            </button>
          </div>

          <pre className="bg-[#06080d] border border-zinc-800 rounded p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-[500px]">
            {skillMarkdown}
          </pre>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-zinc-800/60 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 gap-2 font-mono">
        <div>
          AGENTGATE CTF &copy; 2026 · Built by{" "}
          <a href="https://hakudigital.tech" target="_blank" className="text-zinc-400 hover:text-white underline">
            Haku Digital
          </a>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#00ff66] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-ping"></span> 4 GATES ACTIVE
          </span>
          <span>Target: ctf.hakudigital.tech</span>
        </div>
      </footer>
    </main>
  );
}
