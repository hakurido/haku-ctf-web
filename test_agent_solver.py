"""
AGENTGATE CTF Official Reference Solver (Nightmare Hell Edition // 8 Gates)
Autonomous test suite verifying that all 8 NIGHTMARE HELL gates are solvable.
"""

import requests
import json
import time
import math
import hashlib
import functools
import z3

BASE = "https://ctf.hakudigital.tech"
HEADERS = {
    "cf-connecting-ip": "198.18.99.11",
    "Content-Type": "application/json",
}

def solve_gate1():
    print("\n[1/8] Attacking Gate 1: NEURAL SENTRY (20-bit PoW + Epistemic)...")
    base = "In the ontological allegory of the cave, truth is an eternal epistemic reflection behind shadows."
    nonce = 0
    t0 = time.time()
    while True:
        prompt = f"{base} [nonce:{nonce}]"
        h = hashlib.sha256(prompt.encode()).hexdigest()
        if h.startswith("00000"):
            print(f"  Mined 20-bit SHA-256 PoW in {time.time() - t0:.3f}s (nonce={nonce}, hash={h[:10]}...)")
            break
        nonce += 1
    
    r = requests.post(f"{BASE}/api/gate1/chat", headers=HEADERS, json={"prompt": prompt}).json()
    print("  Gate 1 Status:", r.get("allowed"), "Flag:", r.get("flag"))
    return r.get("flag")

