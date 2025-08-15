import { Plugin, requestUrl, Notice, PluginSettingTab, Setting, TFile, App } from 'obsidian';

interface QuickShareNotePluginSettings {
	githubToken: string;
	imgurClientId: string;
	showFrontmatter: boolean;
	// Markdown compatibility settings
	compatibilityMode: 'github-native' | 'strict' | 'permissive';
	preserveWikilinks: boolean;
	convertTags: boolean;
	convertCallouts: boolean;
	handleMath: 'remove' | 'convert' | 'preserve';
	handlePluginContent: 'remove' | 'convert';
	// New GitHub-aware settings
	tagConversionFormat: 'inline-code' | 'bold-labels' | 'plain-text';
	commentConversionFormat: 'html-comments' | 'italic-text';
	dataviewConversionFormat: 'descriptive-blocks' | 'simple-blocks';
	showCompatibilityReport: boolean;
	// Bidirectional sync settings
	enableAutoSync: boolean;
	debounceDelay: number;
	enableAdaptiveDebounce: boolean;
	enableManualPull: boolean;
	confirmPullOverride: boolean;
	syncNotifications: 'all' | 'errors' | 'none';
	showRateLimitStatus: boolean;
	maxQueuedSyncs: number;
	emergencyDisableThreshold: number;
}

const DEFAULT_SETTINGS: QuickShareNotePluginSettings = {
	githubToken: '',
	imgurClientId: '',
	showFrontmatter: true,
	// Default to GitHub Native mode for best experience
	compatibilityMode: 'github-native',
	preserveWikilinks: false,
	convertTags: true,
	convertCallouts: false, // Let GitHub handle callouts natively
	handleMath: 'preserve', // Let GitHub handle math natively
	handlePluginContent: 'convert',
	// New conversion format defaults
	tagConversionFormat: 'inline-code',
	commentConversionFormat: 'html-comments',
	dataviewConversionFormat: 'descriptive-blocks',
	showCompatibilityReport: true,
	// Default sync settings
	enableAutoSync: false,
	debounceDelay: 1500,
	enableAdaptiveDebounce: true,
	enableManualPull: true,
	confirmPullOverride: true,
	syncNotifications: 'all',
	showRateLimitStatus: true,
	maxQueuedSyncs: 10,
	emergencyDisableThreshold: 100
};

// API endpoints
const GITHUB_API_URL = 'https://api.github.com/gists';
const IMGUR_API_URL = 'https://api.imgur.com/3/image';

// Frontmatter handling interface
interface FrontmatterData {
	frontmatter: string;
	content: string;
	hasFrontmatter: boolean;
}

// Markdown compatibility interfaces
interface ConversionResult {
	convertedContent: string;
	warnings: string[];
	removedElements: string[];
	changedElements: { original: string; converted: string; type: string; }[];
}

interface MarkdownVariant {
	name: string;
	description: string;
	detector: (content: string) => boolean;
	converter: (content: string, options?: ConversionOptions) => ConversionResult;
}

interface ConversionOptions {
	compatibilityMode: 'github-native' | 'strict' | 'permissive';
	preserveWikilinks: boolean;
	convertTags: boolean;
	convertCallouts: boolean;
	handleMath: 'remove' | 'convert' | 'preserve';
	handlePluginContent: 'remove' | 'convert';
	// New GitHub-aware settings
	tagConversionFormat?: 'inline-code' | 'bold-labels' | 'plain-text';
	commentConversionFormat?: 'html-comments' | 'italic-text';
	dataviewConversionFormat?: 'descriptive-blocks' | 'simple-blocks';
}

interface CompatibilityReport {
	detectedVariants: string[];
	conversionResults: ConversionResult;
	compatibilityScore: number; // 0-100
	recommendations: string[];
}

// Rate limit interfaces
interface GitHubRateLimit {
	limit: number;
	remaining: number;
	reset: number;
	used: number;
}

// Adaptive debounce class
class AdaptiveDebounce {
	private baseDelay: number;
	private currentDelay: number;
	private rateLimit: GitHubRateLimit;

	constructor(baseDelay: number = 1000) {
		this.baseDelay = baseDelay;
		this.currentDelay = baseDelay;
		this.rateLimit = {
			limit: 5000,
			remaining: 5000,
			reset: 0,
			used: 0
		};
	}

	updateRateLimit(headers: any) {
		this.rateLimit = {
			limit: parseInt(headers['x-ratelimit-limit'] || '5000'),
			remaining: parseInt(headers['x-ratelimit-remaining'] || '5000'),
			reset: parseInt(headers['x-ratelimit-reset'] || '0'),
			used: parseInt(headers['x-ratelimit-used'] || '0')
		};
		
		this.adjustDebounceDelay();
	}

	private adjustDebounceDelay() {
		const { remaining, limit } = this.rateLimit;
		const usagePercentage = (limit - remaining) / limit;
		
		// Adaptive logic
		if (usagePercentage > 0.9) {        // >90% used
			this.currentDelay = this.baseDelay * 8;  // 8 seconds
		} else if (usagePercentage > 0.8) { // >80% used  
			this.currentDelay = this.baseDelay * 4;  // 4 seconds
		} else if (usagePercentage > 0.6) { // >60% used
			this.currentDelay = this.baseDelay * 2;  // 2 seconds  
		} else if (usagePercentage > 0.4) { // >40% used
			this.currentDelay = this.baseDelay * 1.5; // 1.5 seconds
		} else {                            // <40% used
			this.currentDelay = this.baseDelay;      // 1 second
		}
	}

	getDelay(): number {
		return this.currentDelay;
	}

	getRateLimit(): GitHubRateLimit {
		return { ...this.rateLimit };
	}
}

// Markdown Compatibility Handler
class MarkdownCompatibilityHandler {
	private variants: MarkdownVariant[];
	
	constructor() {
		this.variants = this.initializeVariants();
	}
	
