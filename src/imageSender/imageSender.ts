/**
 * Image Sender Module
 *
 * Handles sending images to Claude Code terminal
 * by saving them as temporary files and generating special markers
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { QueuedImage } from '../imageQueue/imageQueue';

export interface SendResult {
  success: boolean;
  message?: string;
  imageCount?: number;
  error?: string;
}

/**
 * Image Sender
 *
 * Manages sending queued images to Claude Code terminal
 */
export class ImageSender {
  private tempDir: string;

  constructor(private context: vscode.ExtensionContext) {
    // Create temporary directory for images
    this.tempDir = path.join(os.tmpdir(), 'claude-code-images');
    this.ensureTempDir();
  }

  /**
   * Send queued images to terminal
   */
  async sendImages(images: QueuedImage[]): Promise<SendResult> {
    if (images.length === 0) {
      return {
        success: false,
        message: 'No images to send'
      };
    }

    try {
      // Find Claude Code terminal
      const terminal = this.findClaudeTerminal();
      if (!terminal) {
        return {
          success: false,
          error: 'Claude Code terminal not found. Please open a Claude Code terminal first.'
        };
      }

      // Save images and generate markers
      const markers: string[] = [];
      for (const image of images) {
        const imagePath = await this.saveImage(image);
        const marker = this.generateImageMarker(imagePath);
        markers.push(marker);
      }

      // Send image markers to terminal with automatic newline
      const imageText = markers.join('\n');
      terminal.sendText(imageText + '\n', false);

      return {
        success: true,
        message: `Sent ${images.length} image(s) to Claude Code`,
        imageCount: images.length
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save an image to temporary directory
   */
  private async saveImage(image: QueuedImage): Promise<string> {
    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const ext = this.getExtension(image.type);
    const fileName = `claude_${timestamp}_${random}${ext}`;
    const filePath = path.join(this.tempDir, fileName);

    // Decode Base64 and save
    const buffer = Buffer.from(image.data, 'base64');
    await fs.promises.writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * Generate image marker for Claude Code
   * @deprecated Use sendImagePath() instead for direct path sending
   */
  private generateImageMarker(imagePath: string): string {
    // Format: [Image: /path/to/image.png]
    return `[Image: ${imagePath}]`;
  }

  /**
   * Save image and immediately send path to terminal
   * This sends the raw file path (not wrapped in [Image: ...]) so that
   * Claude Code CLI can auto-detect and render it as [Image #N]
   */
  async saveAndSendImage(image: QueuedImage): Promise<string> {
    // 1. Save image to temporary file
    const imagePath = await this.saveImage(image);

    // 2. Find Claude Code terminal
    const terminal = this.findClaudeTerminal();
    if (!terminal) {
      const terminals = vscode.window.terminals;
      const terminalNames = terminals.length > 0
        ? terminals.map(t => t.name).join(', ')
        : 'none';
      throw new Error(
        `Claude Code terminal not found. ` +
        `Available terminals: ${terminalNames}. ` +
        `Please open a terminal first.`
      );
    }

    // 3. Convert to POSIX path format for Claude Code CLI
    // Windows: C:\Users\... → /c/Users/...
    const posixPath = this.convertToPosixPath(imagePath);

    // 4. Try @ format for Claude Code CLI file reference
    // Claude Code CLI supports @-mentioning files: @/path/to/image.png
    const formattedPath = `@${posixPath}`;

    // 5. Send path to terminal (without newline, stays in input area)
    terminal.sendText(formattedPath, false);

    console.log(`[ImageSender] Sent image path to terminal: ${formattedPath}`);
    return imagePath;
  }

  /**
   * Send image path to terminal input area (without executing)
   * This inserts the path into the terminal input so the user can see it
   * and continue typing their command
   */
  async sendPathToInput(image: QueuedImage): Promise<string> {
    // 1. Save image to temporary file
    const imagePath = await this.saveImage(image);

    // 2. Find Claude Code terminal
    const terminal = this.findClaudeTerminal();
    if (!terminal) {
      throw new Error('No terminal available');
    }

    // 3. Convert to POSIX path format
    const posixPath = this.convertToPosixPath(imagePath);

    // 4. Format with @ prefix for Claude Code CLI
    const formattedPath = `@${posixPath}`;

    // 5. Send to terminal input (without executing)
    // shouldExecute: false means text stays in input area
    terminal.sendText(formattedPath, false);

    console.log(`[ImageSender] Sent path to input: ${formattedPath}`);
    return imagePath;
  }

  /**
   * Convert Windows path to POSIX format for Claude Code CLI
   * C:\Users\...\image.png → /c/Users/.../image.png
   */
  private convertToPosixPath(windowsPath: string): string {
    // Only convert on Windows
    if (process.platform !== 'win32') {
      return windowsPath;
    }

    // Convert C:\ → /c/ and all backslashes to forward slashes
    return windowsPath.replace(/^([A-Z]):\\/i, '/$1/').replace(/\\/g, '/');
  }

  /**
   * Get file extension from MIME type
   */
  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp'
    };

    return extensions[mimeType] || '.png';
  }

  /**
   * Find Claude Code terminal
   */
  private findClaudeTerminal(): vscode.Terminal | undefined {
    const terminals = vscode.window.terminals;

    // Debug: log all available terminals
    console.log('[ImageSender] Available terminals:', terminals.map(t => t.name).join(', '));

    // Find terminal with Claude-related name
    let terminal = terminals.find(t => {
      const name = t.name.toLowerCase();
      return (
        name.includes('claude') ||
        name.includes('code') ||
        name.includes('bash') ||
        name.includes('powershell') ||
        name.includes('pwsh')
      );
    });

    if (terminal) {
      console.log('[ImageSender] Found Claude Code terminal:', terminal.name);
    } else {
      // Fallback: use the first available terminal if no specific match
      if (terminals.length > 0) {
        terminal = terminals[0];
        console.log('[ImageSender] Using fallback terminal:', terminal.name);
      } else {
        console.warn('[ImageSender] No terminal found at all');
      }
    }

    return terminal;
  }

  /**
   * Ensure temporary directory exists
   */
  private ensureTempDir(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create temp directory:', error);
      // Fallback to system temp directory
      this.tempDir = os.tmpdir();
    }
  }

  /**
   * Clean up old temporary image files
   */
  async cleanupTempFiles(olderThanHours: number = 24): Promise<void> {
    try {
      const now = Date.now();
      const maxAge = olderThanHours * 60 * 60 * 1000;

      const files = await fs.promises.readdir(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          const stats = await fs.promises.stat(filePath);

          // Check if file is a file (not directory) and too old
          if (stats.isFile() && now - stats.mtimeMs > maxAge) {
            await fs.promises.unlink(filePath);
            console.log(`Cleaned up old image: ${file}`);
          }
        } catch (error) {
          // Skip files we can't read or delete
          console.error(`Failed to clean up ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error during temp file cleanup:', error);
    }
  }

  /**
   * Get temporary directory path
   */
  getTempDir(): string {
    return this.tempDir;
  }
}
