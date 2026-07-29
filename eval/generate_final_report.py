import json
import os
import glob

results_dir = 'eval/results'
files = [f for f in os.listdir(results_dir) if f.endswith('.json') and 'combined' not in f]

data = {}
for fname in sorted(files):
    path = os.path.join(results_dir, fname)
    try:
        with open(path) as f:
            d = json.load(f)
        ds = d.get('dataset')
        bl = d.get('baseline')
        agg = d.get('aggregate', {})
        n = agg.get('n_samples', 0)
        key = (ds, bl)
        if key not in data or n > data[key]['n_samples']:
            data[key] = {
                'dataset': ds,
                'baseline': bl,
                'n_samples': n,
                'em': agg.get('em', 0),
                'f1': agg.get('f1', 0),
                'rouge_l': agg.get('rouge_l', 0),
                'eo_percent': agg.get('eo_percent', 0),
                'avg_latency_ms': agg.get('avg_latency_ms', 0),
                'decision_breakdown': agg.get('decision_breakdown', {}),
                'file': fname,
            }
    except Exception as e:
        print(f'skip {fname}: {e}')

all_ds = ['nq', 'triviaqa', 'squad', 'asqa', 'bioasq']
all_bl = ['standard_rag', 'embedding_free', 'dual_axis']

missing = []
for ds in all_ds:
    for bl in all_bl:
        if (ds, bl) not in data or data[(ds, bl)]['n_samples'] < 100:
            missing.append((ds, bl))

if missing:
    print(f"STILL WAITING: Missing 100-sample results for {missing}")
else:
    print("ALL 15 (dataset, baseline) COMBINATIONS COMPLETE WITH N=100!\n")
    
    # 1. Print ASQA details
    print("=== ASQA RESULTS ===")
    for bl in all_bl:
        v = data[('asqa', bl)]
        bd = v['decision_breakdown']
        print(f"Baseline: {bl:<15} | Token F1: {v['f1']*100:.1f}% | ROUGE-L: {v['rouge_l']*100:.1f}% | Routing: param={bd.get('parametric',0)}, vector={bd.get('vector',0)}, vectorless={bd.get('vectorless',0)}")

    # 2. Print BioASQ details
    print("\n=== BIOASQ RESULTS ===")
    for bl in all_bl:
        v = data[('bioasq', bl)]
        bd = v['decision_breakdown']
        print(f"Baseline: {bl:<15} | Token F1: {v['f1']*100:.1f}% | ROUGE-L: {v['rouge_l']*100:.1f}% | Routing: param={bd.get('parametric',0)}, vector={bd.get('vector',0)}, vectorless={bd.get('vectorless',0)}")

    # 3. Print DDAR EO% for each dataset
    print("\n=== DDAR EMBEDDING OVERHEAD (EO%) ===")
    eo_list = []
    for ds in all_ds:
        v = data[(ds, 'dual_axis')]
        eo = v['eo_percent']
        eo_list.append(eo)
        print(f"Dataset: {ds:<12} | DDAR EO%: {eo:.1f}% | Reduction: {100-eo:.1f}%")
    avg_eo = sum(eo_list) / len(eo_list)
    print(f"Overall Average DDAR EO%: {avg_eo:.1f}% (Overall Reduction: {100-avg_eo:.1f}%)")

    # 4. Generate Raw CSV
    print("\n=== COMPLETE RAW CSV OUTPUT ===")
    csv_lines = ["dataset,baseline,n_samples,exact_match,token_f1,rouge_l,eo_percent,avg_latency_ms,parametric_count,vector_count,vectorless_count"]
    for ds in all_ds:
        for bl in all_bl:
            v = data[(ds, bl)]
            bd = v['decision_breakdown']
            line = f"{ds},{bl},{v['n_samples']},{v['em']*100:.2f},{v['f1']*100:.2f},{v['rouge_l']*100:.2f},{v['eo_percent']:.2f},{v['avg_latency_ms']:.2f},{bd.get('parametric',0)},{bd.get('vector',0)},{bd.get('vectorless',0)}"
            csv_lines.append(line)
    csv_content = "\n".join(csv_lines)
    print(csv_content)
    
    with open('eval/results/combined_results.csv', 'w') as f:
        f.write(csv_content)
    print("\nSaved to eval/results/combined_results.csv")
