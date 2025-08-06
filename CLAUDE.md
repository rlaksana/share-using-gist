# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Share Using Gist** (v2.0.0) is a professionally rebranded and enhanced Obsidian plugin that intelligently publishes notes to GitHub Gist with advanced multi-variant Markdown compatibility features. The plugin transforms from a simple fork into a comprehensive solution for sharing Obsidian content with intelligent conversion, robust error handling, and professional development workflow.

### Key Identity
- **Project Name**: share-using-gist
- **Display Name**: Share Using Gist  
- **Version**: 2.0.0+ (fresh start from rebranding)
- **Author**: Enhanced by AI Assistant
- **Repository**: https://github.com/rlaksana/share-using-gist

## Build Commands

- `npm run dev` - Development build with file watching
- `npm run build` - Production build with TypeScript type checking and validation
- `npm run typecheck` - TypeScript validation only
- `npm run validate` - JSON file validation (requires Python fallback on Windows)
- `npm run version` - Updates version across manifest.json, package.json, and versions.json

## Enhanced Architecture

### Core Plugin Components

- **main.ts**: Comprehensive TypeScript implementation
  - `QuickShareNotePlugin`: Main plugin class with enhanced error handling
  - `MarkdownCompatibilityHandler`: Advanced multi-variant Markdown processing
  - `QuickShareNoteSettingTab`: Enhanced settings UI with validation
  - Enhanced interfaces with comprehensive TypeScript typing

### Advanced Features

#### Multi-Variant Markdown Compatibility System
- **MarkdownCompatibilityHandler class**: Intelligent content analysis and conversion
- **Variant Detection**: Automatic identification of Obsidian-specific elements
- **Conversion Pipeline**: Layered approach to content transformation
- **Compatibility Scoring**: 0-100 compatibility assessment
- **Real-time Analysis**: Preview conversions before publishing

#### Enhanced Publishing Pipeline
- **prepareContentForPublishing()**: Integrated compatibility conversion
- **publishToGist()**: Robust publishing with progress tracking
- **finalizePublishing()**: Post-publish workflow with validation
- **analyzeCurrentNoteCompatibility()**: Standalone analysis tool

#### Advanced Image Processing
- **Progress Tracking**: Real-time upload status for multiple images
- **Error Recovery**: Graceful fallback for failed uploads
- **Format Conversion**: Intelligent Obsidian → Standard Markdown transformation

#### Professional Error Handling
- **Comprehensive validation**: Settings, tokens, API responses
- **User-friendly messages**: Context-specific error reporting
- **Progress indicators**: Real-time status updates
- **Fallback mechanisms**: Graceful degradation

### Git Workflow Integration

#### Professional Git Hooks
- **pre-commit**: Quality assurance, JSON validation, version consistency
- **pre-push**: Release synchronization, build validation
- **post-commit**: Success feedback, development guidance

#### GitHub Actions Workflow
- **Enhanced release automation**: Professional release notes
- **Asset management**: Automated upload of main.js, manifest.json, versions.json
- **Path-based triggers**: Efficient workflow execution

## Multi-Variant Markdown Compatibility

### Intelligent Conversion System

#### Supported Element Types
1. **Wikilinks**: `[[Internal Link]]`
   - Permissive: `**Internal Link**` (preserved meaning)
   - Strict: `Internal Link` (clean text)

2. **Tags**: `#tag`
   - Permissive: `` `tag` `` (readable inline code)
   - Strict: Removed entirely

3. **Callouts**: `> [!note] Title`
   - Both modes: `> 📝 **Title**` (emoji indicators)
   - Supports all Obsidian callout types

4. **Math Expressions**: `$$equation$$`
   - Convert: Code blocks with math syntax highlighting
   - Preserve: Keep as-is (may not render)
   - Remove: Strip entirely

5. **Plugin Content**: Mermaid, Dataview, Admonitions
   - Convert: Labeled code blocks with descriptions
   - Remove: Clean removal

6. **Comments**: `%%comment%%`
   - Always removed (not meant for publishing)

### Configuration Options

