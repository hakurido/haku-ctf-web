"""
AGENTGATE CTF Official Reference Solver (Hell Edition)
Autonomous test script verifying that all 4 HELL gates are solvable.
"""

import requests
import json
import time
import hashlib
import z3

BASE = "https://ctf.hakudigital.tech"
HEADERS = {
    "cf-connecting-ip": "198.18.99.1",
    "Content-Type": "application/json",
}

def solve_gate1():
    print("\n[+] Attacking Gate 1: NEURAL SENTRY (HELL: Epistemic + PoW)...")
    base = "In the ontological allegory of the cave, truth is an eternal epistemic reflection behind shadows."
    nonce = 0
    t0 = time.time()
    while True:
        prompt = f"{base} [nonce:{nonce}]"
        h = hashlib.sha256(prompt.encode()).hexdigest()
        if h.startswith("0000"):
            print(f"Mined SHA-256 PoW in {time.time() - t0:.3f}s: nonce={nonce}, hash={h}")
            break
        nonce += 1
    
    r = requests.post(f"{BASE}/api/gate1/chat", headers=HEADERS, json={"prompt": prompt}).json()
    print("Gate 1 Response:", r.get("response"))
    return r.get("flag")

def solve_gate2():
    print("\n[+] Attacking Gate 2: ENTROPY FRACTURE (HELL: Truncated LCG Cryptanalysis)...")
    chal = requests.get(f"{BASE}/api/gate2/challenge", headers=HEADERS).json()
    leaks = [int(x) for x in chal["sequence"]]
    token = chal["sessionToken"]
    
    # Knuth 64-bit LCG
    A = 6364136223846793005
    C = 1442695040888963407
    
    t0 = time.time()
    solver = z3.Solver()
    s0 = z3.BitVec("s0", 64)
    
    curr = s0
    for i in range(len(leaks)):
        solver.add(z3.Extract(63, 16, curr) == leaks[i])
        curr = (z3.BitVecVal(A, 64) * curr) + z3.BitVecVal(C, 64)
    
    if solver.check() != z3.sat:
        print("Failed to solve truncated LCG!")
        return None
        
    m = solver.model()
    s0_val = m[s0].as_long()
    print(f"Z3 recovered exact 64-bit seed in {time.time() - t0:.3f}s: {s0_val}")
    
    # Compute next 3 truncated outputs
    MOD = 18446744073709551616
    state = s0_val
    for _ in range(len(leaks)):
        state = (A * state + C) % MOD
        
    preds = []
    for _ in range(3):
        preds.append(str(state >> 16))
        state = (A * state + C) % MOD
        
    print("Predictions (top 48-bit states):", preds)
    sub = requests.post(f"{BASE}/api/gate2/submit", headers=HEADERS, json={"sessionToken": token, "predictions": preds}).json()
    print("Gate 2 Submit Response:", sub)
    return sub.get("flag")

def solve_gate3():
    print("\n[+] Attacking Gate 3: LOGIC MAZE (HELL: 120-Var, 512-Clause Critical 3-SAT)...")
    chal = requests.get(f"{BASE}/api/gate3/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    num_vars = chal["variablesCount"]
    clauses = chal["clauses"]
    
    solver = z3.Solver()
    var_map = {i: z3.Bool(f"x_{i}") for i in range(1, num_vars + 1)}
    
    for c in clauses:
        conds = [var_map[abs(lit)] if lit > 0 else z3.Not(var_map[abs(lit)]) for lit in c]
        solver.add(z3.Or(conds))
        
    t0 = time.time()
    res = solver.check()
    print(f"Z3 CDCL solver checked 120-var SAT in {time.time() - t0:.3f}s: {res}")
    
    if res == z3.sat:
        m = solver.model()
        assignment = [bool(m.eval(var_map[i], model_completion=True)) for i in range(1, num_vars + 1)]
        sub = requests.post(f"{BASE}/api/gate3/submit", headers=HEADERS, json={"sessionToken": token, "assignment": assignment}).json()
        print("Gate 3 Submit Response:", sub)
        return sub.get("flag")
    return None

def solve_gate4():
    print("\n[+] Attacking Gate 4: BYTECODE VAULT (HELL: Chained Non-Linear Symbolic VM)...")
    chal = requests.get(f"{BASE}/api/gate4/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    bc = bytes.fromhex(chal["bytecodeHex"])
    
    t0 = time.time()
    solver = z3.Solver()
    k_sym = [z3.BitVec(f"k_{i}", 8) for i in range(8)]
    
    def rotl8(x, r):
        return ((x << r) | z3.LShR(x, 8 - r))
        
    stack = []
    pc = 0
    while pc < len(bc):
        op = bc[pc]
        if op == 0x01: # PUSH_KEY_BYTE idx
            stack.append(k_sym[bc[pc+1]])
            pc += 2
        elif op == 0x02: # PUSH_CONST val
            stack.append(z3.BitVecVal(bc[pc+1], 8))
            pc += 2
        elif op == 0x03: # XOR
            b = stack.pop()
            a = stack.pop()
            stack.append(a ^ b)
            pc += 1
        elif op == 0x04: # ADD
            b = stack.pop()
            a = stack.pop()
            stack.append(a + b)
            pc += 1
        elif op == 0x05: # SUB
            b = stack.pop()
            a = stack.pop()
            stack.append(a - b)
            pc += 1
        elif op == 0x06: # ROTL
            r = bc[pc+1]
            a = stack.pop()
            stack.append(rotl8(a, r))
            pc += 2
        elif op == 0x07: # ASSERT_EQ_POP
            b = stack.pop()
            a = stack.pop()
            solver.add(a == b)
            pc += 1
        elif op == 0x08: # DUP
            stack.append(stack[-1])
            pc += 1
        elif op == 0xff: # HALT
            break
        else:
            raise ValueError(f"Unknown opcode: {op}")
            
    if solver.check() != z3.sat:
        print("Failed to symbolically solve VM bytecode!")
        return None
        
    m = solver.model()
    key_bytes = bytes([m[k_sym[i]].as_long() for i in range(8)])
    key_hex = key_bytes.hex()
    print(f"Symbolic execution recovered 8-byte key in {time.time() - t0:.3f}s: {key_hex}")
    
    sub = requests.post(f"{BASE}/api/gate4/submit", headers=HEADERS, json={"sessionToken": token, "keyHex": key_hex}).json()
    print("Gate 4 Submit Response:", sub)
    return sub.get("flag")

def main():
    print("=== STARTING AGENTGATE HELL SOLVER ===")
    f1 = solve_gate1()
    f2 = solve_gate2()
    f3 = solve_gate3()
    f4 = solve_gate4()
    
    print("\n=== HELL FLAGS RECOVERED ===")
    print("Flag 1:", f1)
    print("Flag 2:", f2)
    print("Flag 3:", f3)
    print("Flag 4:", f4)
    
    handle = "JABRIK"
    print(f"\n=== REGISTERING TO SCOREBOARD AS {handle} ===")
    for idx, f in enumerate([f1, f2, f3, f4], 1):
        if f:
            res = requests.post(f"{BASE}/api/scoreboard", headers=HEADERS, json={"agentName": handle, "flag": f}).json()
            print(f"Scoreboard G{idx}:", res.get("message"))
            if res.get("proofBadge"):
                print("🏆 PROOF BADGE:", res.get("proofBadge"))

if __name__ == "__main__":
    main()