	private initializeVariants(): MarkdownVariant[] {
		return [
			{
				name: 'Obsidian Wikilinks',
				description: 'Internal links using [[]] syntax',
				detector: (content: string) => /\[\[(?!\!)[^\]]+\]\]/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertWikilinks(content, options)
			},
			{
				name: 'Obsidian Image Wikilinks',
				description: 'Image embeds using ![[]] syntax',
				detector: (content: string) => /!\[\[[^\]]+\]\]/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertImageWikilinks(content, options)
			},
			{
				name: 'Obsidian Tags',
				description: 'Tags using #hashtag syntax',
				detector: (content: string) => /#[\w\-\/]+(?:\s|$|[^\w\-\/])/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertTags(content, options)
			},
			{
				name: 'Obsidian Callouts',
				description: 'Callouts using > [!type] syntax',
				detector: (content: string) => />\s*\[![\w\-]+\]/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertCallouts(content, options)
			},
			{
				name: 'Math Expressions',
				description: 'LaTeX math using $$ or $ syntax',
				detector: (content: string) => /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertMath(content, options)
			},
			{
				name: 'Plugin Content',
				description: 'Mermaid, Dataview, and other plugin syntax',
				detector: (content: string) => /```(?:mermaid|dataview|ad-|query)/.test(content) || /%%[\s\S]*?%%/.test(content),
				converter: (content: string, options?: ConversionOptions) => this.convertPluginContent(content, options)
			}
		];
	}
	
	analyzeContent(content: string): CompatibilityReport {
		const detectedVariants: string[] = [];
		let totalConversionResult: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};
		
		// Detect variants
		for (const variant of this.variants) {
			if (variant.detector(content)) {
				detectedVariants.push(variant.name);
			}
		}
		
		// Calculate compatibility score
		const compatibilityScore = this.calculateCompatibilityScore(detectedVariants);
		
		// Generate recommendations
		const recommendations = this.generateRecommendations(detectedVariants);
		
		return {
			detectedVariants,
			conversionResults: totalConversionResult,
			compatibilityScore,
			recommendations
		};
	}
	
	convertContent(content: string, options: ConversionOptions): ConversionResult {
		let result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};
		
		// Apply conversions in order
		for (const variant of this.variants) {
			if (variant.detector(result.convertedContent)) {
				const conversionResult = variant.converter(result.convertedContent, options);
				result.convertedContent = conversionResult.convertedContent;
				result.warnings.push(...conversionResult.warnings);
				result.removedElements.push(...conversionResult.removedElements);
				result.changedElements.push(...conversionResult.changedElements);
			}
		}
		
		return result;
	}
	
	private calculateCompatibilityScore(detectedVariants: string[]): number {
		const totalVariants = this.variants.length;
		const incompatibleVariants = detectedVariants.length;
		return Math.max(0, Math.round(((totalVariants - incompatibleVariants) / totalVariants) * 100));
	}
	
	private generateRecommendations(detectedVariants: string[]): string[] {
		const recommendations: string[] = [];
		
		if (detectedVariants.includes('Obsidian Wikilinks')) {
			recommendations.push('Convert wikilinks to standard Markdown links for better compatibility');
		}
		if (detectedVariants.includes('Obsidian Callouts')) {
			recommendations.push('Convert callouts to standard blockquotes with emoji indicators');
		}
		if (detectedVariants.includes('Math Expressions')) {
			recommendations.push('Consider converting math expressions to code blocks or images');
		}
		if (detectedVariants.includes('Plugin Content')) {
			recommendations.push('Plugin-specific content may not render correctly in GitHub Gist');
		}
		
		return recommendations;
	}
	
	// Conversion method implementations
	private convertWikilinks(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		if (!options?.preserveWikilinks) {
			// Enhanced wikilink conversion that preserves linking intent
			const wikilinkRegex = /\[\[(?!\!)([^\]|]+)(?:\|([^\]]+))?\]\]/g;
			let match;
			
			while ((match = wikilinkRegex.exec(content)) !== null) {
				const originalText = match[0];
				const linkTarget = match[1];
				const displayText = match[2] || linkTarget; // Use alias if provided
				
				if (options?.compatibilityMode === 'strict') {
					// Convert to plain text in strict mode but preserve display text
					result.convertedContent = result.convertedContent.replace(originalText, displayText);
					result.changedElements.push({
						original: originalText,
						converted: displayText,
						type: 'wikilink'
					});
				} else if (options?.compatibilityMode === 'github-native') {
					// Convert to proper markdown link format for better compatibility
					const fileName = linkTarget.replace(/[\s\/]/g, '_'); // Sanitize filename
					const convertedText = `[${displayText}](${fileName}.md)`;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'wikilink'
					});
				} else {
					// Permissive mode: Convert to bold text (legacy behavior)
					const convertedText = `**${displayText}**`;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'wikilink'
					});
				}
			}
			
			if (result.changedElements.length > 0 || result.removedElements.length > 0) {
				if (options?.compatibilityMode === 'github-native') {
					result.warnings.push(`Converted ${result.changedElements.length} wikilinks to standard markdown links`);
				} else {
					result.warnings.push(`Converted ${result.changedElements.length} wikilinks for compatibility`);
				}
			}
		}

		return result;
	}
	
	private convertImageWikilinks(content: string, options?: ConversionOptions): ConversionResult {
		// This will be handled by existing uploadImagesAndReplaceLinks method
		return { convertedContent: content, warnings: [], removedElements: [], changedElements: [] };
	}
	
	private convertTags(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		if (options?.convertTags) {
			// Skip processing in GitHub Native mode - tags work fine in Gist
			if (options?.compatibilityMode === 'github-native') {
				result.warnings.push('Tags preserved in original format for GitHub Gist compatibility');
				return result;
			}

			// Convert #tag using configurable format, but avoid markdown headers
			const tagRegex = /(?:^|\s)(#[\w\-\/]+)(?=\s|$|[^\w\-\/])/gm;
			let match;
			
			while ((match = tagRegex.exec(content)) !== null) {
				const originalText = match[1];
				const tagName = originalText.substring(1); // Remove #
				
				// Skip if it's at the beginning of a line (likely a header)
				const lineStart = content.lastIndexOf('\n', match.index) + 1;
				const beforeTag = content.substring(lineStart, match.index + match[0].indexOf(originalText));
				
				if (beforeTag.trim() === '') {
					// Likely a header, skip
					continue;
				}
				
				if (options?.compatibilityMode === 'strict') {
					// Remove tags in strict mode
					result.convertedContent = result.convertedContent.replace(originalText, '');
					result.removedElements.push(`Tag: ${originalText}`);
				} else {
					// Convert based on format preference
					let convertedText: string;
					const format = options?.tagConversionFormat || 'inline-code';
					
					switch (format) {
						case 'bold-labels':
							convertedText = `**Tag:** ${tagName}`;
							break;
						case 'plain-text':
							convertedText = tagName;
							break;
						case 'inline-code':
						default:
							convertedText = `\`${tagName}\``;
							break;
					}
					
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'tag'
					});
				}
			}
			
			if (result.changedElements.length > 0 || result.removedElements.length > 0) {
				result.warnings.push(`Processed ${result.changedElements.length + result.removedElements.length} tags using ${options?.tagConversionFormat || 'inline-code'} format`);
			}
		}

		return result;
	}
	
	private convertCallouts(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		if (options?.convertCallouts) {
			// Map callout types to emojis
			const calloutEmojis: { [key: string]: string } = {
				'note': '📝',
				'tip': '💡',
				'important': '❗',
				'warning': '⚠️',
				'caution': '🚨',
				'info': 'ℹ️',
				'success': '✅',
				'question': '❓',
				'failure': '❌',
				'danger': '🔥',
				'bug': '🐛',
				'example': '📋',
				'quote': '💬'
			};
			
			// Convert callouts like > [!note] Title
			const calloutRegex = />\s*\[!([\w\-]+)\](?:\s+([^\n]*?))?\n?((?:>.*\n?)*)/gm;
			let match;
			
			while ((match = calloutRegex.exec(content)) !== null) {
				const originalText = match[0];
				const calloutType = match[1].toLowerCase();
				const title = match[2] || calloutType;
				const calloutContent = match[3] || '';
				
				const emoji = calloutEmojis[calloutType] || '📄';
				
				if (options?.compatibilityMode === 'strict') {
					// Convert to simple blockquote
					const convertedText = `> **${title}**\n${calloutContent}`;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'callout'
					});
				} else {
					// Convert with emoji indicator
					const convertedText = `> ${emoji} **${title}**\n${calloutContent}`;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'callout'
					});
				}
			}
			
			if (result.changedElements.length > 0) {
				result.warnings.push(`Converted ${result.changedElements.length} callouts to blockquotes with emoji indicators`);
			}
		}

		return result;
	}
	
	private convertMath(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		// Handle block math ($$...$$)
		const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
		let match;
		
		while ((match = blockMathRegex.exec(content)) !== null) {
			const originalText = match[0];
			const mathContent = match[1].trim();
			
			if (options?.handleMath === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, '');
				result.removedElements.push(`Math block: ${originalText.substring(0, 50)}...`);
			} else if (options?.handleMath === 'convert') {
				const convertedText = `\`\`\`math\n${mathContent}\n\`\`\``;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'math-block'
				});
			}
			// 'preserve' mode: keep as is
		}
		
		// Handle inline math ($...$)
		const inlineMathRegex = /\$([^$\n]+)\$/g;
		
		while ((match = inlineMathRegex.exec(result.convertedContent)) !== null) {
			const originalText = match[0];
			const mathContent = match[1].trim();
			
			if (options?.handleMath === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, mathContent);
				result.removedElements.push(`Inline math: ${originalText}`);
			} else if (options?.handleMath === 'convert') {
				const convertedText = `\`${mathContent}\``;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'math-inline'
				});
			}
		}
		
		const totalMathElements = result.changedElements.length + result.removedElements.length;
		if (totalMathElements > 0) {
			// Update warning message since GitHub Gist has native math support since 2022
			if (options?.compatibilityMode === 'github-native') {
				result.warnings.push(`Mathematical expressions preserved for GitHub native rendering`);
			} else {
				result.warnings.push(`Processed ${totalMathElements} mathematical expressions - they may not render correctly in older platforms`);
			}
		}

		return result;
	}
	
	private convertPluginContent(content: string, options?: ConversionOptions): ConversionResult {
		const result: ConversionResult = {
			convertedContent: content,
			warnings: [],
			removedElements: [],
			changedElements: []
		};

		// Handle Mermaid diagrams - ONLY if not using GitHub Native mode
		// GitHub Gist has native Mermaid support since February 2022
		if (options?.compatibilityMode !== 'github-native') {
			const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
			let match;
			
			while ((match = mermaidRegex.exec(content)) !== null) {
				const originalText = match[0];
				const diagramContent = match[1];
				
				if (options?.handlePluginContent === 'remove') {
					result.convertedContent = result.convertedContent.replace(originalText, '');
					result.removedElements.push('Mermaid diagram');
				} else {
					// Convert to labeled code block
					const convertedText = `**📊 Mermaid Diagram:**\n\`\`\`\n${diagramContent}\n\`\`\``;
					result.convertedContent = result.convertedContent.replace(originalText, convertedText);
					result.changedElements.push({
						original: originalText,
						converted: convertedText,
						type: 'mermaid'
					});
				}
			}
		} else {
			// GitHub Native mode: Leave Mermaid untouched for native rendering
			result.warnings.push('Mermaid diagrams preserved for GitHub native rendering');
		}
		
		// Handle Dataview queries
		const dataviewRegex = /```dataview\n([\s\S]*?)\n```/g;
		let dataviewMatch;
		
		while ((dataviewMatch = dataviewRegex.exec(result.convertedContent)) !== null) {
			const originalText = dataviewMatch[0];
			const queryContent = dataviewMatch[1];
			
			if (options?.handlePluginContent === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, '');
				result.removedElements.push('Dataview query');
			} else {
				// Use configurable format for dataview conversion
				const format = options?.dataviewConversionFormat || 'descriptive-blocks';
				let convertedText: string;
				
				if (format === 'descriptive-blocks') {
					convertedText = `**📈 Dataview Query:**\n\n*This was a dynamic query that would have displayed data from your vault:*\n\n\`\`\`sql\n${queryContent}\n\`\`\``;
				} else {
					convertedText = `**Dataview:**\n\`\`\`sql\n${queryContent}\n\`\`\``;
				}
				
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'dataview'
				});
			}
		}
		
		// Handle comments %%...%%
		const commentRegex = /%%[\s\S]*?%%/g;
		let commentMatch;
		
		while ((commentMatch = commentRegex.exec(result.convertedContent)) !== null) {
			const originalText = commentMatch[0];
			const commentContent = originalText.slice(2, -2).trim(); // Remove %% delimiters
			
			if (options?.compatibilityMode === 'github-native') {
				// Convert to HTML comments or italic text for GitHub Gist
				const format = options?.commentConversionFormat || 'html-comments';
				let convertedText: string;
				
				if (format === 'html-comments') {
					convertedText = `<!-- ${commentContent} -->`;
				} else {
					convertedText = `*[${commentContent}]*`;
				}
				
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'comment'
				});
			} else if (options?.compatibilityMode === 'strict') {
				// Remove comments in strict mode
				result.convertedContent = result.convertedContent.replace(originalText, '');
				result.removedElements.push('Obsidian comment');
			} else {
				// Permissive mode: Convert to readable format
				const convertedText = `*[Note: ${commentContent}]*`;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'comment'
				});
			}
		}
		
		// Handle Admonition plugin syntax
		const admonitionRegex = /```ad-([\w\-]+)\n(?:title: (.*)\n)?([\s\S]*?)\n```/g;
		let admonitionMatch;
		
		while ((admonitionMatch = admonitionRegex.exec(result.convertedContent)) !== null) {
			const originalText = admonitionMatch[0];
			const adType = admonitionMatch[1];
			const title = admonitionMatch[2] || adType;
			const adContent = admonitionMatch[3];
			
			if (options?.handlePluginContent === 'remove') {
				result.convertedContent = result.convertedContent.replace(originalText, adContent);
				result.removedElements.push(`Admonition: ${adType}`);
			} else {
				// Convert to blockquote with emoji
				const emoji = adType === 'warning' ? '⚠️' : adType === 'note' ? '📝' : '📄';
				const convertedText = `> ${emoji} **${title}**\n> \n> ${adContent.replace(/\n/g, '\n> ')}`;
				result.convertedContent = result.convertedContent.replace(originalText, convertedText);
				result.changedElements.push({
					original: originalText,
					converted: convertedText,
					type: 'admonition'
				});
			}
		}
		
		const totalPluginElements = result.changedElements.length + result.removedElements.length;
		if (totalPluginElements > 0) {
			result.warnings.push(`Processed ${totalPluginElements} plugin-specific elements that may not render correctly in GitHub Gist`);
		}

		return result;
	}
}

