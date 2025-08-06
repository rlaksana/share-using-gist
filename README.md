# Share Using Gist - Obsidian Plugin

**Share Using Gist** is an enhanced Obsidian plugin that intelligently shares your notes to GitHub Gist with advanced multi-variant Markdown compatibility features. ✨

![GitHub Release](https://img.shields.io/github/v/release/your-username/share-using-gist)
![GitHub Downloads](https://img.shields.io/github/downloads/your-username/share-using-gist/total)
![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-blueviolet)

## 🚀 Enhanced Features

### 🎯 **Multi-Variant Markdown Compatibility**
Unlike basic sharing plugins, **Share Using Gist** intelligently handles different Markdown variants:

- **Wikilinks**: `[[Internal Link]]` → `**Internal Link**` (preserved meaning)
- **Tags**: `#tag` → `` `tag` `` (readable format)  
- **Callouts**: `> [!note] Title` → `> 📝 **Title**` (with emoji indicators)
- **Math Expressions**: `$$equation$$` → properly formatted code blocks
- **Plugin Content**: Mermaid diagrams, Dataview queries → labeled code blocks
- **Comments**: `%%hidden%%` → automatically removed

### 📊 **Intelligent Analysis System**
- **Compatibility Score**: Get a 0-100 score for Gist compatibility
- **Real-time Analysis**: Use "Analyze Markdown compatibility" command
- **Detailed Reports**: See exactly what will be converted
- **Preview Mode**: Know what changes before publishing

### 🖼️ **Advanced Image Handling**
- **Progress Tracking**: See upload progress for multiple images
- **Fallback Protection**: Graceful handling of failed uploads  
- **Format Conversion**: `![[image.png]]` → `![Uploaded Image](imgur-url)`
- **Error Recovery**: Clear notifications if uploads fail

### ⚙️ **Flexible Configuration**
- **Compatibility Modes**: 
  - **Strict**: Remove incompatible elements
  - **Permissive**: Convert when possible (recommended)
- **Granular Control**: Toggle each conversion type individually
- **Math Handling**: Remove/Convert/Preserve options
- **Report Settings**: Optional conversion notifications

### 🔧 **Developer Features**
- **Robust Error Handling**: Never fails silently
- **Progress Indicators**: Real-time publishing status
- **Input Validation**: Token format validation with visual feedback
- **Type Safety**: Full TypeScript implementation

## 📥 Installation

### From Obsidian Community Plugins
1. Open **Settings** → **Community plugins** → **Browse**
2. Search for "**Share Using Gist**"
3. **Install** and **Enable** the plugin

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/your-username/share-using-gist/releases)
2. Extract to `{VaultFolder}/.obsidian/plugins/share-using-gist/`
3. Reload Obsidian and enable the plugin

## ⚙️ Configuration

Navigate to **Settings** → **Share Using Gist** to configure:

### Required Settings
- **GitHub Token**: Personal access token with `gist` scope
  - [Create token here](https://github.com/settings/tokens/new?scopes=gist&description=Share%20Using%20Gist)
  - Supports both classic tokens and fine-grained tokens
- **Imgur Client ID**: For image uploads
  - [Register app here](https://api.imgur.com/oauth2/addclient)

### Compatibility Settings
- **Compatibility Mode**: Choose conversion strategy
- **Element Conversion**: Toggle wikilinks, tags, callouts individually  
- **Math Handling**: Decide how to handle LaTeX expressions
- **Plugin Content**: Convert or remove Mermaid/Dataview content
- **Reports**: Enable/disable conversion notifications

## 🎯 Usage

### Basic Sharing
1. Open any note in Obsidian
2. Use **Ctrl/Cmd + P** → "**Publish note to GitHub gist**"
3. Watch the progress indicators
4. Get the gist URL automatically copied to clipboard

### Compatibility Analysis  
1. Open any note in Obsidian
2. Use **Ctrl/Cmd + P** → "**Analyze Markdown compatibility**"
3. Get detailed compatibility report
4. See conversion recommendations

### Understanding the Process
1. **Analysis**: Plugin detects Obsidian-specific elements
2. **Conversion**: Elements converted based on your settings
3. **Image Upload**: Images uploaded to Imgur with progress tracking
4. **Publishing**: Content published to GitHub Gist
5. **Finalization**: URL copied and frontmatter updated

## 🌟 What's New in v2.0

### Major Enhancements
- ✨ **Multi-Variant Markdown System**: Handle any Markdown variant intelligently
- 🎯 **Compatibility Analysis**: Know compatibility before publishing
- 📊 **Advanced Callouts**: Support for all Obsidian callout types with emoji
- 🔧 **Granular Controls**: Individual toggles for every conversion type
- 🚀 **Enhanced UX**: Progress tracking, better error messages
- 🛡️ **Robust Validation**: Input validation with visual feedback

### Technical Improvements
- 🏗️ **Refactored Architecture**: Modular, maintainable code
- 📝 **TypeScript**: Full type safety and better IDE support
- 🧪 **Comprehensive Testing**: Build validation and error handling
- 📚 **Better Documentation**: Clear code documentation and user guides

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and:

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper TypeScript typing
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the amazing [Obsidian](https://obsidian.md) community
- Enhanced and evolved from community feedback
- Powered by [GitHub Gist API](https://docs.github.com/en/rest/gists) and [Imgur API](https://apidocs.imgur.com)

---

**Made with ❤️ for the Obsidian community**

[⭐ Star on GitHub](https://github.com/your-username/share-using-gist) | [🐛 Report Bug](https://github.com/your-username/share-using-gist/issues) | [💡 Feature Request](https://github.com/your-username/share-using-gist/issues)