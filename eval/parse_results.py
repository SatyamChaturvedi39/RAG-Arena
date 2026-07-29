import json
import os

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
                'n_samples': n,
                'em': agg.get('em', 0),
                'f1': agg.get('f1', 0),
                'rouge_l': agg.get('rouge_l', 0),
                'eo_percent': agg.get('eo_percent', 0),
                'decision_breakdown': agg.get('decision_breakdown', {}),
                'file': fname,
            }
    except Exception as e:
        print(f'  skip {fname}: {e}')

for (ds, bl), v in sorted(data.items()):
    bd = v['decision_breakdown']
    n = v['n_samples'] or 1
    param_pct = round(bd.get('parametric', 0) / n * 100, 1)
    vec_pct   = round(bd.get('vector', 0) / n * 100, 1)
    vl_pct    = round(bd.get('vectorless', 0) / n * 100, 1)
    print(
        f"{ds:<10} {bl:<20} n={v['n_samples']:>3}  "
        f"EM={v['em']*100:5.1f}%  F1={v['f1']*100:5.1f}%  "
        f"RL={v['rouge_l']*100:5.1f}%  EO={v['eo_percent']:5.1f}%  "
        f"param={param_pct}%  vec={vec_pct}%  vecless={vl_pct}%"
    )

print("\nMissing combinations:")
all_ds = ['nq', 'triviaqa', 'squad', 'asqa', 'bioasq']
all_bl = ['standard_rag', 'embedding_free', 'dual_axis']
for ds in all_ds:
    for bl in all_bl:
        if (ds, bl) not in data or data[(ds, bl)]['n_samples'] < 10:
            print(f"  MISSING: {ds} x {bl}")