export default class QuickShareNotePlugin extends Plugin {
	settings: QuickShareNotePluginSettings;
	private compatibilityHandler: MarkdownCompatibilityHandler;
	private isPublishing: boolean = false;
	// Sync functionality
	private adaptiveDebounce: AdaptiveDebounce;
	private debouncedSync: (file: TFile) => void;
	private queuedSyncs: TFile[] = [];

	async onload() {
		try {
			await this.loadSettings();
			this.compatibilityHandler = new MarkdownCompatibilityHandler();
			this.setupSyncFunctionality();
			this.addSettingTab(new QuickShareNoteSettingTab(this.app, this));

			this.addCommand({
				id: 'publish-note-to-gist',
				name: 'Publish note to GitHub gist',
				callback: () => this.publishNoteToGist(),
			});

			this.addCommand({
				id: 'analyze-markdown-compatibility',
				name: 'Analyze Markdown compatibility',
				callback: () => this.analyzeCurrentNoteCompatibility(),
			});

			// Add manual pull command
			this.addCommand({
				id: 'pull-from-gist',
				name: 'Pull note from GitHub gist',
				callback: () => this.pullCurrentNoteFromGist(),
			});
		} catch (error) {
			console.error('Failed to load Quick Share Note plugin:', error);
			new Notice('Failed to initialize Quick Share Note plugin');
		}
	}