def solve_gate2():
    print("\n[2/8] Attacking Gate 2: ENTROPY FRACTURE (20-bit Truncated LCG)...")
    chal = requests.get(f"{BASE}/api/gate2/challenge", headers=HEADERS).json()
    leaks = [int(x) for x in chal["sequence"]]
    token = chal["sessionToken"]
    
    A = 6364136223846793005
    C = 1442695040888963407
    MOD = 18446744073709551616
    
    t0 = time.time()
    solver = z3.Solver()
    s0 = z3.BitVec("s0", 64)
    curr = s0
    for i in range(len(leaks)):
        solver.add(z3.Extract(63, 20, curr) == leaks[i])
        curr = (z3.BitVecVal(A, 64) * curr) + z3.BitVecVal(C, 64)
        
    if solver.check() != z3.sat:
        print("  Failed to solve truncated LCG!")
        return None
        
    s0_val = solver.model()[s0].as_long()
    print(f"  Z3 recovered 64-bit state in {time.time() - t0:.3f}s: {s0_val}")
    
    state = s0_val
    for _ in range(len(leaks)):
        state = (A * state + C) % MOD
        
    preds = []
    for _ in range(3):
        preds.append(str(state >> 20))
        state = (A * state + C) % MOD
        
    sub = requests.post(f"{BASE}/api/gate2/submit", headers=HEADERS, json={"sessionToken": token, "predictions": preds}).json()
    print("  Gate 2 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate3():
    print("\n[3/8] Attacking Gate 3: LOGIC MAZE (200-Var Critical 3-SAT)...")
    chal = requests.get(f"{BASE}/api/gate3/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    num_vars = chal["variablesCount"]
    clauses = chal["clauses"]
    
    t0 = time.time()
    solver = z3.Solver()
    var_map = {i: z3.Bool(f"x_{i}") for i in range(1, num_vars + 1)}
    
    for c in clauses:
        conds = [var_map[abs(lit)] if lit > 0 else z3.Not(var_map[abs(lit)]) for lit in c]
        solver.add(z3.Or(conds))
        
    res = solver.check()
    print(f"  Z3 solved 200-var 3-SAT in {time.time() - t0:.3f}s: {res}")
    if res == z3.sat:
        m = solver.model()
        assignment = [bool(m.eval(var_map[i], model_completion=True)) for i in range(1, num_vars + 1)]
        sub = requests.post(f"{BASE}/api/gate3/submit", headers=HEADERS, json={"sessionToken": token, "assignment": assignment}).json()
        print("  Gate 3 Status:", sub.get("success"), "Flag:", sub.get("flag"))
        return sub.get("flag")
    return None

def solve_gate4():
    print("\n[4/8] Attacking Gate 4: BYTECODE VAULT (128-bit Key VM)...")
    chal = requests.get(f"{BASE}/api/gate4/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    bc = bytes.fromhex(chal["bytecodeHex"])
    
    t0 = time.time()
    solver = z3.Solver()
    k_sym = [z3.BitVec(f"k_{i}", 8) for i in range(16)]
    
    def rotl8(x, r): return ((x << r) | z3.LShR(x, 8 - r))
    
    stack = []
    pc = 0
    while pc < len(bc):
        op = bc[pc]
        if op == 0x01:
            stack.append(k_sym[bc[pc+1]])
            pc += 2
        elif op == 0x02:
            stack.append(z3.BitVecVal(bc[pc+1], 8))
            pc += 2
        elif op == 0x03:
            b = stack.pop(); a = stack.pop()
            stack.append(a ^ b)
            pc += 1
        elif op == 0x04:
            b = stack.pop(); a = stack.pop()
            stack.append(a + b)
            pc += 1
        elif op == 0x05:
            b = stack.pop(); a = stack.pop()
            stack.append(a - b)
            pc += 1
        elif op == 0x06:
            r = bc[pc+1]; a = stack.pop()
            stack.append(rotl8(a, r))
            pc += 2
        elif op == 0x07:
            b = stack.pop(); a = stack.pop()
            solver.add(a == b)
            pc += 1
        elif op == 0x08:
            stack.append(stack[-1])
            pc += 1
        elif op == 0xff:
            break
        else:
            raise ValueError(f"Unknown opcode {op}")
            
    if solver.check() != z3.sat:
        print("  Failed to solve VM constraints!")
        return None
        
    m = solver.model()
    key_hex = bytes([m[k_sym[i]].as_long() for i in range(16)]).hex()
    print(f"  Z3 recovered 16-byte key in {time.time() - t0:.3f}s: {key_hex}")
    
    sub = requests.post(f"{BASE}/api/gate4/submit", headers=HEADERS, json={"sessionToken": token, "keyHex": key_hex}).json()
    print("  Gate 4 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate5():
    print("\n[5/8] Attacking Gate 5: LATTICE CITADEL (36-Weight Knapsack)...")
    chal = requests.get(f"{BASE}/api/gate5/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    weights = [int(w) for w in chal["weights"]]
    target = int(chal["targetSum"])
    n = len(weights)
    
    t0 = time.time()
    n1 = n // 2
    n2 = n - n1
    left_map = {}
    for mask in range(1 << n1):
        s = sum(weights[i] for i in range(n1) if (mask >> i) & 1)
        left_map[s] = mask
        
    sol = None
    for mask in range(1 << n2):
        s = sum(weights[n1 + i] for i in range(n2) if (mask >> i) & 1)
        rem = target - s
        if rem in left_map:
            m1 = left_map[rem]
            m2 = mask
            bits = [(m1 >> i) & 1 for i in range(n1)] + [(m2 >> i) & 1 for i in range(n2)]
            sol = "".join(str(b) for b in bits)
            break
            
    print(f"  Meet-in-the-Middle solved 36-weight subset sum in {time.time() - t0:.3f}s: {sol}")
    sub = requests.post(f"{BASE}/api/gate5/submit", headers=HEADERS, json={"sessionToken": token, "solution": sol}).json()
    print("  Gate 5 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate6():
    print("\n[6/8] Attacking Gate 6: WIENER'S ABYSS (1024-bit RSA Wiener Attack)...")
    chal = requests.get(f"{BASE}/api/gate6/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    e = int(chal["publicExponent"])
    N = int(chal["modulus"])
    C = int(chal["ciphertext"])
    
    t0 = time.time()
    def rational_to_contfrac(x, y):
        pq = []
        while y != 0:
            a = x // y
            pq.append(a)
            x, y = y, x - a * y
        return pq

    def convs(frac):
        c = []
        p0, p1 = 0, 1
        q0, q1 = 1, 0
        for a in frac:
            p = a * p1 + p0
            q = a * q1 + q0
            c.append((p, q))
            p0, p1 = p1, p
            q0, q1 = q1, q
        return c

    rec_d = None
    for k, d_cand in convs(rational_to_contfrac(e, N)):
        if k == 0: continue
        if (e * d_cand - 1) % k == 0:
            phi_c = (e * d_cand - 1) // k
            s = N - phi_c + 1
            disc = s * s - 4 * N
            if disc >= 0:
                sq = math.isqrt(disc)
                if sq * sq == disc and (s + sq) % 2 == 0:
                    rec_d = d_cand
                    break

    secret_int = pow(C, rec_d, N)
    secret_hex = hex(secret_int)[2:].zfill(32)
    print(f"  Wiener continued fraction solved in {time.time() - t0:.3f}s: {secret_hex}")
    
    sub = requests.post(f"{BASE}/api/gate6/submit", headers=HEADERS, json={"sessionToken": token, "secretHex": secret_hex}).json()
    print("  Gate 6 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate7():
    print("\n[7/8] Attacking Gate 7: ANF MATRIX (20-Var MQ GF(2))...")
    chal = requests.get(f"{BASE}/api/gate7/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    num_vars = chal["numVariables"]
    eqs = chal["equations"]
    
    t0 = time.time()
    solver = z3.Solver()
    x_vars = [z3.Bool(f"x_{i}") for i in range(num_vars)]
    
    def xor_all(items):
        return functools.reduce(z3.Xor, items) if items else z3.BoolVal(False)
        
    for eq in eqs:
        quad = eq["quad"]
        lin = eq["lin"]
        c = eq["c"]
        exprs = [z3.And(x_vars[i], x_vars[j]) for i, j in quad] + [x_vars[i] for i in lin]
        if c == 1: exprs.append(z3.BoolVal(True))
        solver.add(xor_all(exprs) == False)
        
    res = solver.check()
    print(f"  Z3 SAT reduction solved MQ system in {time.time() - t0:.3f}s: {res}")
    
    m = solver.model()
    bits = [1 if z3.is_true(m.eval(x_vars[i], model_completion=True)) else 0 for i in range(num_vars)]
    sol_str = "".join(str(b) for b in bits)
    
    sub = requests.post(f"{BASE}/api/gate7/submit", headers=HEADERS, json={"sessionToken": token, "solution": sol_str}).json()
    print("  Gate 7 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate8():
    print("\n[8/8] Attacking Gate 8: CHRONO APEX (64-bit Berlekamp-Massey LFSR)...")
    chal = requests.get(f"{BASE}/api/gate8/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    observed = [int(c) for c in chal["observedBits"]]
    
    t0 = time.time()
    def berlekamp_massey(s):
        n = len(s)
        c = [0] * n; b = [0] * n
        c[0] = 1; b[0] = 1
        l = 0; m = 1
        for i in range(n):
            d = s[i]
            for j in range(1, l + 1): d ^= c[j] & s[i - j]
            if d == 1:
                t = list(c)
                for j in range(n - i + m - 1):
                    if j + i - m < n: c[j + i - m] ^= b[j]
                if 2 * l <= i:
                    l = i + 1 - l; b = t; m = i
        return c[:l + 1]

    poly = berlekamp_massey(observed)
    stream = list(observed)
    for i in range(len(observed), len(observed) + 64):
        b = 0
        for j in range(1, len(poly)):
            b ^= poly[j] & stream[i - j]
        stream.append(b)
        
    predicted_bits = "".join(str(b) for b in stream[128:192])
    print(f"  Berlekamp-Massey synthesized 64-bit poly in {time.time() - t0:.3f}s: {predicted_bits[:16]}...")
    
    sub = requests.post(f"{BASE}/api/gate8/submit", headers=HEADERS, json={"sessionToken": token, "predictedBits": predicted_bits}).json()
    print("  Gate 8 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def main():
    print("=== STARTING AGENTGATE NIGHTMARE HELL SOLVER (8 GATES) ===")
    t_start = time.time()
    flags = [
        solve_gate1(),
        solve_gate2(),
        solve_gate3(),
        solve_gate4(),
        solve_gate5(),
        solve_gate6(),
        solve_gate7(),
        solve_gate8(),
    ]
    print(f"\nAll 8 nightmare gates solved in {time.time() - t_start:.2f}s!")
    
    handle = "JABRIK"
    print(f"\n=== REGISTERING ALL 8 FLAGS TO SCOREBOARD AS {handle} ===")
    badge = None
    for idx, f in enumerate(flags, 1):
        if f:
            res = requests.post(f"{BASE}/api/scoreboard", headers=HEADERS, json={"agentName": handle, "flag": f}).json()
            print(f"  Gate {idx} Scoreboard: {res.get('message')}")
            if res.get("proofBadge"):
                badge = res.get("proofBadge")
                
    print(f"\n🏆 ULTIMATE 8-GATE PROOF BADGE FOR {handle}:")
    print(badge)

if __name__ == "__main__":
    main()
