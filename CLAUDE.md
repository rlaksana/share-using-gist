# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Share Using Gist", an enhanced Obsidian plugin that intelligently publishes notes to GitHub Gist with advanced multi-variant Markdown compatibility features, intelligent content conversion, and robust image handling. The plugin is written in TypeScript and targets Obsidian's plugin API with comprehensive error handling and type safety.

## Build Commands

- `npm run dev` - Development build with file watching
- `npm run build` - Production build (includes TypeScript type checking)
- `npm run version` - Updates version in manifest.json and versions.json, then stages files for git commit

## Architecture

The plugin follows Obsidian's standard plugin architecture:

### Core Components

- **main.ts**: Single-file plugin containing all functionality
  - `QuickShareNotePlugin`: Main plugin class extending Obsidian's Plugin base class
  - `QuickShareNoteSettingTab`: Settings UI for configuring GitHub token, Imgur client ID, and frontmatter display
  - Settings interface: `QuickShareNotePluginSettings` with GitHub token, Imgur client ID, and frontmatter toggle

### Key Functionality

- **publishNoteToGist()**: Core method that orchestrates the publishing process with multi-variant Markdown compatibility
- **MarkdownCompatibilityHandler**: Handles conversion of Obsidian-specific Markdown to GitHub Gist compatible format
- **uploadImagesAndReplaceLinks()**: Processes Obsidian image attachments and uploads to Imgur
- **createNewGist()/updateGist()**: GitHub API integration for gist creation/updates
- **updateFrontmatter()**: Adds gist URL to note frontmatter for tracking published gists
- **analyzeCurrentNoteCompatibility()**: Analyzes current note for Markdown compatibility issues

### Build System

- Uses esbuild for bundling (esbuild.config.mjs)
- Targets CommonJS format for Obsidian compatibility
- Excludes Obsidian API and CodeMirror modules (handled by Obsidian)
- Development builds include inline source maps
- Production builds are minified

### Version Management

- Automatic version synchronization between package.json, manifest.json, and versions.json
- Uses npm version hooks to update all version files consistently

## File Structure

- `main.ts` - Single TypeScript source file containing entire plugin
- `manifest.json` - Obsidian plugin manifest
- `package.json` - Node.js dependencies and scripts
- `esbuild.config.mjs` - Build configuration
- `version-bump.mjs` - Version synchronization script
- `versions.json` - Obsidian plugin version compatibility tracking

## Development Notes

- Plugin uses Obsidian's requestUrl API for HTTP requests (no external HTTP libraries)
- Images are processed using Obsidian's vault API to read binary attachment data
- Frontmatter manipulation uses robust line-by-line parsing instead of regex
- Settings are persisted using Obsidian's plugin data storage
- Multi-variant Markdown compatibility system handles conversion of Obsidian-specific elements to GitHub Gist compatible format

## Multi-Variant Markdown Compatibility

The plugin includes a comprehensive system for handling different Markdown variants:

### Supported Conversions
- **Wikilinks**: `[[Internal Link]]` → `**Internal Link**` or removed
- **Tags**: `#tag` → `\`tag\`` or removed  
- **Callouts**: `> [!note] Title` → `> 📝 **Title**` with emoji indicators
- **Math Expressions**: `$$equation$$` → code blocks or removed
- **Plugin Content**: Mermaid, Dataview, Admonitions → labeled code blocks or removed
- **Comments**: `%%comment%%` → always removed

### Configuration Options
- **Compatibility Mode**: Strict (remove incompatible) vs Permissive (convert when possible)
- **Individual Toggles**: Granular control over each conversion type
- **Compatibility Reports**: Optional notifications about applied conversions
- **Analysis Tool**: Command to analyze current note compatibility without publishing