	/**
	 * Publishes the active note to GitHub gist with image uploads to Imgur
	 */
	async publishNoteToGist() {
		// Prevent multiple simultaneous publishing operations
		if (this.isPublishing) {
			new Notice('Publishing already in progress. Please wait...');
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file found');
			return;
		}

		// Validate settings before proceeding
		if (!this.validateSettings()) {
			return;
		}

		this.isPublishing = true;
		let progressNotice = new Notice(`Preparing to publish: ${activeFile.name}...`, 0);
		
		try {
			const fileContent = await this.app.vault.read(activeFile);
			
			progressNotice.setMessage(`Processing images in: ${activeFile.name}...`);
			const updatedContent = await this.uploadImagesAndReplaceLinks(fileContent, (current, total) => {
				progressNotice.setMessage(`Uploading images: ${current}/${total} - ${activeFile.name}`);
			});

			const gistIdMatch = updatedContent.match(/gist-publish-url: https.*\/(.*)/);

			const contentToPublish = this.prepareContentForPublishing(updatedContent, activeFile.name);

			const gistUrl = await this.publishToGist(gistIdMatch, activeFile.name, contentToPublish, progressNotice);
			await this.finalizePublishing(activeFile, gistUrl, progressNotice);
			
			progressNotice.hide();
			new Notice('✅ Note published to GitHub gist successfully');
		} catch (error) {
			progressNotice.hide();
			this.handlePublishError(error);
		} finally {
			this.isPublishing = false;
		}
	}

