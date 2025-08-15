# 🚀 Share Using Gist - Developer Workflow

## Quick Update Workflow

Untuk setiap update/fix/feature baru:

```bash
# 1. Auto-increment version dan build
npm run auto-version

# 2. Commit dan push 
git add -A
git commit -m "your message here"
git push
```

**✅ That's it!** GitHub Actions akan otomatis:
- Create new release dengan version baru
- Upload main.js, manifest.json, versions.json
- Update Obsidian plugin manager compatibility

## Commands Available

```bash
npm run auto-version    # Auto-increment patch version + build
npm run dev            # Development build dengan watching
npm run build          # Production build dengan validation
npm run typecheck      # TypeScript validation only
```

## Version Management

- **Auto-increment**: Setiap `npm run auto-version` naik patch version
- **Manual**: Edit package.json jika perlu major/minor version
- **Obsidian Sync**: versions.json otomatis update untuk compatibility

## Current Features (v2.0.6)

### ✅ Mermaid Auto-Fix
- Deteksi dan fix Mermaid diagrams yang missing `mermaid` identifier
- Enable GitHub Gist native rendering
- Zero data loss, pure conversion

### ✅ GitHub Native Mode  
- Default setting: preserve GitHub native features
- Math expressions, Mermaid, GitHub Alerts work natively
- Only convert Obsidian-specific elements

### ✅ Multi-Variant Compatibility
- Wikilinks → standard markdown links
- Tags → readable text formats
- Comments → HTML comments (preserved)
- Dataview → descriptive code blocks

### ✅ Enhanced Error Handling
- Comprehensive validation
- Progress tracking for long operations
- User-friendly error messages
- Graceful fallback mechanisms

## Test Results

- **Original Broken**: https://gist.github.com/rlaksana/83f7efe727a83cbe851fe57ab4eb4c22 ❌
- **Auto-Fixed**: https://gist.github.com/rlaksana/111af0bbabb91bb911d7b2bf6933b476 ✅  
- **Perfect Format**: https://gist.github.com/rlaksana/c7fb2555b53d77aba0f5288814d7d5c2 ✅

**Result**: Interactive Mermaid diagrams dengan zoom/pan controls!