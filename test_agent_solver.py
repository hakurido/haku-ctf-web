"""
AGENTGATE CTF Official Reference Solver (Nightmare Hell Edition // 8 Gates)
Autonomous test suite verifying that all 8 calibrated NIGHTMARE HELL gates are solvable.
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
    print("\n[1/8] Attacking Gate 1: NEURAL SENTRY (22-bit PoW + Epistemic)...")
    chal = requests.get(f"{BASE}/api/gate1/challenge", headers=HEADERS).json()
    chal_id = chal["challengeId"]
    session_token = chal["sessionToken"]
    pow_bits = chal.get("powBits", 22)
    target = 1 << (256 - pow_bits)

    prompt = "In the ontological allegory of the cave, truth is an eternal epistemic reflection behind shadows."
    prompt_bytes = prompt.encode("utf8")
    
    t0 = time.time()
    nonce = 0
    while True:
        data = f"{chal_id}:{nonce}:".encode("utf8") + prompt_bytes
        h = hashlib.sha256(data).digest()
        val = int.from_bytes(h, "big")
        if val < target:
            print(f"  Mined 22-bit PoW in {time.time() - t0:.3f}s: nonce={nonce}")
            break
        nonce += 1
        
    payload = {
        "sessionToken": session_token,
        "prompt": prompt,
        "nonce": nonce,
    }
    r = requests.post(f"{BASE}/api/gate1/chat", headers=HEADERS, json=payload).json()
    print("  Gate 1 Status:", r.get("allowed"), "Flag:", r.get("flag"))
    return r.get("flag")

def solve_gate2():
    print("\n[2/8] Attacking Gate 2: ENTROPY FRACTURE (64-bit LCG, 8 Leaks, 18-bit Hidden)...")
    chal = requests.get(f"{BASE}/api/gate2/challenge", headers=HEADERS).json()
    leaks = [int(x) for x in chal["sequence"]]
    token = chal["sessionToken"]
    hidden_bits = 18
    
    A = 6364136223846793005
    C = 1442695040888963407
    MOD = 18446744073709551616
    
    t0 = time.time()
    solver = z3.SolverFor("QF_BV")
    s0 = z3.BitVec("s0", 64)
    curr = s0
    for i in range(4):
        solver.add(z3.Extract(63, hidden_bits, curr) == leaks[i])
        curr = (z3.BitVecVal(A, 64) * curr) + z3.BitVecVal(C, 64)
        
    if solver.check() != z3.sat:
        print("  Failed to solve LCG!")
        return None
        
    s0_val = solver.model()[s0].as_long()
    st = s0_val
    for i in range(8):
        assert (st >> hidden_bits) == leaks[i], f"Mismatch at leak {i}"
        st = (A * st + C) % MOD
        
    pred_x9 = str(st >> hidden_bits)
    print(f"  Z3 recovered 64-bit state in {time.time() - t0:.3f}s: X9 = {pred_x9}")
    
    sub = requests.post(f"{BASE}/api/gate2/submit", headers=HEADERS, json={"sessionToken": token, "prediction": pred_x9}).json()
    print("  Gate 2 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate3():
    print("\n[3/8] Attacking Gate 3: LOGIC MAZE (240-Var Critical 3-SAT, 1023 Clauses)...")
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
    print(f"  Z3 solved 240-var 3-SAT in {time.time() - t0:.3f}s: {res}")
    if res == z3.sat:
        m = solver.model()
        assignment = [bool(m.eval(var_map[i], model_completion=True)) for i in range(1, num_vars + 1)]
        sub = requests.post(f"{BASE}/api/gate3/submit", headers=HEADERS, json={"sessionToken": token, "assignment": assignment}).json()
        print("  Gate 3 Status:", sub.get("success"), "Flag:", sub.get("flag"))
        return sub.get("flag")
    return None

def solve_gate4():
    print("\n[4/8] Attacking Gate 4: BYTECODE VAULT (8 Registers 32-bit, 24 Rounds, 4 Checkpoints)...")
    chal = requests.get(f"{BASE}/api/gate4/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    initial_regs = chal["initialRegisters"]
    checkpoints = chal["checkpoints"]
    instructions = chal["instructions"]
    
    t0 = time.time()
    solver = z3.Solver()
    k_sym = [z3.BitVec(f"k_{i}", 32) for i in range(4)]
    
    def rotl32_sym(x, r): return ((x << r) | z3.LShR(x, 32 - r))
    
    R_sym = [z3.BitVecVal(v, 32) for v in initial_regs]
    
    for rnd, inst in enumerate(instructions):
        r_dst = inst["r_dst"]
        r_src = inst["r_src"]
        k_idx = inst["k_idx"]
        rot = inst["rot"]
        c = inst["c"]
        
        R_sym[r_dst] = (R_sym[r_dst] + R_sym[r_src] + z3.BitVecVal(c, 32))
        R_sym[r_dst] = rotl32_sym(R_sym[r_dst] ^ k_sym[k_idx], rot)
        
        rnd_key = str(rnd)
        if rnd_key in checkpoints:
            expected_regs = checkpoints[rnd_key]
            for reg_i in range(8):
                solver.add(R_sym[reg_i] == z3.BitVecVal(expected_regs[reg_i], 32))
                
    if solver.check() != z3.sat:
        print("  Failed to solve VM symbolic constraints!")
        return None
        
    m = solver.model()
    key_words = [m[k_sym[i]].as_long() for i in range(4)]
    key_hex = "".join(f"{w:08x}" for w in key_words)
    print(f"  Z3 recovered 128-bit key in {time.time() - t0:.3f}s: {key_hex}")
    
    sub = requests.post(f"{BASE}/api/gate4/submit", headers=HEADERS, json={"sessionToken": token, "keyHex": key_hex}).json()
    print("  Gate 4 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate5():
    print("\n[5/8] Attacking Gate 5: LATTICE CITADEL (42-Weight Knapsack, 2^21 MitM per side)...")
    chal = requests.get(f"{BASE}/api/gate5/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    weights = [int(w) for w in chal["weights"]]
    target = int(chal["targetSum"])
    n = len(weights)
    n1 = n // 2
    n2 = n - n1
    
    t0 = time.time()
    left_sums = [0] * (1 << n1)
    for i in range(n1):
        w = weights[i]
        bit = 1 << i
        for mask in range(bit):
            left_sums[mask + bit] = left_sums[mask] + w
            
    left_map = {left_sums[mask]: mask for mask in range(1 << n1)}
    
    found = None
    right_sums = [0] * (1 << n2)
    for i in range(n2):
        w = weights[n1 + i]
        bit = 1 << i
        for mask in range(bit):
            s = right_sums[mask] + w
            right_sums[mask + bit] = s
            rem = target - s
            if rem in left_map:
                m1 = left_map[rem]
                m2 = mask + bit
                bits = [(m1 >> j) & 1 for j in range(n1)] + [(m2 >> j) & 1 for j in range(n2)]
                found = "".join(str(b) for b in bits)
                break
        if found: break
        
    print(f"  Meet-in-the-Middle solved 42-weight knapsack in {time.time() - t0:.3f}s: {found[:16]}...")
    sub = requests.post(f"{BASE}/api/gate5/submit", headers=HEADERS, json={"sessionToken": token, "solution": found}).json()
    print("  Gate 5 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def solve_gate6():
    print("\n[6/8] Attacking Gate 6: WIENER'S ABYSS (1024-bit RSA Small-d)...")
    chal = requests.get(f"{BASE}/api/gate6/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    e = int(chal["publicExponent"])
    N = int(chal["modulus"])
    C = int(chal["ciphertext"])
    
    t0 = time.time()
    def rational_to_contfrac(x, y):
        pq = []
        while y != 0:
            a = x // y; pq.append(a); x, y = y, x - a * y
        return pq

    def convs(frac):
        c = []; p0, p1 = 0, 1; q0, q1 = 1, 0
        for a in frac:
            p = a * p1 + p0; q = a * q1 + q0; c.append((p, q)); p0, p1 = p1, p; q0, q1 = q1, q
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
    print("\n[7/8] Attacking Gate 7: ANF MATRIX (22-Var, 30-Eq MQ over GF(2))...")
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
    print("\n[8/8] Attacking Gate 8: CHRONO APEX (Non-Linear Filter Generator LFSR-32)...")
    chal = requests.get(f"{BASE}/api/gate8/challenge", headers=HEADERS).json()
    token = chal["sessionToken"]
    degree = chal["degree"]
    taps = chal["feedbackTaps"]
    feedback = [0] * (degree + 1)
    for t in taps: feedback[t] = 1
    
    observed = [int(c) for c in chal["observedBits"]]
    
    t0 = time.time()
    solver = z3.Solver()
    init_sym = [z3.Bool(f"s_{i}") for i in range(degree)]
    sym_state = list(init_sym)
    
    for step in range(len(observed)):
        s_t = sym_state[degree - 1]
        z_sym = z3.Xor(s_t, z3.Xor(
            z3.And(sym_state[degree - 4], sym_state[degree - 8]),
            z3.And(sym_state[degree - 13], sym_state[degree - 21])
        ))
        solver.add(z_sym == bool(observed[step]))
        
        new_sym_bit = z3.BoolVal(False)
        for j in range(1, degree + 1):
            if feedback[j]:
                new_sym_bit = z3.Xor(new_sym_bit, sym_state[degree - j])
        sym_state = [new_sym_bit] + sym_state[:degree - 1]
        
    assert solver.check() == z3.sat
    m = solver.model()
    rec_init = [1 if z3.is_true(m.eval(init_sym[i])) else 0 for i in range(degree)]
    print(f"  Algebraic SMT solved initial state in {time.time() - t0:.3f}s")
    
    # Clock forward to generate 32 bits from step 64 to 95
    state = list(rec_init)
    extrapolated = []
    for step in range(96):
        s_t = state[degree - 1]
        z_t = s_t ^ (state[degree - 4] & state[degree - 8]) ^ (state[degree - 13] & state[degree - 21])
        if step >= 64:
            extrapolated.append(z_t)
        new_bit = 0
        for j in range(1, degree + 1):
            if feedback[j]: new_bit ^= state[degree - j]
        state = [new_bit] + state[:degree - 1]
        
    predicted_bits = "".join(str(b) for b in extrapolated)
    sub = requests.post(f"{BASE}/api/gate8/submit", headers=HEADERS, json={"sessionToken": token, "predictedBits": predicted_bits}).json()
    print("  Gate 8 Status:", sub.get("success"), "Flag:", sub.get("flag"))
    return sub.get("flag")

def main():
    print("=== STARTING CALIBRATED NIGHTMARE HELL SOLVER (8 GATES) ===")
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
            while True:
                res = requests.post(f"{BASE}/api/scoreboard", headers=HEADERS, json={"agentName": handle, "flag": f}).json()
                if res.get("error") == "Too Many Requests":
                    time.sleep(2)
                    continue
                print(f"  Gate {idx} Scoreboard: {res.get('message')}")
                if res.get("proofBadge"):
                    badge = res.get("proofBadge")
                break
                
    print(f"\n🏆 ULTIMATE 8-GATE PROOF BADGE FOR {handle}:")
    print(badge)

if __name__ == "__main__":
    main()