	/**
	 * Analyzes current note's Markdown compatibility with GitHub Gist
	 */
	async analyzeCurrentNoteCompatibility() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file found');
			return;
		}

		try {
			const fileContent = await this.app.vault.read(activeFile);
			const parsed = this.parseFrontmatter(fileContent);
			const report = this.compatibilityHandler.analyzeContent(parsed.content);

			// Create detailed compatibility report
			const reportLines = [
				`# Markdown Compatibility Report for "${activeFile.name}"`,
				'',
				`**Compatibility Score:** ${report.compatibilityScore}/100`,
				'',
				'## Detected Markdown Variants:'
			];

			if (report.detectedVariants.length === 0) {
				reportLines.push('✅ **No compatibility issues found!** Your note uses standard Markdown that will render perfectly in GitHub Gist.');
			} else {
				reportLines.push('The following Obsidian-specific elements were detected:');
				reportLines.push('');
				report.detectedVariants.forEach(variant => {
					reportLines.push(`- **${variant}**`);
				});
			}

			if (report.recommendations.length > 0) {
				reportLines.push('');
				reportLines.push('## Recommendations:');
				report.recommendations.forEach(rec => {
					reportLines.push(`- ${rec}`);
				});
			}

			reportLines.push('');
			reportLines.push('---');
			reportLines.push('*This report was generated by the Quick Share Note to Gist plugin*');

			// Display the report in a modal or new note
			const reportContent = reportLines.join('\n');
			
			// For now, show in notice and copy to clipboard
			navigator.clipboard.writeText(reportContent);
			new Notice(`Compatibility analysis complete! Score: ${report.compatibilityScore}/100\nDetailed report copied to clipboard.`, 5000);
			
		} catch (error) {
			console.error('Failed to analyze compatibility:', error);
			new Notice('Failed to analyze note compatibility');
		}
	}


	/**
	 * Prepares content for publishing by handling frontmatter, compatibility conversion, and adding header
	 */
	private prepareContentForPublishing(content: string, fileName: string): string {
		const parsed = this.parseFrontmatter(content);
		
		// Apply Markdown compatibility conversions
		const conversionOptions: ConversionOptions = {
			compatibilityMode: this.settings.compatibilityMode,
			preserveWikilinks: this.settings.preserveWikilinks,
			convertTags: this.settings.convertTags,
			convertCallouts: this.settings.convertCallouts,
			handleMath: this.settings.handleMath,
			handlePluginContent: this.settings.handlePluginContent
		};
		
		const conversionResult = this.compatibilityHandler.convertContent(parsed.content, conversionOptions);
		
		// Show compatibility warnings if enabled
		if (this.settings.showCompatibilityReport && conversionResult.warnings.length > 0) {
			conversionResult.warnings.forEach(warning => {
				console.log('Compatibility warning:', warning);
			});
			
			if (conversionResult.changedElements.length > 0 || conversionResult.removedElements.length > 0) {
				const totalChanges = conversionResult.changedElements.length + conversionResult.removedElements.length;
				new Notice(`Applied ${totalChanges} compatibility conversions for GitHub Gist`, 3000);
			}
		}
		
		const frontmatter = this.settings.showFrontmatter && parsed.hasFrontmatter ? parsed.frontmatter : '';
		const fileNameWithoutSuffix = fileName.replace(/\.[^/.]+$/, '');
		const header = `# ${fileNameWithoutSuffix}\n\n`;
		
		return frontmatter + header + conversionResult.convertedContent;
	}

	/**
	 * Publishes content to GitHub gist (create or update)
	 */
	private async publishToGist(gistIdMatch: RegExpMatchArray | null, fileName: string, content: string, progressNotice: Notice): Promise<string> {
		progressNotice.setMessage(gistIdMatch ? 
			`Updating existing gist: ${fileName}...` : 
			`Creating new gist: ${fileName}...`);
			
		const response = gistIdMatch ? 
			await this.updateGist(gistIdMatch[1], fileName, content) 
			: await this.createNewGist(fileName, content);

		return response.json.html_url;
	}

	/**
	 * Finalizes publishing by updating frontmatter and copying URL to clipboard
	 */
	private async finalizePublishing(file: TFile, gistUrl: string, progressNotice: Notice): Promise<void> {
		progressNotice.setMessage(`Finalizing: ${file.name}...`);
		
		this.copyLinkToClipboard(gistUrl);
		await this.updateFrontmatter(file, gistUrl);
	}

	/**
	 * Creates a new GitHub gist
	 */
	async createNewGist(activeFileName: string, contentToPublish: string) {
		try {
			return await requestUrl({
				url: GITHUB_API_URL,
				method: 'POST',
				headers: this.getAuthHeaders(),
				body: JSON.stringify({
					files: {
						[activeFileName]: {
							content: contentToPublish,
						},
					},
					public: false,
				}),
			});
		} catch (error) {
			throw new Error(`Failed to create gist: ${this.getErrorMessage(error)}`);
		}
	}

	/**
	 * Updates an existing GitHub gist
	 */
	async updateGist(gistId: string, activeFileName: string, contentToPublish: string) {
		try {
			return await requestUrl({
				url: `${GITHUB_API_URL}/${gistId}`,
				method: 'PATCH',
				headers: this.getAuthHeaders(),
				body: JSON.stringify({
					files: {
						[activeFileName]: {
							content: contentToPublish,
						},
					},
				}),
			});
		} catch (error) {
			throw new Error(`Failed to update gist: ${this.getErrorMessage(error)}`);
		}
	}

	async addHeaderToContent(file: TFile) {
		const fileContent = await this.app.vault.read(file);
		const header = `# ${file.name}\n\n`;
		const newContent = header + fileContent;
		await this.app.vault.modify(file, newContent);
	}

	/**
	 * Updates the frontmatter of a file with the gist URL
	 */
	async updateFrontmatter(file: TFile, url: string) {
		try {
			const fileContent = await this.app.vault.read(file);
			const parsed = this.parseFrontmatter(fileContent);
			
			// Check if URL already exists and is the same - don't modify if unchanged
			if (parsed.hasFrontmatter) {
				const existingMatch = parsed.frontmatter.match(/gist-publish-url:\s*(.+)/);
				if (existingMatch && existingMatch[1].trim() === url.trim()) {
					// URL is the same, no need to update
					return;
				}
			}
			
			let newContent: string;
			
			if (parsed.hasFrontmatter) {
				// Update existing frontmatter - parsed.frontmatter already includes ---
				const lines = parsed.frontmatter.split('\n');
				const contentLines = lines.slice(1, -2); // Remove first --- and last --- lines
				
				const gistUrlIndex = contentLines.findIndex(line => line.startsWith('gist-publish-url:'));
				
				if (gistUrlIndex >= 0) {
					contentLines[gistUrlIndex] = `gist-publish-url: ${url}`;
				} else {
					contentLines.push(`gist-publish-url: ${url}`);
				}
				
				// Rebuild with proper Obsidian property format
				const updatedFrontmatter = '---\n' + contentLines.filter(line => line.trim()).join('\n') + '\n---\n';
				newContent = updatedFrontmatter + parsed.content;
			} else {
				// Add new frontmatter with Obsidian property format
				newContent = `---\ngist-publish-url: ${url}\n---\n${fileContent}`;
			}

			await this.app.vault.modify(file, newContent);
		} catch (error) {
			console.error('Failed to update frontmatter:', error);
			throw new Error(`Failed to update file frontmatter: ${this.getErrorMessage(error)}`);
		}
	}

	/**
	 * Processes content to upload images to Imgur and replace links
	 */
	async uploadImagesAndReplaceLinks(content: string, progressCallback?: (current: number, total: number) => void): Promise<string> {
		const imageRegex = /!\[\[(.*?)\]\]/g;
		const activeFile = this.app.workspace.getActiveFile();
		const notePath = activeFile ? activeFile.path.replace(/[^/]+$/, '') : '';
		
		// Find all matches first to avoid regex state issues with global flag
		const matches = Array.from(content.matchAll(imageRegex));
		const totalImages = matches.length;
		
		for (let i = 0; i < matches.length; i++) {
			const match = matches[i];
			
			if (progressCallback) {
				progressCallback(i + 1, totalImages);
			}
			
			try {
				const attachFile = this.app.metadataCache.getFirstLinkpathDest(match[1], notePath);
				if (attachFile == null) {
					console.warn(`Image not found: ${match[1]}`);
					continue;
				}
				const imageData = await this.app.vault.adapter.readBinary(attachFile.path);
				const imageUrl = await this.uploadImageToImgur(imageData);
				content = content.replace(match[0], `![Uploaded Image](${imageUrl})`);
			} catch (error) {
				console.error(`Failed to upload image ${match[1]}:`, error);
				// Keep original link if upload fails
				content = content.replace(match[0], `![Image Upload Failed](${match[1]})`);
			}
		}
		return content;
	}

	/**
	 * Uploads image data to Imgur
	 */
	async uploadImageToImgur(imageData: ArrayBuffer): Promise<string> {
		try {
			const response = await requestUrl({
				url: IMGUR_API_URL,
				method: 'POST',
				body: imageData,
				headers: {
					Authorization: `Client-ID ${this.settings.imgurClientId}`,
					'Content-Type': 'application/octet-stream',
				},
			});
			
			if (!response.json?.data?.link) {
				throw new Error('Invalid response from Imgur API');
			}
			
			return response.json.data.link;
		} catch (error) {
			throw new Error(`Failed to upload image to Imgur: ${this.getErrorMessage(error)}`);
		}
	}

	/**
	 * Copies the gist URL to clipboard
	 */
	copyLinkToClipboard(link: string) {
		navigator.clipboard.writeText(link).then(() => {
			new Notice('Gist URL copied to clipboard');
		}, (err) => {
			console.error('Failed to copy to clipboard:', err);
			new Notice('Failed to copy gist URL to clipboard');
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		try {
			await this.saveData(this.settings);
		} catch (error) {
			console.error('Failed to save settings:', error);
			new Notice('Failed to save plugin settings');
		}
	}

	/**
	 * Gets appropriate authorization headers based on token type
	 */
	private getAuthHeaders(): Record<string, string> {
		const token = this.settings.githubToken;
		if (token.startsWith('github_pat_')) {
			// Fine-grained personal access tokens
			return {
				'Authorization': `Bearer ${token}`,
				'X-GitHub-Api-Version': '2022-11-28',
				'Content-Type': 'application/json',
			};
		}
		// Classic personal access tokens and legacy tokens
		return {
			'Authorization': `token ${token}`,
			'Content-Type': 'application/json',
		};
	}

	/**
	 * Validates plugin settings before API operations
	 */
	private validateSettings(): boolean {
		if (!this.settings.githubToken.trim()) {
			new Notice('GitHub token is required. Please configure it in plugin settings.');
			return false;
		}
		
		if (!this.settings.imgurClientId.trim()) {
			new Notice('Imgur client ID is required. Please configure it in plugin settings.');
			return false;
		}
		
		// Enhanced GitHub token format validation - supports all token types
		if (!this.settings.githubToken.match(/^github_pat_[A-Za-z0-9_]+$/) && 
			!this.settings.githubToken.match(/^gh[a-z]_[A-Za-z0-9_]+$/) && 
			!this.settings.githubToken.match(/^[a-f0-9]{40}$/)) {
			new Notice('GitHub token appears to be invalid. Please check your token format.');
			return false;
		}
		
		return true;
	}

	/**
	 * Handles publishing errors with user-friendly messages
	 */
	private handlePublishError(error: any) {
		console.error('Publish error:', error);
		
		const errorMessage = this.getErrorMessage(error);
		
		if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
			new Notice('GitHub authentication failed. Please check your GitHub token.');
		} else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
			new Notice('GitHub API access denied. Check your token permissions or rate limits.');
		} else if (errorMessage.includes('404')) {
			new Notice('Gist not found. It may have been deleted.');
		} else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
			new Notice('Network error. Please check your internet connection.');
		} else if (errorMessage.includes('Imgur')) {
			new Notice('Image upload failed. Please check your Imgur client ID.');
		} else {
			new Notice(`Failed to publish note: ${errorMessage}`);
		}
	}

	/**
	 * Robust frontmatter parser that handles edge cases
	 */
	private parseFrontmatter(content: string): FrontmatterData {
		if (!content.startsWith('---')) {
			return {
				frontmatter: '',
				content: content,
				hasFrontmatter: false
			};
		}
		
		const lines = content.split('\n');
		let endIndex = -1;
		
		// Find the closing --- delimiter
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === '---') {
				endIndex = i;
				break;
			}
		}
		
		if (endIndex === -1) {
			// No closing delimiter found, treat as regular content
			return {
				frontmatter: '',
				content: content,
				hasFrontmatter: false
			};
		}
		
		const frontmatterLines = lines.slice(1, endIndex);
		const contentLines = lines.slice(endIndex + 1);
		
		return {
			frontmatter: '---\n' + frontmatterLines.join('\n') + '\n---\n',
			content: contentLines.join('\n'),
			hasFrontmatter: true
		};
	}

	// ===== SYNC FUNCTIONALITY =====

	/**
	 * Setup sync functionality including adaptive debounce and file watching
	 */
	private setupSyncFunctionality() {
		// Initialize adaptive debounce
		this.adaptiveDebounce = new AdaptiveDebounce(this.settings.debounceDelay);
		
		// Setup dynamic debounce function
		this.setupDynamicDebounce();
		
		// Register vault modify event for auto-sync
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				// Ensure it's a TFile, not a folder
				if (file instanceof TFile && await this.shouldAutoSync(file)) {
					this.debouncedSync(file);
				}
			})
		);
	}

	/**
	 * Setup dynamic debounce that adapts delay based on settings
	 */
	private setupDynamicDebounce() {
		let timeoutId: NodeJS.Timeout;
		
		this.debouncedSync = (file: TFile) => {
			clearTimeout(timeoutId);
			
			// Get current adaptive delay or use settings
			const delay = this.settings.enableAdaptiveDebounce ? 
				this.adaptiveDebounce.getDelay() : 
				this.settings.debounceDelay;
			
			timeoutId = setTimeout(() => {
				this.autoSyncToGist(file);
			}, delay);
		};
	}

	/**
	 * Check if file should be auto-synced
	 */
	private async shouldAutoSync(file: TFile): Promise<boolean> {
		// Skip if auto-sync disabled
		if (!this.settings.enableAutoSync) {
			return false;
		}

		// Skip if currently publishing manually
		if (this.isPublishing) {
			return false;
		}

		// Check if file has gist-publish-url
		return await this.hasGistUrl(file);
	}

	/**
	 * Check if file has a gist URL in frontmatter
	 */
	private async hasGistUrl(file: TFile): Promise<boolean> {
		try {
			const content = await this.app.vault.read(file);
			const parsed = this.parseFrontmatter(content);
			return parsed.hasFrontmatter && /gist-publish-url:\s*https/.test(parsed.frontmatter);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Auto-sync file to Gist (called after debounce delay)
	 */
	private async autoSyncToGist(file: TFile) {
		if (this.settings.syncNotifications === 'all') {
			new Notice(`Auto-syncing: ${file.name}`, 2000);
		}

		try {
			const content = await this.app.vault.read(file);
			const parsed = this.parseFrontmatter(content);
			
			// Extract gist ID from URL
			const gistMatch = parsed.frontmatter.match(/gist-publish-url:\s*https:\/\/gist\.github\.com\/.*\/(.+)/);
			if (!gistMatch) {
				console.error('Auto-sync failed: No valid gist URL found');
				return;
			}

			// Upload images and prepare content
			const contentWithImages = await this.uploadImagesAndReplaceLinks(content);
			const preparedContent = this.prepareContentForPublishing(contentWithImages, file.name);

			// Update gist
			const response = await this.updateGist(gistMatch[1], file.name, preparedContent);
			
			// Update rate limit from response headers
			if (this.settings.enableAdaptiveDebounce) {
				this.adaptiveDebounce.updateRateLimit(response.headers);
			}

			// Check rate limit and handle emergency disable
			this.checkRateLimitEmergency();

			if (this.settings.syncNotifications === 'all') {
				new Notice(`✅ Auto-synced: ${file.name}`, 2000);
			}

		} catch (error) {
			console.error('Auto-sync failed:', error);
			if (this.settings.syncNotifications !== 'none') {
				new Notice(`❌ Auto-sync failed: ${this.getErrorMessage(error)}`, 4000);
			}
		}
	}

	/**
	 * Manual pull from Gist to Obsidian
	 */
	async pullCurrentNoteFromGist() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file found');
			return;
		}

		if (!this.settings.enableManualPull) {
			new Notice('Manual pull is disabled in settings');
			return;
		}

		if (!this.validateSettings()) {
			return;
		}

		const pullNotice = new Notice('Pulling from Gist...', 0);

		try {
			const content = await this.app.vault.read(activeFile);
			const parsed = this.parseFrontmatter(content);
			
			// Extract gist ID from URL
			const gistMatch = parsed.frontmatter.match(/gist-publish-url:\s*https:\/\/gist\.github\.com\/.*\/(.+)/);
			if (!gistMatch) {
				pullNotice.hide();
				new Notice('No gist URL found in this note');
				return;
			}

			// Confirm override if setting enabled
			if (this.settings.confirmPullOverride) {
				// Simple confirmation - in real implementation, use a proper modal
				const confirmed = window.confirm('This will override your current note content with the Gist content. Continue?');
				if (!confirmed) {
					pullNotice.hide();
					return;
				}
			}

			// Fetch from GitHub Gist API
			const gistResponse = await requestUrl({
				url: `${GITHUB_API_URL}/${gistMatch[1]}`,
				method: 'GET',
				headers: this.getAuthHeaders()
			});

			// Extract content from first file in gist
			const files = gistResponse.json.files;
			const firstFile = Object.values(files)[0] as any;
			if (!firstFile?.content) {
				throw new Error('No content found in Gist');
			}

			// Update file content (preserve frontmatter with updated timestamp)
			const newContent = this.preserveFrontmatterForPull(parsed, firstFile.content);
			await this.app.vault.modify(activeFile, newContent);

			pullNotice.hide();
			new Notice(`✅ Pulled from Gist: ${activeFile.name}`, 3000);

		} catch (error) {
			pullNotice.hide();
			console.error('Pull from Gist failed:', error);
			new Notice(`❌ Pull failed: ${this.getErrorMessage(error)}`, 4000);
		}
	}

	/**
	 * Preserve frontmatter when pulling from Gist
	 */
	private preserveFrontmatterForPull(parsed: FrontmatterData, gistContent: string): string {
		if (!parsed.hasFrontmatter) {
			return gistContent;
		}

		// Add last-pulled timestamp
		const frontmatterLines = parsed.frontmatter.split('\n').slice(1, -2); // Remove --- delimiters
		const lastPulledIndex = frontmatterLines.findIndex(line => line.startsWith('last-pulled:'));
		
		if (lastPulledIndex >= 0) {
			frontmatterLines[lastPulledIndex] = `last-pulled: ${new Date().toISOString()}`;
		} else {
			frontmatterLines.push(`last-pulled: ${new Date().toISOString()}`);
		}

		return `---\n${frontmatterLines.filter(line => line.trim()).join('\n')}\n---\n${gistContent}`;
	}

	/**
	 * Check rate limit and disable auto-sync if emergency threshold reached
	 */
	private checkRateLimitEmergency() {
		if (!this.settings.enableAdaptiveDebounce) {
			return;
		}

		const rateLimit = this.adaptiveDebounce.getRateLimit();
		if (rateLimit.remaining <= this.settings.emergencyDisableThreshold) {
			this.settings.enableAutoSync = false;
			this.saveSettings();
			
			new Notice(`⚠️ Rate limit low (${rateLimit.remaining}/${rateLimit.limit}). Auto-sync disabled.`, 5000);
			
			// Schedule re-enable after rate limit reset
			const resetTime = rateLimit.reset * 1000;
			const delay = resetTime - Date.now();
			
			if (delay > 0 && delay < 3600000) { // Within 1 hour
				setTimeout(() => {
					this.settings.enableAutoSync = true;
					this.saveSettings();
					new Notice('Rate limit reset. Auto-sync re-enabled.', 3000);
				}, delay);
			}
		}
	}

	/**
	 * Get rate limit display string for UI
	 */
	getRateLimitDisplay(): string {
		if (!this.adaptiveDebounce) {
			return 'Rate limit: Unknown';
		}
		
		const rateLimit = this.adaptiveDebounce.getRateLimit();
		return `${rateLimit.remaining}/${rateLimit.limit} remaining`;
	}

	/**
	 * Extracts meaningful error message from error objects
	 */
	private getErrorMessage(error: any): string {
		if (typeof error === 'string') {
			return error;
		}
		
		if (error?.message) {
			return error.message;
		}
		
		if (error?.json?.message) {
			return error.json.message;
		}
		
		if (error?.status) {
			return `HTTP ${error.status}: ${error.statusText || 'Request failed'}`;
		}
		
		return 'Unknown error occurred';
	}
}

