# Como publicar uma versão nova

1. **Gere os arquivos da versão** (versão em `GrandTrackerAuto/version.json` e `GrandTrackerAuto/CSXS/manifest.xml`, notas em `GrandTrackerAuto/CHANGELOG.md`, zip com `python tools/build_release.py`).
2. **Suba os arquivos no GitHub pelo site:**
   - Extraia o zip de arquivos do repositório e entre na pasta.
   - No repositório: **Add file → Upload files**.
   - Selecione tudo (**Ctrl + A**), arraste para a página e clique em **Commit changes**.
3. **Crie a release:**
   - **Releases → Draft a new release**.
   - **Choose a tag** → digite `vX.Y.Z` (com "v", igual à versão) → **Create new tag**.
   - **Título:** `vX.Y.Z`.
   - Arraste o `GrandTrackerAuto-vX.Y.Z.zip` para **Attach binaries**.
   - Cole a descrição da versão e clique em **Publish release**.
4. **Teste:** abra o Premiere, clique em **Atualizar** e depois em **Reiniciar o Premiere agora**.

Os painéis instalados verificam `releases/latest` ao abrir e oferecem a atualização.
O atualizador usa o primeiro arquivo `.zip` anexado à release.