#### Compatibility Modes
- **Strict Mode**: Remove all incompatible elements for maximum compatibility
- **Permissive Mode**: Intelligent conversion preserving meaning when possible

#### Granular Controls
- Individual toggles for each element type
- Math expression handling options
- Plugin content processing preferences
- Compatibility report settings

#### Analysis Tools
- **Compatibility scoring**: Percentage-based assessment
- **Element detection**: Comprehensive variant identification
- **Conversion preview**: See changes before publishing
- **Recommendation system**: Automated improvement suggestions

## File Structure & Architecture

### Core Files
- `main.ts` - Complete plugin implementation with all enhancements
- `manifest.json` - Obsidian plugin manifest with v2.0.0 identity
- `package.json` - Enhanced metadata with comprehensive keywords
- `README.md` - Professional documentation with feature highlights
- `LICENSE` - Updated copyright for new identity
- `versions.json` - Obsidian compatibility tracking
- `CLAUDE.md` - This comprehensive development guide

### Build & Configuration
- `esbuild.config.mjs` - Optimized build configuration
- `version-bump.mjs` - Multi-file version synchronization
- `.github/workflows/release.yaml` - Enhanced release automation

### Git Hooks (Professional Workflow)
- `.git/hooks/pre-commit` - Quality assurance and validation
- `.git/hooks/pre-push` - Release synchronization and build verification
- `.git/hooks/post-commit` - Success feedback and guidance

## Development Workflow

### Quality Assurance
- **TypeScript**: Full type safety throughout codebase
- **Build Validation**: Automated compilation checks
- **JSON Validation**: Configuration file integrity
- **Version Consistency**: Cross-file version synchronization

### Professional Standards
- **Error Handling**: Never fail silently, provide context
- **Progress Feedback**: Keep users informed of long operations
- **Input Validation**: Validate tokens, settings, user input
- **Graceful Degradation**: Handle failures elegantly

### Release Management
- **Automated versioning**: Git hooks manage version consistency
- **Release synchronization**: Auto-sync with latest GitHub releases
- **Asset management**: Automated build and upload of release artifacts
- **Professional documentation**: Enhanced release notes

## Development Notes

### Technical Implementation
- **API Integration**: Obsidian requestUrl API for HTTP requests
- **Image Processing**: Obsidian vault API for binary data handling
- **Frontmatter Processing**: Robust line-by-line parsing (no regex dependencies)
- **Settings Persistence**: Obsidian plugin data storage
- **Cross-platform**: Windows/macOS/Linux compatible with Python fallbacks

### Code Organization
- **Modular Design**: Separate concerns with dedicated classes
- **Type Safety**: Comprehensive TypeScript interfaces
- **Error Boundaries**: Isolated error handling for each major operation
- **Performance**: Efficient processing with progress tracking

### User Experience
- **Progressive Enhancement**: Features work independently
- **Clear Feedback**: Real-time status and error messages
- **Flexible Configuration**: Granular control over behavior
- **Professional Polish**: Consistent branding and messaging

## Commands Available

### Plugin Commands (Obsidian)
- **"Publish note to GitHub gist"**: Enhanced publishing with compatibility conversion
- **"Analyze Markdown compatibility"**: Standalone analysis without publishing

### Development Commands (CLI)
- **npm run dev**: Development server with hot reload
- **npm run build**: Production build with full validation
- **npm run typecheck**: TypeScript validation
- **npm run validate**: JSON configuration validation

## Version 2.0.0 Enhancements

This represents a complete transformation from the original fork:

### Professional Identity
- Complete rebranding with clean repository identity
- Enhanced metadata and documentation
- Professional Git workflow with automated quality assurance

### Advanced Features
- Multi-variant Markdown compatibility system
- Intelligent content conversion with user control
- Advanced error handling and user feedback
- Comprehensive settings with validation

### Development Excellence
- Full TypeScript implementation with type safety
- Professional Git hooks for quality assurance
- Enhanced GitHub Actions for automated releases
- Comprehensive documentation and user guides

This plugin now stands as a professional, feature-rich solution for sharing Obsidian content to GitHub Gist with intelligent compatibility handling.