class QuickShareNoteSettingTab extends PluginSettingTab {
	plugin: QuickShareNotePlugin;

	constructor(app: App, plugin: QuickShareNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('GitHub token')
			.setDesc('Enter your GitHub personal access token with gist scope (supports all token formats)')
			.addText(text => {
				text.setPlaceholder('github_pat_xxx, ghp_xxx, or classic 40-char token')
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value;
						await this.plugin.saveSettings();
						
						// Enhanced token format validation - supports all token types
						const isValid = value.trim() === '' || 
							value.match(/^github_pat_[A-Za-z0-9_]+$/) ||
							value.match(/^gh[a-z]_[A-Za-z0-9_]+$/) || 
							value.match(/^[a-f0-9]{40}$/);
						
						text.inputEl.style.borderColor = isValid ? '' : '#ff6b6b';
					});
				return text;
			});

		new Setting(containerEl)
			.setName('Imgur client ID')
			.setDesc('Enter your Imgur application client ID for image uploads')
			.addText(text => {
				text.setPlaceholder('17-character alphanumeric ID')
					.setValue(this.plugin.settings.imgurClientId)
					.onChange(async (value) => {
						this.plugin.settings.imgurClientId = value;
						await this.plugin.saveSettings();
						
						// Validate client ID format (typically 15-17 characters)
						const isValid = value.trim() === '' || 
							value.match(/^[a-f0-9]{15,17}$/i);
						
						text.inputEl.style.borderColor = isValid ? '' : '#ff6b6b';
					});
				return text;
			});

		new Setting(containerEl)
			.setName('Show frontmatter')
			.setDesc('Show frontmatter in published note')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showFrontmatter)
				.onChange(async (value) => {
					this.plugin.settings.showFrontmatter = value;
					await this.plugin.saveSettings();
				}));

		// Markdown Compatibility Settings
		containerEl.createEl('h3', { text: 'Markdown Compatibility Settings' });
		containerEl.createEl('p', { 
			text: 'Configure how Obsidian-specific Markdown elements are converted for GitHub Gist compatibility.',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Compatibility mode')
			.setDesc('GitHub Native preserves GitHub Gist supported features, Permissive converts when possible, Strict removes all incompatible elements')
			.addDropdown(dropdown => dropdown
				.addOption('github-native', 'GitHub Native (Preserve Gist features)')
				.addOption('permissive', 'Permissive (Convert when possible)')
				.addOption('strict', 'Strict (Remove incompatible elements)')
				.setValue(this.plugin.settings.compatibilityMode)
				.onChange(async (value: 'github-native' | 'permissive' | 'strict') => {
					this.plugin.settings.compatibilityMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Convert wikilinks')
			.setDesc('Convert [[wikilinks]] to standard markdown links in GitHub Native mode')
			.addToggle(toggle => toggle
				.setValue(!this.plugin.settings.preserveWikilinks)
				.onChange(async (value) => {
					this.plugin.settings.preserveWikilinks = !value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Convert tags')
			.setDesc('Convert #tags to preserve data (GitHub Native mode ignores this setting)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convertTags)
				.onChange(async (value) => {
					this.plugin.settings.convertTags = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Tag conversion format')
			.setDesc('Choose how #tags are converted when not in GitHub Native mode')
			.addDropdown(dropdown => dropdown
				.addOption('inline-code', 'Inline code: `tag`')
				.addOption('bold-labels', 'Bold labels: **Tag:** tag')
				.addOption('plain-text', 'Plain text: tag')
				.setValue(this.plugin.settings.tagConversionFormat)
				.onChange(async (value: 'inline-code' | 'bold-labels' | 'plain-text') => {
					this.plugin.settings.tagConversionFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Convert callouts')
			.setDesc('Convert > [!note] callouts to blockquotes - GitHub Gist has native alert support since Nov 2023')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convertCallouts)
				.onChange(async (value) => {
					this.plugin.settings.convertCallouts = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Handle math expressions')
			.setDesc('How to handle LaTeX math expressions ($$ or $) - GitHub Gist has native support')
			.addDropdown(dropdown => dropdown
				.addOption('convert', 'Convert to code blocks')
				.addOption('preserve', 'Keep as-is (GitHub native rendering)')
				.addOption('remove', 'Remove math expressions')
				.setValue(this.plugin.settings.handleMath)
				.onChange(async (value: 'remove' | 'convert' | 'preserve') => {
					this.plugin.settings.handleMath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Handle plugin content')
			.setDesc('How to handle Mermaid, Dataview, and other plugin-specific content (GitHub Native mode preserves Mermaid)')
			.addDropdown(dropdown => dropdown
				.addOption('convert', 'Convert to labeled code blocks')
				.addOption('remove', 'Remove plugin content')
				.setValue(this.plugin.settings.handlePluginContent)
				.onChange(async (value: 'remove' | 'convert') => {
					this.plugin.settings.handlePluginContent = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Comment conversion format')
			.setDesc('Choose how %%comments%% are converted (GitHub Native mode preserves as HTML comments)')
			.addDropdown(dropdown => dropdown
				.addOption('html-comments', 'HTML comments: <!-- comment -->')
				.addOption('italic-text', 'Italic text: *[comment]*')
				.setValue(this.plugin.settings.commentConversionFormat)
				.onChange(async (value: 'html-comments' | 'italic-text') => {
					this.plugin.settings.commentConversionFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Dataview conversion format')
			.setDesc('Choose how Dataview queries are converted when not removed')
			.addDropdown(dropdown => dropdown
				.addOption('descriptive-blocks', 'Descriptive blocks with explanation')
				.addOption('simple-blocks', 'Simple labeled code blocks')
				.setValue(this.plugin.settings.dataviewConversionFormat)
				.onChange(async (value: 'descriptive-blocks' | 'simple-blocks') => {
					this.plugin.settings.dataviewConversionFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show compatibility reports')
			.setDesc('Show notifications about compatibility conversions during publishing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCompatibilityReport)
				.onChange(async (value) => {
					this.plugin.settings.showCompatibilityReport = value;
					await this.plugin.saveSettings();
				}));

		// Add compatibility analysis button
		new Setting(containerEl)
			.setName('Analyze current note')
			.setDesc('Analyze the current note for Markdown compatibility issues')
			.addButton(button => button
				.setButtonText('Analyze Compatibility')
				.setCta()
				.onClick(() => {
					this.plugin.analyzeCurrentNoteCompatibility();
				}));

		// Bidirectional Sync Settings
		containerEl.createEl('h3', { text: 'Bidirectional Sync Settings' });
		containerEl.createEl('p', { 
			text: 'Configure automatic syncing between Obsidian and GitHub Gist',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('Enable auto-sync to Gist')
			.setDesc('Automatically sync note changes to GitHub Gist after editing stops')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoSync)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoSync = value;
					await this.plugin.saveSettings();
					this.refreshSyncSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-sync delay')
			.setDesc('How long to wait after editing stops before syncing (prevents too frequent API calls)')
			.addDropdown(dropdown => dropdown
				.addOption('500', '0.5 seconds (Fast)')
				.addOption('1000', '1 second (Balanced)')
				.addOption('1500', '1.5 seconds (Recommended)')
				.addOption('2000', '2 seconds (Conservative)')
				.addOption('3000', '3 seconds (Very Safe)')
				.setValue(this.plugin.settings.debounceDelay.toString())
				.onChange(async (value) => {
					this.plugin.settings.debounceDelay = parseInt(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Adaptive sync delay')
			.setDesc('Automatically adjust sync delay based on GitHub API rate limit usage')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAdaptiveDebounce)
				.onChange(async (value) => {
					this.plugin.settings.enableAdaptiveDebounce = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable manual pull from Gist')
			.setDesc('Add command to manually update Obsidian note from GitHub Gist')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableManualPull)
				.onChange(async (value) => {
					this.plugin.settings.enableManualPull = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Confirm before pull override')
			.setDesc('Show confirmation dialog before overriding Obsidian content with Gist content')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmPullOverride)
				.onChange(async (value) => {
					this.plugin.settings.confirmPullOverride = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show sync notifications')
			.setDesc('Display notifications for successful syncs and errors')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All notifications')
				.addOption('errors', 'Errors only')
				.addOption('none', 'No notifications')
				.setValue(this.plugin.settings.syncNotifications)
				.onChange(async (value) => {
					this.plugin.settings.syncNotifications = value as 'all' | 'errors' | 'none';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('GitHub API Rate Limit Status')
			.setDesc('Current GitHub API usage (updates after each sync)')
			.addText(text => {
				text.setValue(this.plugin.getRateLimitDisplay())
					.setDisabled(true);
				text.inputEl.style.backgroundColor = '#f0f0f0';
				text.inputEl.style.color = '#666';
				return text;
			});

		new Setting(containerEl)
			.setName('Pull current note from Gist')
			.setDesc('Manually update the current note with content from GitHub Gist')
			.addButton(button => button
				.setButtonText('Pull from Gist')
				.setCta()
				.onClick(async () => {
					await this.plugin.pullCurrentNoteFromGist();
				}));

		new Setting(containerEl)
			.setName('Reset sync settings')
			.setDesc('Reset all bidirectional sync settings to default values')
			.addButton(button => button
				.setButtonText('Reset to Defaults')
				.setWarning()
				.onClick(async () => {
					this.resetSyncSettings();
				}));
	}

	/**
	 * Refresh sync-related settings visibility and state
	 */
	private refreshSyncSettings() {
		// This could be implemented to show/hide certain settings
		// For now, just re-display to update rate limit
		this.display();
	}

	/**
	 * Reset sync settings to defaults
	 */
	private async resetSyncSettings() {
		const confirmed = window.confirm('Reset all sync settings to default values?');
		if (!confirmed) return;

		this.plugin.settings.enableAutoSync = false;
		this.plugin.settings.debounceDelay = 1500;
		this.plugin.settings.enableAdaptiveDebounce = true;
		this.plugin.settings.enableManualPull = true;
		this.plugin.settings.confirmPullOverride = true;
		this.plugin.settings.syncNotifications = 'all';
		this.plugin.settings.showRateLimitStatus = true;
		this.plugin.settings.maxQueuedSyncs = 10;
		this.plugin.settings.emergencyDisableThreshold = 100;

		await this.plugin.saveSettings();
		this.display(); // Refresh UI
		new Notice('Sync settings reset to defaults');
	}
}
