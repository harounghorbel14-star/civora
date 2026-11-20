#!/usr/bin/env python3
"""Builds a kustomize overlay from an Argo CD Application's `source.kustomize.patches` and one upstream manifest,
so validate-manifests.sh checks exactly what Argo CD would deploy. Usage: app.yaml upstream.yml out-dir"""
import os, shutil, sys
import yaml

app_path, manifest, out = sys.argv[1:4]
app = yaml.safe_load(open(app_path))
patches = app["spec"]["source"].get("kustomize", {}).get("patches", [])
if not patches:
    sys.exit(f"{app_path}: no kustomize patches")
os.makedirs(out, exist_ok=True)
shutil.copy(manifest, os.path.join(out, "upstream.yml"))
with open(os.path.join(out, "kustomization.yaml"), "w") as f:
    yaml.safe_dump({"apiVersion": "kustomize.config.k8s.io/v1beta1", "kind": "Kustomization",
                    "resources": ["upstream.yml"], "patches": patches}, f, sort_keys=False)
print(f"overlay with {len(patches)} patch(es) written to {out}")
