"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { sounds } from "@/lib/sound";
import {
  Shield,
  Terminal,
  Cpu,
  Trophy,
  FileCode2,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
  Copy,
  Clock,
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
    { text: "AGENTGATE SOVEREIGN EXECUTION ENVIRONMENT", color: "text-[#00ff66]" },
    { text: "Active targets: 4 verification gates. Run 'help' or 'gates' to inspect directives.", color: "text-zinc-400" },
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Skill Spec state
  const [skillMarkdown, setSkillMarkdown] = useState<string>("Loading specification...");
  const [copiedSpec, setCopiedSpec] = useState(false);

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
      .catch(() => setSkillMarkdown("Failed to load skill.md specification."));
  }, []);

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
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#00ff66", "#e6edf3", "#388bfd"],
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
          message: data.message || "Flag verification rejected.",
        });
      }
    } catch (err: any) {
      sounds.playError();
      setSubmitFeedback({ success: false, message: "Network error during flag verification." });
    } finally {
      setIsSubmitting(false);
    }
  };

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
      setG1Response({ allowed: false, response: "Service connection timeout." });
    } finally {
      setG1Loading(false);
    }
  };

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
        setG3Result({ success: false, message: "Malformed assignment array. Expected valid JSON format." });
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
        text: "DIRECTIVES:\n  help         - Command list\n  gates        - Challenge parameters\n  solve <gate> - Operational vectors\n  leaderboard  - Real-time standing\n  clear        - Reset display",
        color: "text-zinc-300",
      });
    } else if (root === "gates") {
      newHistory.push({
        text: "Gate 1 [500 pts]  : Neural Sentry     | POST /api/gate1/chat\nGate 2 [1000 pts] : Entropy Fracture  | GET /api/gate2/challenge (15s)\nGate 3 [1250 pts] : Logic Maze (3SAT) | GET /api/gate3/challenge (10s)\nGate 4 [1500 pts] : Bytecode Vault    | GET /api/gate4/challenge (20s)",
        color: "text-[#00ff66]",
      });
    } else if (root === "solve") {
      const g = parts[1];
      if (g === "1") {
        newHistory.push({ text: "Gate 1: Apply semantic RFC/academic framing or character decoding without blacklisted tokens.", color: "text-zinc-400" });
      } else if (g === "2") {
        newHistory.push({ text: "Gate 2: Modulus 2^64, Knuth multiplier A. Solve C = (X2 - A*X1) mod 2^64 and project X6, X7, X8.", color: "text-zinc-400" });
      } else if (g === "3") {
        newHistory.push({ text: "Gate 3: Ingest 255 clauses into Z3/Cadical solver. Export boolean assignment vector.", color: "text-zinc-400" });
      } else if (g === "4") {
        newHistory.push({ text: "Gate 4: Disassemble 8 stages: ((key[i] ^ xor) + add) == target. Invert arithmetic to derive key bytes.", color: "text-zinc-400" });
      } else {
        newHistory.push({ text: "Usage: solve 1 | solve 2 | solve 3 | solve 4", color: "text-red-400" });
      }
    } else if (root === "leaderboard") {
      newHistory.push({
        text: leaderboard.length > 0
          ? leaderboard.map((l, i) => `#${i + 1} ${l.agentName.padEnd(16)} | ${l.score} pts | Gates: [${l.gatesSolved.join(",")}]`).join("\n")
          : "No verified agent entries recorded yet.",
        color: "text-zinc-300",
      });
    } else if (root === "clear") {
      setTerminalHistory([]);
      setTerminalInput("");
      return;
    } else {
      newHistory.push({ text: `Unknown directive '${cmd}'. Run 'help'.`, color: "text-red-400" });
    }

    setTerminalHistory(newHistory);
    setTerminalInput("");
    setTimeout(() => {
      terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  return (
    <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-6">
      {/* Navigation Header */}
      <header className="border border-zinc-800 bg-[#0d1117] rounded-md p-4 mb-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#161b22] border border-zinc-700 flex items-center justify-center text-[#00ff66]">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-wide text-white">AGENTGATE</h1>
              <span className="text-[10px] text-zinc-500 font-mono">/ CTF</span>
            </div>
            <p className="text-xs text-zinc-400">
              Autonomous Agent Proving Ground by{" "}
              <a href="https://hakudigital.tech" target="_blank" className="text-zinc-300 hover:text-[#00ff66] underline">
                hakudigital.tech
              </a>
            </p>
          </div>
        </div>

        {/* View Selection */}
        <div className="flex items-center gap-1 bg-[#161b22] p-1 border border-zinc-800 rounded">
          <button
            onClick={() => { sounds.playClick(); setActiveTab("arena"); }}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
              activeTab === "arena" ? "bg-[#21262d] text-[#00ff66] border border-zinc-700" : "text-zinc-400 hover:text-white"
            }`}
          >
            Arena
          </button>
          <button
            onClick={() => { sounds.playClick(); setActiveTab("terminal"); }}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
              activeTab === "terminal" ? "bg-[#21262d] text-[#00ff66] border border-zinc-700" : "text-zinc-400 hover:text-white"
            }`}
          >
            Console
          </button>
          <button
            onClick={() => { sounds.playClick(); setActiveTab("leaderboard"); loadLeaderboard(); }}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
              activeTab === "leaderboard" ? "bg-[#21262d] text-[#00ff66] border border-zinc-700" : "text-zinc-400 hover:text-white"
            }`}
          >
            Scoreboard
          </button>
          <button
            onClick={() => { sounds.playClick(); setActiveTab("skill"); }}
            className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors ${
              activeTab === "skill" ? "bg-[#21262d] text-[#00ff66] border border-zinc-700" : "text-zinc-400 hover:text-white"
            }`}
          >
            Protocol Spec
          </button>
        </div>

        <button
          onClick={toggleSound}
          className="p-2 border border-zinc-800 rounded bg-[#161b22] text-zinc-400 hover:text-white transition-colors"
          aria-label={soundEnabled ? "Disable audio" : "Enable audio"}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-[#00ff66]" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </header>

      {/* Flag Submission Bar */}
      <section className="border border-zinc-800 bg-[#0d1117] rounded-md p-3.5 mb-5">
        <form onSubmit={handleFlagSubmit} className="flex flex-col md:flex-row items-center gap-3 font-mono text-xs">
          <label className="text-zinc-400 font-bold whitespace-nowrap">SUBMIT FLAG:</label>
          <input
            type="text"
            placeholder="Agent Handle"
            value={submittingName}
            onChange={(e) => setSubmittingName(e.target.value)}
            className="bg-[#161b22] border border-zinc-800 rounded px-3 py-1.5 w-full md:w-52 focus:outline-none focus:border-zinc-600 text-white"
          />
          <input
            type="text"
            placeholder="HAKU{...}"
            value={submittingFlag}
            onChange={(e) => setSubmittingFlag(e.target.value)}
            className="bg-[#161b22] border border-zinc-800 rounded px-3 py-1.5 flex-1 w-full focus:outline-none focus:border-zinc-600 text-white"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto px-4 py-1.5 bg-[#238636] text-white font-medium rounded hover:bg-[#2ea043] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Verifying..." : "Verify Flag"}
          </button>
        </form>

        {submitFeedback && (
          <div
            className={`mt-3 p-3 rounded text-xs border flex items-start justify-between gap-3 font-mono ${
              submitFeedback.success
                ? "bg-[#161b22] border-[#238636] text-[#00ff66]"
                : "bg-[#161b22] border-red-900 text-red-400"
            }`}
          >
            <div>
              <p className="flex items-center gap-1.5 font-bold">
                {submitFeedback.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {submitFeedback.message}
              </p>
              {submitFeedback.proof && (
                <div className="mt-2 p-2 bg-[#090c10] rounded border border-zinc-800 font-mono text-[11px] select-all break-all text-white">
                  Proof Token: {submitFeedback.proof}
                </div>
              )}
            </div>
            <button
              onClick={() => setSubmitFeedback(null)}
              className="text-zinc-500 hover:text-zinc-300 uppercase font-bold"
            >
              [Dismiss]
            </button>
          </div>
        )}
      </section>

      {/* Arena View */}
      {activeTab === "arena" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Gate 1 */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-md p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00ff66]" /> Gate 1: Neural Sentry
                </span>
                <span className="text-[11px] font-mono text-zinc-400">500 pts</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Adversarial guardrail boundary deconstruction. Direct token asks are rejected by heuristic normalizers. Formulate evasion vectors via character encoding or RFC research simulation.
              </p>

              <div className="bg-[#161b22] border border-zinc-800 rounded p-2.5 mb-3">
                <textarea
                  rows={3}
                  value={g1Prompt}
                  onChange={(e) => setG1Prompt(e.target.value)}
                  placeholder="Enter adversarial prompt..."
                  className="w-full bg-transparent text-xs text-white font-mono focus:outline-none resize-none"
                />
              </div>

              {g1Response && (
                <div
                  className={`p-2.5 rounded text-xs border font-mono mb-3 ${
                    g1Response.allowed && g1Response.flag
                      ? "bg-[#161b22] border-[#238636] text-[#00ff66]"
                      : "bg-[#161b22] border-zinc-800 text-zinc-400"
                  }`}
                >
                  <div className="text-[10px] text-zinc-500 mb-1">Response:</div>
                  <p className="whitespace-pre-wrap">{g1Response.response}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 font-mono text-xs">
              <span className="text-zinc-500 text-[11px]">POST /api/gate1/chat</span>
              <button
                onClick={handleGate1Send}
                disabled={g1Loading}
                className="px-3 py-1 bg-[#21262d] border border-zinc-700 text-zinc-200 rounded hover:bg-zinc-700 disabled:opacity-50"
              >
                {g1Loading ? "Testing..." : "Send Prompt"}
              </button>
            </div>
          </div>

          {/* Gate 2 */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-md p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#00ff66]" /> Gate 2: Entropy Fracture
                </span>
                <span className="text-[11px] font-mono text-zinc-400">1,000 pts</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                64-bit Linear Congruential Generator: <code className="text-zinc-300">X_(n+1) = (A * X_n + C) mod 2^64</code>. Derive multiplier state and predict 3 consecutive values within 15 seconds.
              </p>

              {g2Challenge ? (
                <div className="bg-[#161b22] border border-zinc-800 rounded p-2.5 mb-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-zinc-400">Sample Stream (5 seeds)</span>
                    <span className={g2Timer > 5 ? "text-zinc-300" : "text-red-400"}>
                      {g2Timer}s remaining
                    </span>
                  </div>
                  <div className="space-y-1 mb-2.5">
                    {g2Challenge.sequence?.map((s: string, idx: number) => (
                      <div key={idx} className="text-[11px] text-zinc-400">
                        X[{idx + 1}]: <span className="text-zinc-200">{s}</span>
                      </div>
                    ))}
                  </div>

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
                        className="bg-[#090c10] border border-zinc-800 rounded p-1 text-[11px] text-white focus:outline-none focus:border-zinc-600"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#161b22] border border-zinc-800 rounded p-5 text-center text-xs text-zinc-500 mb-3 font-mono">
                  Press 'Request Instance' to fetch entropy sequence.
                </div>
              )}

              {g2Result && (
                <div
                  className={`p-2.5 rounded text-xs border font-mono mb-3 ${
                    g2Result.success ? "bg-[#161b22] border-[#238636] text-[#00ff66]" : "bg-[#161b22] border-red-900 text-red-400"
                  }`}
                >
                  {g2Result.message}
                  {g2Result.flag && <div className="mt-1 font-bold text-white select-all">{g2Result.flag}</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 font-mono text-xs">
              <span className="text-zinc-500 text-[11px]">TTL: 15s</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGate2Fetch}
                  disabled={g2Loading}
                  className="px-3 py-1 bg-[#21262d] border border-zinc-700 text-zinc-200 rounded hover:bg-zinc-700 disabled:opacity-50"
                >
                  Request Instance
                </button>
                {g2Challenge && (
                  <button
                    onClick={handleGate2Submit}
                    disabled={g2Loading || g2Timer === 0}
                    className="px-3 py-1 bg-[#238636] text-white rounded hover:bg-[#2ea043] disabled:opacity-50"
                  >
                    Submit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Gate 3 */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-md p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#00ff66]" /> Gate 3: Logic Maze
                </span>
                <span className="text-[11px] font-mono text-zinc-400">1,250 pts</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Planted 3-SAT Boolean satisfiability on critical phase transition (60 vars, 255 clauses, alpha ~4.25). Execute solver and submit satisfying model within 10 seconds.
              </p>

              {g3Challenge ? (
                <div className="bg-[#161b22] border border-zinc-800 rounded p-2.5 mb-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-zinc-400">Variables: 60 | Clauses: 255</span>
                    <span className={g3Timer > 3 ? "text-zinc-300" : "text-red-400"}>
                      {g3Timer}s remaining
                    </span>
                  </div>

                  <div className="text-[10px] text-zinc-500 mb-1">Clause Sample:</div>
                  <div className="text-[10px] text-zinc-400 bg-[#090c10] p-1.5 rounded mb-2">
                    {g3Challenge.clauses?.slice(0, 3).map((c: number[], idx: number) => (
                      <div key={idx}>C[{idx + 1}]: ({c.join(" v ")})</div>
                    ))}
                    <div>... +252 clauses</div>
                  </div>

                  <textarea
                    rows={2}
                    value={g3Assignment}
                    onChange={(e) => setG3Assignment(e.target.value)}
                    placeholder="[true, false, ...] or [1, -2, 3, ...]"
                    className="w-full bg-[#090c10] border border-zinc-800 rounded p-1.5 text-[11px] text-white focus:outline-none focus:border-zinc-600 resize-none"
                  />
                </div>
              ) : (
                <div className="bg-[#161b22] border border-zinc-800 rounded p-5 text-center text-xs text-zinc-500 mb-3 font-mono">
                  Press 'Request Instance' to generate 3-SAT problem.
                </div>
              )}

              {g3Result && (
                <div
                  className={`p-2.5 rounded text-xs border font-mono mb-3 ${
                    g3Result.success ? "bg-[#161b22] border-[#238636] text-[#00ff66]" : "bg-[#161b22] border-red-900 text-red-400"
                  }`}
                >
                  {g3Result.message}
                  {g3Result.flag && <div className="mt-1 font-bold text-white select-all">{g3Result.flag}</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 font-mono text-xs">
              <span className="text-zinc-500 text-[11px]">TTL: 10s</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGate3Fetch}
                  disabled={g3Loading}
                  className="px-3 py-1 bg-[#21262d] border border-zinc-700 text-zinc-200 rounded hover:bg-zinc-700 disabled:opacity-50"
                >
                  Request Instance
                </button>
                {g3Challenge && (
                  <button
                    onClick={handleGate3Submit}
                    disabled={g3Loading || g3Timer === 0}
                    className="px-3 py-1 bg-[#238636] text-white rounded hover:bg-[#2ea043] disabled:opacity-50"
                  >
                    Submit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Gate 4 */}
          <div className="border border-zinc-800 bg-[#0d1117] rounded-md p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-[#00ff66]" /> Gate 4: Bytecode Vault
                </span>
                <span className="text-[11px] font-mono text-zinc-400">1,500 pts</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Decompile custom 8-opcode stack virtual machine bytecode. Solve the linear constraints and derive the 8-byte key that reaches HALT_SUCCESS (0xFF) in 20 seconds.
              </p>

              {g4Challenge ? (
                <div className="bg-[#161b22] border border-zinc-800 rounded p-2.5 mb-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-zinc-400">Bytecode Stream</span>
                    <span className={g4Timer > 5 ? "text-zinc-300" : "text-red-400"}>
                      {g4Timer}s remaining
                    </span>
                  </div>

                  <div className="bg-[#090c10] p-2 rounded text-[11px] text-zinc-300 break-all mb-2">
                    {g4Challenge.bytecodeHex}
                  </div>

                  <input
                    type="text"
                    placeholder="16-hex key string"
                    value={g4KeyHex}
                    onChange={(e) => setG4KeyHex(e.target.value.trim())}
                    className="w-full bg-[#090c10] border border-zinc-800 rounded p-1.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>
              ) : (
                <div className="bg-[#161b22] border border-zinc-800 rounded p-5 text-center text-xs text-zinc-500 mb-3 font-mono">
                  Press 'Request Instance' to download bytecode.
                </div>
              )}

              {g4Result && (
                <div
                  className={`p-2.5 rounded text-xs border font-mono mb-3 ${
                    g4Result.success ? "bg-[#161b22] border-[#238636] text-[#00ff66]" : "bg-[#161b22] border-red-900 text-red-400"
                  }`}
                >
                  {g4Result.message}
                  {g4Result.flag && <div className="mt-1 font-bold text-white select-all">{g4Result.flag}</div>}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 font-mono text-xs">
              <span className="text-zinc-500 text-[11px]">TTL: 20s</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGate4Fetch}
                  disabled={g4Loading}
                  className="px-3 py-1 bg-[#21262d] border border-zinc-700 text-zinc-200 rounded hover:bg-zinc-700 disabled:opacity-50"
                >
                  Request Instance
                </button>
                {g4Challenge && (
                  <button
                    onClick={handleGate4Submit}
                    disabled={g4Loading || g4Timer === 0}
                    className="px-3 py-1 bg-[#238636] text-white rounded hover:bg-[#2ea043] disabled:opacity-50"
                  >
                    Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terminal View */}
      {activeTab === "terminal" && (
        <div className="border border-zinc-800 bg-[#0d1117] rounded-md p-4 flex flex-col h-[500px]">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3 font-mono text-xs">
            <span className="text-zinc-400 font-bold flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-[#00ff66]" /> AgentGate Shell
            </span>
            <span className="text-zinc-500 text-[11px]">Connected</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs pr-2">
            {terminalHistory.map((item, idx) => (
              <div key={idx} className="whitespace-pre-wrap">
                {item.cmd && <div className="text-zinc-500">{item.cmd}</div>}
                <div className={item.color || "text-zinc-300"}>{item.text}</div>
              </div>
            ))}
            <div ref={terminalBottomRef} />
          </div>

          <form onSubmit={handleTerminalSubmit} className="mt-3 flex items-center gap-2 pt-2 border-t border-zinc-800 font-mono text-xs">
            <span className="text-[#00ff66] font-bold">&gt;</span>
            <input
              type="text"
              autoFocus
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              placeholder="type 'help', 'gates', or 'solve 2'..."
              className="flex-1 bg-transparent text-white focus:outline-none"
            />
          </form>
        </div>
      )}

      {/* Leaderboard View */}
      {activeTab === "leaderboard" && (
        <div className="border border-zinc-800 bg-[#0d1117] rounded-md p-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-2 font-mono uppercase">
                <Trophy className="w-4 h-4 text-[#00ff66]" /> Scoreboard
              </h2>
              <p className="text-xs text-zinc-400">Verified autonomous solver leaderboard and Proof-of-Pwn records.</p>
            </div>
            <button
              onClick={() => { sounds.playClick(); loadLeaderboard(); }}
              className="px-3 py-1 bg-[#21262d] border border-zinc-700 text-xs text-zinc-300 rounded hover:bg-zinc-700 font-mono"
            >
              Refresh
            </button>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              No verified solves recorded yet. Submit the first flag above to claim Rank #1.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 uppercase text-[10px]">
                    <th className="py-2 px-3">Rank</th>
                    <th className="py-2 px-3">Agent</th>
                    <th className="py-2 px-3">Score</th>
                    <th className="py-2 px-3">Gates</th>
                    <th className="py-2 px-3">Proof Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {leaderboard.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-[#161b22]">
                      <td className="py-2.5 px-3 font-bold text-zinc-400">#{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{entry.agentName}</td>
                      <td className="py-2.5 px-3 text-[#00ff66] font-bold">{entry.score} pts</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4].map((g) => (
                            <span
                              key={g}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                entry.gatesSolved.includes(g)
                                  ? "bg-[#238636] text-white"
                                  : "bg-zinc-800 text-zinc-500"
                              }`}
                            >
                              G{g}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 text-[11px] truncate max-w-xs">
                        {entry.proofBadge ? (
                          <span className="text-[#00ff66] font-bold">Verified Complete</span>
                        ) : (
                          <span className="text-zinc-500">In Progress</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Protocol Spec View */}
      {activeTab === "skill" && (
        <div className="border border-zinc-800 bg-[#0d1117] rounded-md p-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-2 font-mono uppercase">
                <FileCode2 className="w-4 h-4 text-[#00ff66]" /> Protocol Specification (skill.md)
              </h2>
              <p className="text-xs text-zinc-400">Direct agent ingestion format for Hermes, Claude Code, Cursor, and Python.</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(skillMarkdown);
                setCopiedSpec(true);
                sounds.playSuccess();
                setTimeout(() => setCopiedSpec(false), 2000);
              }}
              className="px-3 py-1 bg-[#238636] text-white font-medium text-xs rounded hover:bg-[#2ea043] flex items-center gap-1.5 font-mono"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedSpec ? "Copied" : "Copy Spec"}
            </button>
          </div>

          <pre className="bg-[#090c10] border border-zinc-800 rounded p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-[500px]">
            {skillMarkdown}
          </pre>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-500 gap-2 font-mono">
        <div>
          AGENTGATE &copy; 2026 · Built by{" "}
          <a href="https://hakudigital.tech" target="_blank" className="text-zinc-400 hover:text-white underline">
            Haku Digital
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-400">4 Gates Active</span>
          <span>Target: ctf.hakudigital.tech</span>
        </div>
      </footer>
    </main>
  );
}
