# Como publicar uma versão nova

1. Atualize a versão em **dois lugares**:
   - `GrandTrackerAuto/version.json` → `"version": "1.0.1"`
   - `GrandTrackerAuto/CSXS/manifest.xml` → `ExtensionBundleVersion` e `Version`
2. Anote as mudanças no `CHANGELOG.md`.
3. Gere o zip: `python tools/build_release.py` → cria `dist/GrandTrackerAuto-v1.0.1.zip`.
4. Faça commit e push.
5. No GitHub: **Releases → Draft a new release**
   - **Tag:** `v1.0.1` (com "v", igual à versão)
   - **Título:** `v1.0.1`
   - Anexe o zip de `dist/` em *Attach binaries*.
   - **Publish release**.

Os painéis instalados verificam `releases/latest` ao abrir e oferecem a atualização.
O atualizador procura o primeiro arquivo `.zip` anexado à release.
